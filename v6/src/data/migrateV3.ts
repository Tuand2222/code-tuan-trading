import { verifyGolden } from '../core/golden';
import { z } from 'zod';
import { snapshotSchema as v3Schema } from './legacy-v3/types';
import { replayBook } from './legacy-v3/replayBook';
import { canonical, sha256 } from './backup';
import { emptySnapshot, validateSnapshot, type Snapshot } from './snapshot';
import { tradeSchema, journalSchema, type Trade } from './schema';
import { D, dec, sum } from '../core/money';
import { tradeFacts } from '../core/trade';
const envelope = z
  .object({
    schemaVersion: z.literal(3),
    exportedAt: z.string().datetime(),
    data: v3Schema,
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export async function migrateV3(raw: string): Promise<{
  data: Snapshot;
  sourceChecksum: string;
  report: { trades: number; journals: number; warnings: string[] };
}> {
  if (new TextEncoder().encode(raw).length > 100 * 1024 * 1024) throw Error('BACKUP_TOO_LARGE');
  const e = envelope.parse(JSON.parse(raw)),
    { checksum, ...body } = e;
  if (checksum !== (await sha256(canonical(body)))) throw Error('CHECKSUM_MISMATCH');
  const output = emptySnapshot();
  output.sources.push({ id: await sha256(raw), raw, createdAt: e.exportedAt });
  // Migration-only v3 reader is vendored unchanged to interpret the original
  // accounting and IDs. Runtime v6 UI never calls its metric/replay functions.
  for (const a of e.data.accounts) {
    if (
      !['VND', 'USD', 'USDT'].includes(a.quoteCcy) ||
      a.quoteCcy !== a.baseCcy ||
      a.pnlModel !== 'linear' ||
      a.openingBalances.length
    )
      throw Error('V3_ACCOUNT_NOT_LOSSLESS:' + a.accountId);
    if (e.data.cashEvents.some((c) => c.accountId === a.accountId && c.active))
      throw Error('V3_CASH_EVENT_REQUIRES_REPRESENTATION');
    const result = await replayBook(
      e.data.fills,
      a,
      e.data.batches,
      [],
      e.data.overlays,
      e.data.settings.sourcePreferences && typeof e.data.settings.sourcePreferences === 'object'
        ? ((e.data.settings.sourcePreferences as Record<string, 'prefer-fills' | 'prefer-reports'>)[
            a.accountId
          ] ?? 'confirm-overlaps')
        : 'confirm-overlaps',
    );
    if (
      result.anomalies.some((x) => x.severity !== 'info') ||
      result.cycles.some((c) => c.shadowed || c.status === 'incomplete')
    )
      throw Error('V3_REPLAY_REQUIRES_REVIEW:' + a.accountId);
    const journalId = 'v3:' + a.accountId,
      isDemo =
        a.label.startsWith('MINH HỌA') &&
        e.data.batches.some((b) => b.accountId === a.accountId && b.connector === 'demo-30');
    output.journals.push(
      journalSchema.parse({
        id: journalId,
        name: a.label,
        currency: a.quoteCcy,
        timezone: a.sourceTimezone,
        isDemo,
        settings: {},
        createdAt: e.exportedAt,
        schemaVersion: 4,
      }),
    );
    for (const c of result.cycles) {
      if (
        c.grossSource !== 'computed' ||
        c.adjustments?.length ||
        !c.openTsUtc ||
        !c.legs.length ||
        c.reconciliation === 'mismatch'
      )
        throw Error('V3_TRADE_NOT_LOSSLESS:' + c.tradeId);
      const setupId = c.overlay?.setupTag ? journalId + ':setup:' + c.overlay.setupTag : undefined;
      if (setupId && !output.setups.some((s) => s.id === setupId))
        output.setups.push({ id: setupId, journalId, name: c.overlay!.setupTag!, checklist: [] });
      const errorTagIds = (c.overlay?.mistakeTags ?? []).map((name) => {
        const id = journalId + ':error:' + name;
        if (!output.errorTags.some((t) => t.id === id))
          output.errorTags.push({
            id,
            journalId,
            code: name,
            name,
            stage: ['Dời SL', 'Nhồi lệnh', 'Mất tập trung'].includes(name)
              ? 'management'
              : name === 'Thoát sớm'
                ? 'exit'
                : 'entry',
            tone: 'neg',
          });
        return id;
      });
      const costs: Trade['costs'] = {
        commission: '0',
        tax: '0',
        funding: '0',
        swap: '0',
        other: '0',
      };
      for (const cost of c.costs) {
        if (cost.ccy !== a.quoteCcy && cost.amount !== undefined)
          throw Error('V3_COST_CURRENCY_NOT_LOSSLESS');
        if (cost.amount !== undefined) {
          const kind = cost.kind === 'interest' ? 'other' : cost.kind;
          costs[kind] = sum([costs[kind], cost.amount]);
        }
      }
      let initialRisk = c.risk.amountVND;
      if (initialRisk && a.quoteCcy !== 'VND') {
        const rates = e.data.batches
          .filter((b) => c.sourceBatchIds.includes(b.batchId))
          .flatMap((b) => b.fx.filter((f) => f.ccy === a.quoteCcy).map((f) => f.rateToVND));
        if (!rates.length || new Set(rates).size !== 1) throw Error('V3_RISK_FX_AMBIGUOUS');
        initialRisk = dec(D(initialRisk).div(D(rates[0])));
      }
      const noteId = c.overlay?.notes ? c.tradeId + ':note' : undefined;
      if (noteId)
        output.notes.push({
          id: noteId,
          journalId,
          scope: 'trade',
          refId: c.tradeId,
          body: c.overlay!.notes!,
          createdAt: c.overlay!.updatedAt,
        });
      const trade = tradeSchema.parse({
        id: c.tradeId,
        journalId,
        symbol: c.symbol,
        market:
          a.market === 'stock' ? 'stocks' : a.market === 'commodity' ? 'commodities' : a.market,
        side: c.direction === 'LONG' ? 'long' : 'short',
        status: c.status,
        legs: c.legs.map((l, i) => ({
          id: l.fillId + ':' + i,
          kind: l.role === 'open' ? 'in' : 'out',
          time: new Date(l.tsUtc).toISOString(),
          price: l.price,
          quantity: l.qty,
          synthetic: e.data.fills.find((f) => f.fillId === l.fillId)?.synthetic !== undefined,
        })),
        multiplier: a.contractMultiplier,
        initialRisk,
        costs,
        costsKnown: c.costCompleteness === 'complete',
        setupId,
        errorTagIds,
        disciplineLegacy: c.overlay?.disciplineScore,
        tags: ['legacy-v3', ...c.sourceBatchIds.map((id) => 'v3-batch:' + id)],
        starred: false,
        review: { done: c.overlay?.reviewStatus === 'reviewed', noteId },
        attachments: [],
        customStats: {},
        isDemo,
        createdAt: c.openTsUtc,
        updatedAt: c.overlay?.updatedAt ?? c.closeTsUtc ?? e.exportedAt,
      });
      const computed = tradeFacts(trade);
      if (!D(computed.gross).eq(c.gross ?? '0') || computed.net !== c.net)
        throw Error('V3_FINANCE_NOT_LOSSLESS:' + c.tradeId);
      // Fail closed if daily P&L changes (partial exits or time-varying costs).
      const oldEvents = result.events.filter((ev) => ev.tradeId === c.tradeId),
        days = new Set([
          ...oldEvents.map((ev) => ev.tsUtc),
          ...computed.events.map((ev) => ev.time),
        ]);
      for (const time of days) {
        const old = oldEvents.filter((ev) => ev.tsUtc === time),
          fresh = computed.events.filter((ev) => ev.time === time);
        if (
          old.some((ev) => ev.net === undefined) !== fresh.some((ev) => ev.net === undefined) ||
          !D(sum(old.map((ev) => ev.net ?? '0'))).eq(sum(fresh.map((ev) => ev.net ?? '0')))
        )
          throw Error('V3_EVENT_TIMING_NOT_LOSSLESS:' + c.tradeId);
      }
      output.trades.push(trade);
    }
  }
  // Preserve every raw field and original batch/overlay linkage in the immutable
  // source backup stored by the repository; tags provide cross-reference IDs.
  for (const j of output.journals)
    if (
      j.isDemo &&
      output.trades.filter((t) => t.journalId === j.id).length === 30 &&
      !verifyGolden(j, output.trades).pass
    )
      throw Error('GOLDEN_MISMATCH');
  return {
    data: validateSnapshot(output),
    sourceChecksum: checksum,
    report: {
      trades: output.trades.length,
      journals: output.journals.length,
      warnings: ['ORIGINAL_V3_PRESERVED', 'HOLDING_MINUTES_FROM_TIMESTAMPS'],
    },
  };
}
