import Papa from 'papaparse';
import { z } from 'zod';
import { tradeSchema, type Journal } from './schema';
import { canonical, sha256 } from './backup';
import { validateSnapshot, type Snapshot } from './snapshot';
import { tradeFacts } from '../core/trade';
import { D } from '../core/money';

// Position reports only: fills/income reports need a different adapter.
export async function previewBinance(raw: string, journal: Journal, basis: 'gross' | 'net') {
  if (journal.currency !== 'USDT') throw Error('BINANCE_REQUIRES_USDT_JOURNAL');
  if (new TextEncoder().encode(raw).length > 20 * 1024 * 1024) throw Error('IMPORT_TOO_LARGE');
  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
  });
  if (parsed.errors.length || !parsed.data.length || parsed.data.length > 10000)
    throw Error('INVALID_CSV');
  const batchId = 'binance:' + (await sha256(journal.id + '\n' + raw));
  const trades = [];
  for (const row of parsed.data) {
    const get = (keys: string[]) => keys.map((k) => row[k]?.trim()).find(Boolean);
    const required = (keys: string[]) => {
      const v = get(keys);
      if (!v) throw Error('MISSING_COLUMN_OR_VALUE:' + keys[0]);
      return v;
    };
    const time = (keys: string[]) => {
      const v = required(keys); // Binance report times are explicitly interpreted as UTC.
      const iso = /Z$|[+-]\d\d:\d\d$/.test(v) ? v : v.replace(' ', 'T') + 'Z';
      z.iso.datetime({ offset: true }).parse(iso);
      const date = new Date(iso);
      if (!Number.isFinite(date.getTime())) throw Error('INVALID_TIME');
      return date.toISOString();
    };
    const side = required(['Position Side', 'PositionSide']).toUpperCase();
    if (!['LONG', 'SHORT'].includes(side)) throw Error('AMBIGUOUS_POSITION_SIDE');
    const externalId = required(['Position ID', 'Position']);
    const entryFillId = required(['Entry Fill ID']),
      exitFillId = required(['Exit Fill ID']);
    if (required(['Entry Fill Count']) !== '1' || required(['Exit Fill Count']) !== '1')
      throw Error('AGGREGATED_POSITION_REQUIRES_FILL_HISTORY');
    if (!required(['Symbol', 'Contract']).toUpperCase().endsWith('USDT'))
      throw Error('NON_LINEAR_USDT_CONTRACT');
    const costsKnown = ['Commission', 'Funding', 'Swap', 'Tax', 'Other'].every(
      (k) => get([k]) !== undefined,
    );
    const cost = (key: string) => get([key]) ?? '0';
    const id = 'binance-position:' + (await sha256(journal.id + '\n' + externalId));
    const now = new Date().toISOString();
    const trade = tradeSchema.parse({
      id,
      journalId: journal.id,
      symbol: required(['Symbol', 'Contract']).toUpperCase(),
      market: 'crypto',
      side: side === 'LONG' ? 'long' : 'short',
      status: 'closed',
      legs: [
        {
          id: id + ':in:' + entryFillId,
          kind: 'in',
          time: time(['Open Time', 'Opening Time']),
          price: required(['Entry Price']),
          quantity: required(['Closed Quantity', 'Closing Quantity']),
        },
        {
          id: id + ':out:' + exitFillId,
          kind: 'out',
          time: time(['Close Time', 'Closing Time']),
          price: required(['Avg Close Price', 'Close Price']),
          quantity: required(['Closed Quantity', 'Closing Quantity']),
        },
      ],
      costs: {
        commission: cost('Commission'),
        funding: cost('Funding'),
        swap: cost('Swap'),
        tax: cost('Tax'),
        other: cost('Other'),
      },
      costsKnown,
      tags: ['binance-position-history'],
      errorTagIds: [],
      starred: false,
      review: { done: false },
      attachments: [],
      customStats: {},
      isDemo: journal.isDemo,
      createdAt: now,
      updatedAt: now,
      importBatchId: batchId,
    });
    const facts = tradeFacts(trade);
    const reported = get(['Closing PNL', 'Realized PNL']);
    if (reported !== undefined) {
      const expected = basis === 'gross' ? facts.gross : facts.net;
      if (expected === undefined || !D(expected).eq(D(reported)))
        throw Error('REPORTED_PNL_NOT_LOSSLESS:' + externalId);
    }
    if (required(['Fee Coin', 'Commission Asset']).toUpperCase() !== journal.currency)
      throw Error('FEE_FX_REQUIRED');
    trades.push(trade);
  }
  if (new Set(trades.map((t) => t.id)).size !== trades.length) throw Error('DUPLICATE_POSITION_ID');
  return { trades, batchId, raw, journalId: journal.id };
}
type Preview = Awaited<ReturnType<typeof previewBinance>>;
const economic = (t: Preview['trades'][number]) =>
  canonical({ ...t, createdAt: undefined, updatedAt: undefined, importBatchId: undefined });
export function commitBinance(data: Snapshot, preview: Preview, fileName: string) {
  if (data.batches.some((b) => b.id === preview.batchId)) return data;
  const fresh = preview.trades.filter((t) => {
    const old = data.trades.find((x) => x.id === t.id);
    if (old && economic(old) !== economic(t)) throw Error('IMPORT_ID_CONFLICT:' + t.id);
    return !old;
  });
  if (!fresh.length) return data;
  return validateSnapshot({
    ...data,
    trades: [...data.trades, ...fresh],
    sources: data.sources.some((s) => s.id === preview.batchId)
      ? data.sources
      : [
          ...data.sources,
          { id: preview.batchId, raw: preview.raw, createdAt: new Date().toISOString() },
        ],
    batches: [
      ...data.batches,
      {
        id: preview.batchId,
        journalId: preview.journalId,
        platform: 'BINANCE',
        fileName,
        at: new Date().toISOString(),
        tradeIds: fresh.map((t) => t.id),
        stats: { added: fresh.length, skipped: preview.trades.length - fresh.length, errors: 0 },
      },
    ],
  });
}
export function rollbackBinance(data: Snapshot, batchId: string) {
  const batch = data.batches.find((b) => b.id === batchId && b.platform === 'BINANCE');
  if (!batch) throw Error('BATCH_NOT_FOUND');
  const ids = new Set(batch.tradeIds);
  if (
    data.trades.some(
      (t) =>
        ids.has(t.id) &&
        (t.updatedAt !== t.createdAt ||
          t.review.done ||
          t.starred ||
          t.setupId ||
          t.tags.some((x) => x !== 'binance-position-history')),
    )
  )
    throw Error('BATCH_HAS_USER_CHANGES');
  // Referential validation also refuses removing trades referenced by user notes/plans.
  return validateSnapshot({
    ...data,
    trades: data.trades.filter((t) => !ids.has(t.id)),
    batches: data.batches.filter((b) => b.id !== batchId),
  });
}
