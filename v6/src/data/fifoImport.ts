import Papa from 'papaparse';
import { z } from 'zod';
import { tradeSchema, type Trade, type Journal, type Market } from './schema';
import { canonical, sha256 } from './backup';
import { validateSnapshot, type Snapshot } from './snapshot';
import { D, dec, sum } from '../core/money';
import { tradeFacts } from '../core/trade';
export type FillMapping = Record<string, string>;
export const fillColumns = [
  'id',
  'symbol',
  'time',
  'side',
  'positionSide',
  'price',
  'quantity',
  'commission',
  'feeCurrency',
  'funding',
  'swap',
  'tax',
  'other',
  'reportedGross',
] as const;
const aliases: Record<string, string[]> = {
  id: ['tradeid', 'fillid', 'id'],
  symbol: ['symbol', 'pair', 'contract'],
  time: ['time', 'dateutc', 'date', 'timestamp'],
  side: ['side', 'type'],
  positionSide: ['positionside'],
  price: ['price'],
  quantity: ['quantity', 'qty', 'executed', 'executedquantity'],
  commission: ['commission', 'fee'],
  feeCurrency: ['feecoin', 'commissionasset', 'feeasset'],
  funding: ['funding'],
  swap: ['swap'],
  tax: ['tax'],
  other: ['other'],
  reportedGross: ['realizedprofit', 'realizedpnl', 'gross'],
};
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export function suggestMapping(headers: string[]) {
  return Object.fromEntries(
    fillColumns.map((k) => [k, headers.find((h) => aliases[k].includes(normalize(h))) ?? '']),
  );
}
export function csvHeaders(raw: string) {
  const p = Papa.parse<string[]>(raw, { preview: 1 });
  return (p.data[0] ?? []).map((h) => h.replace(/^\uFEFF/, '').trim());
}
type CostKey = keyof Trade['costs'];
const keys: CostKey[] = ['commission', 'funding', 'swap', 'tax', 'other'];
const fillSchema = z.object({
  key: z.string(),
  id: z.string(),
  symbol: z.string(),
  time: z.iso.datetime(),
  side: z.enum(['BUY', 'SELL']),
  position: z.enum(['NET', 'LONG', 'SHORT']),
  price: z.string(),
  quantity: z.string(),
  costs: z.object({
    commission: z.string(),
    funding: z.string(),
    swap: z.string(),
    tax: z.string(),
    other: z.string(),
  }),
  known: z.boolean(),
  batch: z.string(),
  reportedGross: z.string().optional(),
});
type Fill = z.infer<typeof fillSchema>;
const sourceSchema = z.object({
  kind: z.literal('fifo-v1'),
  journalId: z.string(),
  broker: z.string(),
  market: z.string(),
  multiplier: z.string(),
  mode: z.enum(['spot', 'futures']),
  raw: z.string(),
  mapping: z.record(z.string(), z.string()),
  fills: z.array(fillSchema),
});
type ImportSource = z.infer<typeof sourceSchema>;
export interface FillOptions {
  broker: string;
  market: Market;
  multiplier: string;
  mode: 'spot' | 'futures';
  confirmedZeroCosts: boolean;
  mapping: FillMapping;
}
function amount(v: string, field: string) {
  const m = v.trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([A-Za-z]*)$/i);
  if (!m) throw Error(field + ': số không hợp lệ');
  return { value: dec(D(m[1])), asset: m[2].toUpperCase() };
}
export async function previewFIFO(
  raw: string,
  journal: Journal,
  options: FillOptions,
  data: Snapshot,
) {
  if (new TextEncoder().encode(raw).length > 20 * 1024 * 1024) throw Error('IMPORT_TOO_LARGE');
  if (!options.broker.trim() || !D(options.multiplier).gt(0))
    throw Error('Cần nền tảng và hệ số hợp đồng dương.');
  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
  });
  const errors: { row: number; column: string; message: string }[] = parsed.errors.map((e) => ({
    row: (e.row ?? 0) + 2,
    column: 'CSV',
    message: e.message,
  }));
  if (!parsed.data.length || parsed.data.length > 10000)
    throw Error('Cần 1–10.000 dòng khớp lệnh.');
  const batch = 'fifo:' + (await sha256(canonical({ journal: journal.id, raw, options }))),
    fills: Fill[] = [];
  const occurrences = new Map<string, number>();
  for (const [index, row] of parsed.data.entries()) {
    let column = '';
    try {
      const read = (k: string, required = false) => {
        column = k;
        const v = row[options.mapping[k]]?.trim() ?? '';
        if (required && !v) throw Error('Thiếu cột hoặc giá trị');
        return v;
      };
      const symbol = read('symbol', true).toUpperCase().replaceAll('/', ''),
        date = read('time', true);
      const time = new Date(
        z.iso
          .datetime({ offset: true })
          .parse(/Z$|[+-]\d\d:\d\d$/.test(date) ? date : date.replace(' ', 'T') + 'Z'),
      ).toISOString();
      const side = read('side', true).toUpperCase();
      if (side !== 'BUY' && side !== 'SELL') throw Error('Side phải BUY hoặc SELL');
      const position = read('positionSide').toUpperCase() || 'NET';
      if (!['NET', 'LONG', 'SHORT', 'BOTH'].includes(position))
        throw Error('Position Side không hợp lệ');
      const price = amount(read('price', true), 'price'),
        quantity = amount(read('quantity', true), 'quantity');
      if (!D(price.value).gt(0) || !D(quantity.value).gt(0))
        throw Error('Giá và khối lượng phải dương');
      if (price.asset && price.asset !== journal.currency)
        throw Error('Giá khác tiền tệ sổ; cần nguồn tỷ giá được xác nhận');
      const costs = {} as Trade['costs'];
      let known = true,
        feeAsset = read('feeCurrency').toUpperCase();
      for (const k of keys) {
        const v = read(k);
        if (!v && !options.confirmedZeroCosts) known = false;
        const parsedCost = amount(v || '0', k);
        if (['commission', 'tax', 'other'].includes(k) && D(parsedCost.value).lt(0))
          throw Error('Phí trả không được âm');
        costs[k] = parsedCost.value;
        if (k === 'commission' && parsedCost.asset) feeAsset = parsedCost.asset;
        if (parsedCost.asset && parsedCost.asset !== journal.currency)
          throw Error(k + ': tiền tệ khác sổ; không tự quy đổi');
      }
      if (!feeAsset && !D(costs.commission).isZero()) throw Error('Thiếu tiền tệ phí');
      if (feeAsset && feeAsset !== journal.currency)
        throw Error('Phí khác tiền tệ sổ; không tự quy đổi');
      let external = read('id');
      if (!external) {
        const identity = await sha256(
          canonical({
            symbol,
            time,
            side,
            position,
            price: price.value,
            quantity: quantity.value,
            costs,
          }),
        );
        const occurrence = (occurrences.get(identity) ?? 0) + 1;
        occurrences.set(identity, occurrence);
        external = identity + ':' + occurrence;
      }
      const key = options.broker + '|' + symbol + '|' + external;
      const reported = read('reportedGross');
      fills.push({
        key,
        id: external,
        symbol,
        time,
        side,
        position: position === 'BOTH' ? 'NET' : (position as Fill['position']),
        price: price.value,
        quantity: quantity.value,
        costs,
        known,
        batch,
        ...(reported ? { reportedGross: amount(reported, 'reportedGross').value } : {}),
      });
    } catch (e) {
      errors.push({ row: index + 2, column, message: String(e) });
    }
  }
  if (errors.length)
    return { errors, data: undefined, batch, added: 0, skipped: 0, fills: fills.length };
  const source: ImportSource = {
    kind: 'fifo-v1',
    journalId: journal.id,
    broker: options.broker,
    market: options.market,
    multiplier: options.multiplier,
    mode: options.mode,
    raw,
    mapping: options.mapping,
    fills,
  };
  const previous = activeSources(data, journal.id),
    known = new Map(previous.flatMap((s) => s.fills).map((f) => [f.key, f]));
  let added = 0,
    skipped = 0;
  for (const f of fills) {
    const old = known.get(f.key);
    if (old) {
      if (fillEconomic(old) !== fillEconomic(f)) throw Error('ID khớp có dữ liệu khác: ' + f.id);
      skipped++;
    } else {
      known.set(f.key, f);
      added++;
    }
  }
  if (!added) return { errors, data, batch, added, skipped, fills: fills.length };
  const next = {
    ...data,
    sources: [
      ...data.sources,
      ...(data.sources.some((s) => s.id === batch)
        ? []
        : [{ id: batch, raw: canonical(source), createdAt: new Date().toISOString() }]),
    ],
    batches: [
      ...data.batches,
      {
        id: batch,
        journalId: journal.id,
        platform: 'FIFO · ' + options.broker,
        fileName: '',
        at: new Date().toISOString(),
        tradeIds: [],
        stats: { added, skipped, errors: 0 },
      },
    ],
  };
  return {
    errors,
    data: await rebuildFIFO(next, journal, data),
    batch,
    added,
    skipped,
    fills: fills.length,
  };
}
const fillEconomic = (f: Fill) => canonical({ ...f, batch: undefined });
function activeSources(data: Snapshot, journalId: string) {
  const ids = new Set(
    data.batches
      .filter((b) => b.journalId === journalId && b.platform.startsWith('FIFO · '))
      .map((b) => b.id),
  );
  return data.sources
    .filter((s) => ids.has(s.id))
    .map((s) => sourceSchema.parse(JSON.parse(s.raw)));
}
async function rebuildFIFO(data: Snapshot, journal: Journal, baselineData?: Snapshot) {
  const sources = activeSources(data, journal.id);
  const unique = new Map<string, { f: Fill; s: ImportSource }>();
  for (const s of sources)
    for (const f of s.fills) {
      const prior = unique.get(f.key);
      if (prior && fillEconomic(prior.f) !== fillEconomic(f))
        throw Error('Nguồn fill xung đột: ' + f.id);
      if (!prior) unique.set(f.key, { f, s });
    }
  // Stable sort preserves input row order for equal timestamps, never lexical IDs.
  const all = [...unique.values()].sort((a, b) => a.f.time.localeCompare(b.f.time));
  type Lot = { f: Fill; s: ImportSource; remaining: ReturnType<typeof D>; costs: Trade['costs'] };
  const inventory = new Map<string, Lot[]>(),
    next: Trade[] = [];
  const add = async (
    a: Fill,
    s: ImportSource,
    quantity: string,
    costs: Trade['costs'],
    out?: Fill,
    known = a.known,
  ) => {
    const id =
      'fifo-trade:' + (await sha256(journal.id + '|' + a.key + '|' + (out?.key ?? 'open')));
    next.push(
      tradeSchema.parse({
        id,
        journalId: journal.id,
        symbol: a.symbol,
        market: s.market,
        side: a.side === 'BUY' ? 'long' : 'short',
        status: out ? 'closed' : 'open',
        multiplier: s.multiplier,
        legs: [
          { id: a.key, kind: 'in', time: a.time, price: a.price, quantity },
          ...(out
            ? [{ id: out.key, kind: 'out', time: out.time, price: out.price, quantity }]
            : []),
        ],
        costs,
        costsKnown: known,
        tags: ['fifo-import'],
        errorTagIds: [],
        starred: false,
        review: { done: false },
        attachments: [],
        customStats: {},
        importBatchId: out?.batch ?? a.batch,
        isDemo: journal.isDemo,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );
  };
  for (const { f, s } of all) {
    const key = s.broker + '|' + f.symbol + '|' + f.position,
      queue = inventory.get(key) ?? [];
    inventory.set(key, queue);
    let remaining = D(f.quantity),
      gross = D('0');
    const costs = { ...f.costs };
    while (remaining.gt(0) && queue.length && queue[0].f.side !== f.side) {
      const lot = queue[0];
      if (lot.s.market !== s.market || !D(lot.s.multiplier).eq(s.multiplier))
        throw Error('Hệ số hoặc thị trường thay đổi giữa vị thế đang mở');
      const q = remaining.lte(lot.remaining) ? remaining : lot.remaining,
        allocated = {} as Trade['costs'];
      for (const k of keys) {
        const a = D(lot.costs[k]).mul(q).div(lot.remaining),
          b = D(costs[k]).mul(q).div(remaining);
        allocated[k] = dec(a.plus(b));
        lot.costs[k] = dec(D(lot.costs[k]).minus(a));
        costs[k] = dec(D(costs[k]).minus(b));
      }
      await add(lot.f, s, dec(q), allocated, f, lot.f.known && f.known);
      gross = gross.plus(
        D(f.price)
          .minus(lot.f.price)
          .mul(q)
          .mul(s.multiplier)
          .mul(lot.f.side === 'BUY' ? 1 : -1),
      );
      lot.remaining = lot.remaining.minus(q);
      remaining = remaining.minus(q);
      if (lot.remaining.isZero()) queue.shift();
    }
    if (f.reportedGross !== undefined && !gross.eq(f.reportedGross))
      throw Error(
        'Gross báo cáo không khớp FIFO tại fill ' +
          f.id +
          ' (FIFO ' +
          dec(gross) +
          ', báo cáo ' +
          f.reportedGross +
          ').',
      );
    if (remaining.gt(0)) {
      if (
        (s.mode === 'spot' && f.side === 'SELL') ||
        (f.position === 'LONG' && f.side === 'SELL') ||
        (f.position === 'SHORT' && f.side === 'BUY')
      )
        throw Error('Thiếu khớp mở trước fill ' + f.id + '; tải đủ lịch sử vị thế.');
      queue.push({ f, s, remaining, costs });
    }
  }
  for (const lots of inventory.values())
    for (const lot of lots) await add(lot.f, lot.s, dec(lot.remaining), lot.costs);
  const old = data.trades.filter(
      (t) => t.journalId === journal.id && t.tags.includes('fifo-import'),
    ),
    oldMap = new Map(old.map((t) => [t.id, t]));
  const economics = (t: Trade) =>
    canonical({
      symbol: t.symbol,
      market: t.market,
      side: t.side,
      status: t.status,
      multiplier: t.multiplier,
      legs: t.legs,
      costs: t.costs,
      costsKnown: t.costsKnown,
    });
  if (baselineData) {
    const baseline = await rebuildFIFO(
      {
        ...baselineData,
        trades: baselineData.trades.filter(
          (t) => !(t.journalId === journal.id && t.tags.includes('fifo-import')),
        ),
      },
      journal,
    );
    const baselineMap = new Map(baseline.trades.map((t) => [t.id, t]));
    for (const t of old) {
      const expected = baselineMap.get(t.id);
      if (!expected || economics(expected) !== economics(t))
        throw Error(
          'Lệnh FIFO đã sửa dữ kiện; cần đối chiếu thủ công trước import/hoàn tác: ' + t.id,
        );
    }
  }
  const nextMap = new Map(next.map((t) => [t.id, t]));
  for (const t of old) {
    const candidate = nextMap.get(t.id);
    if (!candidate || economics(candidate) !== economics(t)) {
      if (
        t.initialRisk ||
        t.setupId ||
        t.review.done ||
        t.starred ||
        t.emotion ||
        t.checklist ||
        t.disciplineLegacy !== undefined ||
        t.otpHit ||
        t.highestPrice ||
        t.lowestPrice ||
        t.mergedFrom ||
        canonical(t.tags) !== canonical(['fifo-import']) ||
        t.plannedSL ||
        t.plannedTP ||
        t.stageChips ||
        t.attachments.length ||
        t.errorTagIds.length ||
        Object.keys(t.customStats).length ||
        data.notes.some((n) => n.scope === 'trade' && n.refId === t.id) ||
        data.plannedTrades.some((p) => p.takenTradeId === t.id) ||
        data.altStrategies.some((a) => a.hypotheticalR.some((r) => r.tradeId === t.id))
      )
        throw Error(
          'Lệnh FIFO đã có hồ sơ cần giữ: ' + t.id + '. Không ghi đè hoặc hoàn tác tự động.',
        );
    }
  }
  const restored = next.map((t) => {
    const prior = oldMap.get(t.id);
    return prior && economics(prior) === economics(t)
      ? { ...prior, importBatchId: t.importBatchId }
      : t;
  });
  const activeIds = new Set(sources.flatMap((s) => s.fills.map((f) => f.batch))),
    oldIds = new Set(old.map((t) => t.id));
  return validateSnapshot({
    ...data,
    trades: [...data.trades.filter((t) => !oldIds.has(t.id)), ...restored],
    batches: data.batches.map((b) =>
      activeIds.has(b.id)
        ? { ...b, tradeIds: restored.filter((t) => t.importBatchId === b.id).map((t) => t.id) }
        : b,
    ),
  });
}
export function commitFIFO(
  data: Snapshot,
  preview: Awaited<ReturnType<typeof previewFIFO>>,
  fileName: string,
) {
  if (preview.errors.length || !preview.data) throw Error('Hãy sửa các dòng lỗi trước khi nhập.');
  if (!preview.added) return data;
  return validateSnapshot({
    ...preview.data,
    batches: preview.data.batches.map((b) => (b.id === preview.batch ? { ...b, fileName } : b)),
  });
}
export async function rollbackFIFO(data: Snapshot, batch: string, journal: Journal) {
  if (
    !data.batches.some(
      (b) => b.id === batch && b.journalId === journal.id && b.platform.startsWith('FIFO · '),
    )
  )
    throw Error('Không tìm thấy batch FIFO.');
  const remaining = { ...data, batches: data.batches.filter((b) => b.id !== batch) };
  const removed = activeSources(data, journal.id)
      .flatMap((s) => s.fills)
      .filter((f) => f.batch === batch),
    available = new Set(
      activeSources(remaining, journal.id).flatMap((s) => s.fills.map((f) => f.key)),
    );
  const unavailable = new Set(removed.filter((f) => !available.has(f.key)).map((f) => f.key));
  if (
    data.trades.some(
      (t) =>
        t.journalId === journal.id &&
        t.importBatchId !== batch &&
        t.tags.includes('fifo-import') &&
        t.legs.some((l) => l.kind === 'in' && unavailable.has(l.id)) &&
        t.legs.some((l) => l.kind === 'out'),
    )
  )
    throw Error('Đợt sau còn phụ thuộc khớp mở của đợt này. Hoàn tác đợt phụ thuộc trước.');
  return rebuildFIFO(remaining, journal, data);
}
export function fifoTotals(data: Snapshot, journalId: string) {
  const fs = data.trades
    .filter((t) => t.journalId === journalId && t.tags.includes('fifo-import'))
    .map(tradeFacts);
  return {
    gross: sum(fs.map((f) => f.gross)),
    net: fs.every((f) => f.net !== undefined) ? sum(fs.map((f) => f.net!)) : null,
    open: sum(fs.map((f) => f.openQty)),
  };
}
