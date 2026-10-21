import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { tradeSchema, type Trade, type Journal, type Market, type Setup } from './schema';
import { validateSnapshot, type Snapshot } from './snapshot';
import { tradeFacts } from '../core/trade';
import { D } from '../core/money';
export interface TradeInput {
  symbol: string;
  market: Market;
  side: 'long' | 'short';
  status: 'open' | 'closed';
  open: string;
  close: string;
  entry: string;
  exit: string;
  quantity: string;
  multiplier: string;
  risk: string;
  sl: string;
  tp: string;
  commission: string;
  tax: string;
  funding: string;
  swap: string;
  other: string;
  costsKnown: boolean;
  setupId: string;
  note: string;
}
const now = () => new Date().toISOString();
function utc(local: string, zone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw Error('INVALID_LOCAL_TIME');
  const d = fromZonedTime(local, zone);
  if (!Number.isFinite(d.getTime()) || formatInTimeZone(d, zone, "yyyy-MM-dd'T'HH:mm") !== local)
    throw Error('INVALID_LOCAL_TIME');
  return d.toISOString();
}
export function manualTrade(input: TradeInput, journal: Journal, old?: Trade): Trade {
  if (old && old.journalId !== journal.id) throw Error('CROSS_JOURNAL_REFERENCE');
  if (old && old.legs.length > 2) throw Error('MULTI_LEG_READONLY');
  const exactTime = (value: string, previous?: string) =>
    previous &&
    formatInTimeZone(new Date(previous), journal.timezone, "yyyy-MM-dd'T'HH:mm") === value
      ? previous
      : utc(value, journal.timezone);
  const open = exactTime(input.open, old?.legs[0]?.time),
    close =
      input.status === 'closed'
        ? exactTime(input.close, old?.legs.find((l) => l.kind === 'out')?.time)
        : undefined;
  if (close && close < open) throw Error('CLOSE_BEFORE_OPEN');
  const t = tradeSchema.parse({
    ...old,
    id: old?.id ?? 'manual:' + crypto.randomUUID(),
    journalId: journal.id,
    symbol: input.symbol.trim().toUpperCase(),
    market: input.market,
    side: input.side,
    status: input.status,
    legs: [
      {
        ...old?.legs[0],
        id: old?.legs[0]?.id ?? crypto.randomUUID(),
        kind: 'in',
        time: open,
        price: input.entry,
        quantity: input.quantity,
      },
      ...(close
        ? [
            {
              ...old?.legs.find((l) => l.kind === 'out'),
              id: old?.legs.find((l) => l.kind === 'out')?.id ?? crypto.randomUUID(),
              kind: 'out',
              time: close,
              price: input.exit,
              quantity: input.quantity,
            },
          ]
        : []),
    ],
    multiplier: input.multiplier || '1',
    initialRisk: input.risk || undefined,
    plannedSL: input.sl || undefined,
    plannedTP: input.tp || undefined,
    costs: {
      commission: input.commission,
      tax: input.tax,
      funding: input.funding,
      swap: input.swap,
      other: input.other,
    },
    costsKnown: input.costsKnown,
    setupId: input.setupId || undefined,
    errorTagIds: old?.errorTagIds ?? [],
    tags: old?.tags ?? [],
    starred: old?.starred ?? false,
    review: old?.review ?? { done: false },
    attachments: old?.attachments ?? [],
    customStats: old?.customStats ?? {},
    isDemo: journal.isDemo,
    createdAt: old?.createdAt ?? now(),
    updatedAt: now(),
  });
  if (
    old &&
    JSON.stringify([
      old.legs,
      old.costs,
      old.costsKnown,
      old.initialRisk,
      old.plannedSL,
      old.multiplier,
      old.side,
      old.symbol,
      old.setupId,
    ]) !==
      JSON.stringify([
        t.legs,
        t.costs,
        t.costsKnown,
        t.initialRisk,
        t.plannedSL,
        t.multiplier,
        t.side,
        t.symbol,
        t.setupId,
      ])
  )
    t.review = { done: false };
  tradeFacts(t);
  return t;
}
export function saveTrade(data: Snapshot, trade: Trade, note?: string) {
  const next = structuredClone(data);
  const index = next.trades.findIndex((t) => t.id === trade.id);
  if (index >= 0 && next.trades[index].journalId !== trade.journalId)
    throw Error('CROSS_JOURNAL_REFERENCE');
  if (index < 0) next.trades.push(trade);
  else next.trades[index] = trade;
  if (note !== undefined) {
    const previous = next.notes.find((n) => n.scope === 'trade' && n.refId === trade.id);
    if (previous) previous.body = note;
    else if (note.trim())
      next.notes.push({
        id: crypto.randomUUID(),
        journalId: trade.journalId,
        scope: 'trade',
        refId: trade.id,
        body: note,
        createdAt: now(),
      });
  }
  return validateSnapshot(next);
}
export function toggleStar(data: Snapshot, id: string) {
  const t = data.trades.find((t) => t.id === id);
  if (!t) throw Error('TRADE_NOT_FOUND');
  return saveTrade(data, { ...t, starred: !t.starred, updatedAt: now() });
}
export function reviewTrade(
  data: Snapshot,
  id: string,
  done: boolean,
  note: string,
  nothing: boolean,
) {
  const t = data.trades.find((t) => t.id === id);
  if (!t) throw Error('TRADE_NOT_FOUND');
  if (done && !note.trim() && !nothing) throw Error('REVIEW_NOTE_REQUIRED');
  if (done && (!tradeFacts(t).closeTime || !tradeFacts(t).risk || !t.costsKnown))
    throw Error('REVIEW_REQUIRES_COMPLETE_TRADE');
  const next = saveTrade(data, t);
  let n =
    next.notes.find((n) => n.id === t.review.noteId) ??
    next.notes.find((n) => n.scope === 'trade' && n.refId === id);
  if (done) {
    if (!n) {
      n = {
        id: crypto.randomUUID(),
        journalId: t.journalId,
        scope: 'trade',
        refId: id,
        body: '',
        createdAt: now(),
      };
      next.notes.push(n);
    }
    n.body = note.trim() || 'Đã kiểm tra — không có gì để ghi.';
  }
  return saveTrade(next, {
    ...t,
    review: { done, at: done ? now() : undefined, noteId: n?.id },
    updatedAt: now(),
  });
}
export { tradeLifecycle } from '../core/lifecycle';
const errors = [
  ['FOMO', 'entry'],
  ['Dời SL', 'management'],
  ['Nhồi lệnh', 'management'],
  ['Trả thù', 'entry'],
  ['Vào sớm', 'entry'],
  ['Thoát sớm', 'exit'],
  ['Quá rủi ro', 'entry'],
  ['Sai setup', 'entry'],
  ['Mất tập trung', 'management'],
] as const;
export function ensureCatalog(data: Snapshot, journalId: string) {
  const next = structuredClone(data);
  errors.forEach(([name, stage], i) => {
    const existing = next.errorTags.find((t) => t.journalId === journalId && t.name === name);
    if (existing) {
      existing.hotkey = i + 1;
    } else
      next.errorTags.push({
        id: journalId + ':error:' + name,
        journalId,
        code: name,
        name,
        stage,
        tone: 'neg',
        hotkey: i + 1,
      });
  });
  ['Hỗ trợ / Kháng cự', 'Breakout + Retest', 'Pullback xu hướng'].forEach((name) => {
    if (!next.setups.some((s) => s.journalId === journalId && s.name === name))
      next.setups.push({ id: journalId + ':setup:' + name, journalId, name, checklist: [] });
  });
  return next;
}
export function parseChecklist(
  text: string,
  previous: Setup['checklist'] = [],
): Setup['checklist'] {
  const used = new Set<string>();
  return text
    .split(/\r?\n/)
    .filter((s) => s.trim())
    .map((line, i) => {
      const [label, weight, ...extra] = line.split('|').map((s) => s.trim());
      if (!label || !weight || extra.length || !/^\d+(?:\.\d+)?$/.test(weight) || !D(weight).gt(0))
        throw Error('INVALID_CHECKLIST_LINE_' + (i + 1));
      const old = previous.find((c) => c.text === label && !used.has(c.id));
      const id = old?.id ?? crypto.randomUUID();
      used.add(id);
      return { id, text: label, weight: Number(weight) };
    });
}
