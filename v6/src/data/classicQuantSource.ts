import { fetchAllTrades } from '../../../lib/read-trades';
import { z } from 'zod';
import type { QuantObservation } from '../core/quantLab';
import { D, dec } from '../core/money';
const finite = z.number().finite();
export const receipt = z.object({
  id: z.string().min(1).max(256),
  userId: z.string().optional(),
  symbol: z.string().min(1).max(80),
  date: z.iso.date(),
  market: z.string().optional(),
  openedAt: z.string().datetime().nullish(),
  closedAt: z.string().datetime().nullish(),
  pnl: finite,
  fees: finite.optional(),
  swap: finite.optional(),
  risk: finite.optional(),
  pnlKnown: z.boolean().optional(),
  feesKnown: z.boolean().optional(),
  riskKnown: z.boolean().optional(),
  setup: z.string().optional(),
  mae: finite.nullish(),
  mfe: finite.nullish(),
  recordKind: z.string().optional(),
  quantity: finite.optional(),
  multiplier: finite.optional(),
  version: z.number().int().optional(),
  note: z.string().optional(),
  side: z.string().optional(),
});
const markets: Record<string, string> = {
  'Chứng khoán': 'stocks',
  'Hàng hóa': 'commodities',
  Crypto: 'crypto',
  Forex: 'forex',
  'Phái sinh': 'futures',
  'Quyền chọn': 'options',
  stocks: 'stocks',
  forex: 'forex',
  cfd: 'cfd',
  futures: 'futures',
  crypto: 'crypto',
  options: 'options',
  commodities: 'commodities',
};
export function classicObservations(input: unknown[]) {
  let skipped = 0;
  const observations = input.flatMap((item): QuantObservation[] => {
    const parsed = receipt.safeParse(item);
    if (!parsed.success || parsed.data.recordKind === 'fill') {
      skipped++;
      return [];
    }
    const t = parsed.data;
    const gross = t.pnlKnown === false ? null : String(t.pnl);
    const net =
      gross === null || t.feesKnown === false || t.fees === undefined
        ? null
        : dec(
            D(gross)
              .minus(t.fees)
              .minus(t.swap ?? 0),
          );
    const closeTime = t.closedAt ?? t.date + 'T12:00:00.000Z';
    return [
      {
        id: t.id,
        symbol: t.symbol,
        market: markets[t.market ?? ''] ?? 'unclassified',
        setup: t.setup ?? '',
        openTime: t.openedAt ?? closeTime,
        closeTime,
        gross,
        net,
        risk: t.riskKnown === false || !t.risk || t.risk <= 0 ? null : String(t.risk),
        mfe: t.mfe !== null && t.mfe !== undefined && t.mfe >= 0 ? String(t.mfe) : null,
        mae: t.mae !== null && t.mae !== undefined && t.mae >= 0 ? String(t.mae) : null,
        entryTimeKnown: !!t.openedAt,
        exitTimeKnown: !!t.closedAt,
        exitDate: t.date,
        quantity: t.quantity && t.quantity > 0 ? String(t.quantity) : undefined,
        multiplier: t.multiplier && t.multiplier > 0 ? String(t.multiplier) : undefined,
      },
    ];
  });
  return { observations, skipped };
}
// This adapter has no writer and never enumerates another user's storage keys.
export async function readClassicQuantSource() {
  const session = await Promise.all(
    ['/api/auth/get-session', '/api/site-session'].map(async (path) => {
      try {
        const r = await fetch(path, { cache: 'no-store' });
        return r.ok ? ((await r.json()) as { user?: { id?: string } }) : null;
      } catch {
        return null;
      }
    }),
  );
  const user = session.map((s) => s?.user?.id).find(Boolean);
  if (user) {
    try {
      const r = await fetchAllTrades({ headers: { 'X-Journal-Owner': user } });
      if (r.ok) {
        const payload = (await r.json()) as { trades?: unknown[] };
        if (Array.isArray(payload.trades) && payload.trades.length)
          return {
            ...classicObservations(payload.trades),
            receipts: payload.trades.map((r) => ({ ...(r as object), userId: user })),
            source: 'Classic · tài khoản đang đăng nhập',
            isDemo: false,
          };
      }
    } catch {
      /* Fall back only to this same account's cache. */
    }
  }
  const raw = localStorage.getItem('tuan-trader-trades' + (user ? ':' + user : ''));
  if (!raw)
    return {
      observations: [],
      receipts: [] as unknown[],
      skipped: 0,
      source: 'Classic · trên thiết bị',
      isDemo: false,
    };
  const input: unknown = JSON.parse(raw);
  if (!Array.isArray(input) || input.length > 100000) throw Error('Dữ liệu Classic không hợp lệ.');
  return {
    ...classicObservations(input),
    receipts: input,
    source: 'Classic · bản lưu trên thiết bị',
    isDemo: localStorage.getItem('tuan-trader-demo-mode-v1' + (user ? ':' + user : '')) === 'true',
  };
}
