import { replayLedger } from './replayLedger';
import type { LedgerSnapshot, ReplayResult } from '../domain/types';
import { canonicalJSON } from '../domain/identity';
import { metricsVM, calendarVM, shadowCurve, feeImpact, selectScope, type Filters } from '../selectors';
import { weeklyReview } from '../selectors/weeklyReview';
import { inference } from '../selectors/inference';
import { riskReport } from '../selectors/riskReport';
import { type SessionRule, tradeDims } from '../selectors/dimensions';

export type Derived = { weekly: ReturnType<typeof weeklyReview>; riskReport: ReturnType<typeof riskReport>; result: ReplayResult; metrics: ReturnType<typeof metricsVM>; calendar: ReturnType<typeof calendarVM>; shadow: ReturnType<typeof shadowCurve>; fees: ReturnType<typeof feeImpact>; overall: ReturnType<typeof inference>;
  edge: Record<string, { label: string; count: number; reviewed: number; stats: ReturnType<typeof inference>; metrics: ReturnType<typeof metricsVM> }[]>;
  monitor: { window: number; count: number; stats: ReturnType<typeof inference>; metrics: ReturnType<typeof metricsVM> }[] };

// Worker owns derived data. Unchanged account books reuse their replay result;
// account-level invalidation also covers cash allocation and report overlap rules.
const accountCache = new Map<string, { key: string; result: ReplayResult }>();
let cacheKey = '', cache: unknown;
export async function deriveLedger(ledger: LedgerSnapshot, version: number, filters: Filters = {}) {
    const key = canonicalJSON([version, ledger, filters]);
    if (key !== cacheKey) {
      const parts: ReplayResult[] = [];
      for (const account of ledger.accounts) {
        const subset = { ...ledger, accounts: [account], fills: ledger.fills.filter(f => f.accountId === account.accountId), cashEvents: ledger.cashEvents.filter(f => f.accountId === account.accountId), batches: ledger.batches.filter(b => b.accountId === account.accountId) };
        const signature = canonicalJSON(subset), old = accountCache.get(account.accountId);
        const result = old?.key === signature ? old.result : await replayLedger(subset);
        accountCache.set(account.accountId, { key: signature, result }); parts.push(result);
      }
      for (const id of accountCache.keys()) if (!ledger.accounts.some(a => a.accountId === id)) accountCache.delete(id);
      const result: ReplayResult = { cycles: parts.flatMap(p => p.cycles), events: parts.flatMap(p => p.events), openPositions: parts.flatMap(p => p.openPositions), anomalies: parts.flatMap(p => p.anomalies) };
      const scope = selectScope(result, filters), minimum = Number(ledger.settings.minimumSample ?? 20), band = Number(filters.breakevenBandVND ?? 0);
      const infer = (cs: typeof scope.cycles) => inference(cs, filters.includeEstimatedRisk, minimum, band);
      const weekdayFormatter=new Intl.DateTimeFormat('vi',{weekday:'long',timeZone:filters.timezone??'Asia/Ho_Chi_Minh'});
      const dimensions = ['setup', 'market', 'rootSymbol', 'direction', 'platform', 'weekday', 'hold', 'session'] as const;
      const edge = Object.fromEntries(dimensions.map(dimension => {
        const groups = new Map<string, typeof scope.cycles>();
        for (const c of scope.cycles) {
          const dims=tradeDims(c,filters.timezone,filters.breakevenBandVND,(ledger.settings.sessions ?? []) as SessionRule[]);
          const name = dimension === 'session' ? dims.session ?? 'Chưa rõ' : dimension === 'setup' ? c.overlay?.setupTag || 'Chưa gán setup' : dimension === 'weekday' ? weekdayFormatter.format(new Date(c.closeTsUtc!)) : dimension === 'hold' ? c.holdMinutes === undefined ? 'Chưa rõ' : c.holdMinutes < 60 ? '<1 giờ' : c.holdMinutes < 1440 ? '1–24 giờ' : '≥1 ngày' : c[dimension];
          if (!groups.has(name)) groups.set(name, []); groups.get(name)!.push(c);
        }
        return [dimension, [...groups].map(([label, cs]) => ({ label, count: cs.length, reviewed: cs.filter(c => c.overlay?.reviewStatus === 'reviewed').length, stats: infer(cs), metrics: metricsVM({ ...result, cycles: cs, events: [] }, filters) }))];
      }));
      const ordered = [...scope.cycles].sort((a,b) => a.closeTsUtc!.localeCompare(b.closeTsUtc!) || a.tradeId.localeCompare(b.tradeId));
      cache = { weekly:weeklyReview(result,filters), result, riskReport: riskReport(result,filters), metrics: metricsVM(result, filters), calendar: calendarVM(result, filters), shadow: shadowCurve(result, filters, Number(ledger.settings.disciplineThreshold ?? 80)), fees: feeImpact(result, filters), edge,
        monitor: [20, 50, 100].map(window => ({ window, count: Math.min(window, ordered.length), stats: infer(ordered.slice(-window)), metrics: metricsVM({ ...result, cycles: ordered.slice(-window), events: [] }, filters) })), overall: infer(scope.cycles) };
      cacheKey = key;
    }
    return cache as Derived;
}
