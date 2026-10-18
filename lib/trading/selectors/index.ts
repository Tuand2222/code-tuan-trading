import { D, dec, finiteNumber, sum } from '../domain/decimal';
import { costsVND } from '../domain/finance';
import type { Cycle, Dec, MetricResult, RealizedEvent, ReplayResult } from '../domain/types';
import { metricRegistry } from './metricRegistry';

export interface Filters { from?: string; to?: string; accountIds?: string[]; markets?: string[]; platforms?: string[]; exactOnly?: boolean; includeEstimatedRisk?: boolean; timezone?: string; breakevenBandVND?: Dec }
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
export function dateInZone(ts: string, timezone = 'Asia/Ho_Chi_Minh'): string {
  if (!dateFormatters.has(timezone)) dateFormatters.set(timezone, new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }));
  const parts = dateFormatters.get(timezone)!.formatToParts(new Date(ts));
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)!.value).join('-');
}
const inRange = (date: string, f: Filters) => (!f.from || date >= f.from) && (!f.to || date <= f.to);
export function selectScope(result: ReplayResult, filters: Filters = {}) {
  const allCycles = result.cycles.filter(c => !c.shadowed && (!filters.accountIds?.length || filters.accountIds.includes(c.accountId)) && (!filters.markets?.length || filters.markets.includes(c.market)) && (!filters.platforms?.length || filters.platforms.includes(c.platform)));
  const ids = new Set(allCycles.map(c => c.tradeId));
  const cycles = allCycles.filter(c => c.status === 'closed' && c.closeTsUtc && inRange(dateInZone(c.closeTsUtc, filters.timezone), filters) && (!filters.exactOnly || c.granularity === 'fill' || c.granularity === 'position'));
  // Exact-only affects trade statistics, never deletes monetary events of approximate reports.
  const events = result.events.filter(e => !e.shadowed && (e.tradeId ? ids.has(e.tradeId) : (!filters.accountIds?.length || filters.accountIds.includes(e.accountId)) && (!filters.markets?.length || !!e.market && filters.markets.includes(e.market)) && (!filters.platforms?.length || !!e.platform && filters.platforms.includes(e.platform))) && inRange(dateInZone(e.tsUtc, filters.timezone), filters));
  return { cycles, events };
}
export function validRiskTrades(cycles: Cycle[], includeEstimatedRisk = false): Cycle[] {
  return cycles.filter(c => c.netVND !== undefined && c.risk.amountVND !== undefined && D(c.risk.amountVND).gt(0) && (['initial-stop', 'user-entered'].includes(c.risk.origin) || includeEstimatedRisk && c.risk.origin === 'batch-fixed'));
}
export function rMultiple(cycle: Cycle): Dec | undefined {
  return cycle.netVND !== undefined && cycle.risk.amountVND !== undefined && D(cycle.risk.amountVND).gt(0) ? dec(D(cycle.netVND).div(D(cycle.risk.amountVND))) : undefined;
}
export function metricsVM(result: ReplayResult, filters: Filters = {}): Record<string, MetricResult<number>> {
  const { cycles, events } = selectScope(result, filters), n = cycles.length;
  const noData = (of = n, reason = 'Không có dữ liệu đủ để tính'): MetricResult<number> => ({ status: 'no-data', reason, n: 0, of });
  const ok = (value: number, count = n, of = n): MetricResult<number> => Number.isFinite(value) ? { status: 'ok', value, n: count, of } : { status: 'undefined', reason: 'Vượt giới hạn hiển thị', n: count, of };
  const unknown = cycles.some(c => c.netVND === undefined), band = D(filters.breakevenBandVND ?? '0');
  const values = cycles.map(c => c.netVND === undefined ? 0 : finiteNumber(c.netVND));
  const wins = cycles.filter(c => c.netVND !== undefined && D(c.netVND).gt(band)), losses = cycles.filter(c => c.netVND !== undefined && D(c.netVND).lt(band.neg()));
  const gp = finiteNumber(sum(wins.map(c => c.netVND!))), gl = finiteNumber(sum(losses.map(c => c.netVND!)));
  const net = gp + gl + finiteNumber(sum(cycles.filter(c => c.netVND !== undefined && D(c.netVND).abs().lte(band)).map(c => c.netVND!)));
  const risk = validRiskTrades(cycles, filters.includeEstimatedRisk), reviewed = cycles.filter(c => c.overlay?.reviewStatus === 'reviewed' && c.overlay.disciplineScore !== undefined), durations = cycles.filter(c => c.holdMinutes !== undefined);
  let current = 0, longestWin = 0, longestLoss = 0;
  for (const c of [...cycles].sort((a, b) => a.closeTsUtc!.localeCompare(b.closeTsUtc!) || (a.orderKey ?? a.tradeId).localeCompare(b.orderKey ?? b.tradeId))) {
    const sign = c.netVND === undefined || D(c.netVND).abs().lte(band) ? 0 : D(c.netVND).gt(0) ? 1 : -1;
    current = sign === 0 ? 0 : Math.sign(current) === sign ? current + sign : sign;
    longestWin = Math.max(longestWin, current); longestLoss = Math.max(longestLoss, -current);
  }
  const evKnown = events.length > 0 && events.every(e => e.netVND !== undefined);
  let equity = D('0'), peak = D('0'), dd = D('0');
  for (const e of [...events].sort((a, b) => a.tsUtc.localeCompare(b.tsUtc) || (a.orderKey ?? a.eventId).localeCompare(b.orderKey ?? b.eventId))) {
    if (e.netVND === undefined) continue;
    equity = equity.plus(D(e.netVND)); if (equity.gt(peak)) peak = equity; if (peak.minus(equity).gt(dd)) dd = peak.minus(equity);
  }
  const mean = n ? net / n : 0, sd = n ? Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n) : 0;
  const all = (v: number) => n && !unknown ? ok(v) : noData();
  const m: Record<string, MetricResult<number>> = {
    total: n ? ok(n) : noData(), winRate: all(wins.length / n * 100),
    profitFactor: !n || unknown ? noData() : gl ? ok(gp / Math.abs(gl)) : gp > 0 ? { status: 'no-losses', n, of: n } : noData(),
    averageR: risk.length ? ok(finiteNumber(sum(risk.map(c => rMultiple(c)!))) / risk.length, risk.length) : noData(),
    avgWin: !unknown && wins.length ? ok(gp / wins.length, wins.length) : noData(), avgLoss: !unknown && losses.length ? ok(gl / losses.length, losses.length) : noData(),
    expectancy: all(mean), net: evKnown ? ok(finiteNumber(dec(equity)), events.length, events.length) : noData(events.length, 'Thiếu dữ liệu P&L hoặc chi phí'),
    wins: all(wins.length), losses: all(losses.length), breakeven: all(n - wins.length - losses.length), currentStreak: all(current), longestWin: all(longestWin), longestLoss: all(longestLoss),
    maxDrawdown: evKnown && events.length >= 2 ? ok(finiteNumber(dec(dd)), events.length, events.length) : noData(events.length),
    recovery: !evKnown || events.length < 2 ? noData(events.length) : dd.isZero() ? { status: 'undefined', reason: 'Sụt giảm bằng 0', n: events.length, of: events.length } : ok(finiteNumber(dec(equity.div(dd))), events.length, events.length),
    sharpe: !n || unknown ? noData() : sd ? ok(mean / sd) : { status: 'undefined', reason: 'Độ lệch chuẩn bằng 0', n, of: n },
    avgDuration: durations.length ? ok(durations.reduce((s, c) => s + c.holdMinutes!, 0) / durations.length, durations.length) : noData(),
    biggestWin: !unknown && wins.length ? ok(wins.reduce((v, c) => Math.max(v, finiteNumber(c.netVND!)), 0), wins.length) : noData(),
    biggestLoss: !unknown && losses.length ? ok(losses.reduce((v, c) => Math.min(v, finiteNumber(c.netVND!)), 0), losses.length) : noData(),
    grossProfit: all(gp), grossLoss: all(gl), roi: risk.length ? ok(finiteNumber(dec(D(sum(risk.map(c => c.netVND!))).div(D(sum(risk.map(c => c.risk.amountVND!)))).mul('100'))), risk.length) : noData(),
    discipline: reviewed.length ? ok(reviewed.reduce((s, c) => s + c.overlay!.disciplineScore!, 0) / reviewed.length, reviewed.length) : noData(),
  };
  return Object.fromEntries(metricRegistry.map(def => [def.id, m[def.id]]));
}
export function calendarVM(result: ReplayResult, filters: Filters = {}) {
  const { events, cycles } = selectScope(result, filters), groups = new Map<string, RealizedEvent[]>();
  const closedByDate = new Map<string, Cycle[]>();
  for (const cycle of cycles) { const day = dateInZone(cycle.closeTsUtc!, filters.timezone); if (!closedByDate.has(day)) closedByDate.set(day, []); closedByDate.get(day)!.push(cycle); }
  for (const event of events) { const day = dateInZone(event.tsUtc, filters.timezone); if (!groups.has(day)) groups.set(day, []); groups.get(day)!.push(event); }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([date, es]) => ({ date, events: es, netVND: es.every(e => e.netVND !== undefined) ? sum(es.map(e => e.netVND!)) : undefined,
    closedCycles: (closedByDate.get(date) ?? []).length,
    wins: (closedByDate.get(date) ?? []).filter(c => c.netVND !== undefined && D(c.netVND).gt(filters.breakevenBandVND ?? '0')).length,
    losses: (closedByDate.get(date) ?? []).filter(c => c.netVND !== undefined && D(c.netVND).lt(D(filters.breakevenBandVND ?? '0').neg())).length,
    partial: es.some(e => e.costCompleteness !== 'complete') }));
}
export function shadowCurve(result: ReplayResult, filters: Filters = {}, threshold = 80) {
  const { events, cycles } = selectScope(result, filters);
  const violations = new Set(result.cycles.filter(c => c.overlay?.reviewStatus === 'reviewed' && (c.overlay.disciplineScore! < threshold || c.overlay.mistakeTags.length > 0)).map(c => c.tradeId));
  let actual: Dec | undefined = '0', shadow: Dec | undefined = '0';
  const points = [...events].sort((a, b) => a.tsUtc.localeCompare(b.tsUtc) || a.eventId.localeCompare(b.eventId)).map(e => {
    actual = actual !== undefined && e.netVND !== undefined ? sum([actual, e.netVND]) : undefined;
    if (!e.tradeId || !violations.has(e.tradeId)) shadow = shadow !== undefined && e.netVND !== undefined ? sum([shadow, e.netVND]) : undefined;
    return { tsUtc: e.tsUtc, eventId: e.eventId, actualVND: actual, shadowVND: shadow };
  });
  const coverage = (cs: Cycle[]) => ({ reviewed: cs.filter(c => c.overlay?.reviewStatus === 'reviewed').length, total: cs.length });
  const wins = coverage(cycles.filter(c => c.netVND !== undefined && D(c.netVND).gt(0))), losses = coverage(cycles.filter(c => c.netVND !== undefined && D(c.netVND).lt(0)));
  return { points, coverage: coverage(cycles), wins, losses, excluded: cycles.filter(c => violations.has(c.tradeId)).length,
    selectionBias: wins.total > 0 && losses.total > 0 && Math.abs(wins.reviewed / wins.total - losses.reviewed / losses.total) > 0.15,
    disclosure: 'Loại các lệnh vi phạm đã ghi nhận trong lịch sử; chưa mô phỏng tác động lên các giao dịch sau.' };
}
export function feeImpact(result: ReplayResult, filters: Filters = {}) {
  const { events } = selectScope(result, filters), costs = events.flatMap(e => e.costs);
  const known = costs.filter(c => c.amount !== undefined && c.rateToVND !== undefined);
  const total = (predicate: (c: typeof known[number]) => boolean) => costsVND(known.filter(predicate))!;
  const gross = events.length && events.every(e => e.grossVND !== undefined) ? sum(events.map(e => e.grossVND!)) : undefined;
  const netCosts = costsVND(costs), complete = events.every(e => e.costCompleteness === 'complete') && netCosts !== undefined;
  return { grossVND: gross, knownCommissionAndTaxVND: total(c => ['commission', 'tax'].includes(c.kind)),
    knownCarryingPaidVND: total(c => ['funding', 'swap', 'interest'].includes(c.kind) && D(c.amount!).gt(0)),
    knownCarryingReceivedVND: dec(D(total(c => ['funding', 'swap', 'interest'].includes(c.kind) && D(c.amount!).lt(0))).neg()),
    netCostsVND: netCosts, complete, unknownCostCount: costs.length - known.length,
    erosionPercent: complete && gross !== undefined && D(gross).gt(0) && D(netCosts!).gt(0) ? finiteNumber(dec(D(netCosts!).div(D(gross)).mul('100'))) : null };
}
export function reviewQueue(cycles: Cycle[]): Cycle[] {
  const pending = cycles.filter(c => !c.shadowed && c.status === 'closed' && c.overlay?.reviewStatus !== 'reviewed');
  const sort = (cs: Cycle[]) => cs.sort((a, b) => D(b.netVND ?? '0').abs().cmp(D(a.netVND ?? '0').abs()) || a.tradeId.localeCompare(b.tradeId));
  const loss = sort(pending.filter(c => c.netVND !== undefined && D(c.netVND).lt(0))), win = sort(pending.filter(c => c.netVND !== undefined && D(c.netVND).gt(0)));
  const out: Cycle[] = []; for (let i = 0; i < Math.max(loss.length, win.length); i++) { if (loss[i]) out.push(loss[i]); if (win[i]) out.push(win[i]); }
  return [...out, ...pending.filter(c => c.netVND === undefined || D(c.netVND).isZero()).sort((a, b) => a.tradeId.localeCompare(b.tradeId))];
}
export function setupAnalytics(result: ReplayResult, filters: Filters = {}) {
  const { cycles } = selectScope(result, filters), tags = [...new Set(cycles.map(c => c.overlay?.setupTag || 'Chưa gán setup'))];
  return tags.map(setupTag => {
    const group = cycles.filter(c => (c.overlay?.setupTag || 'Chưa gán setup') === setupTag), ids = new Set(group.map(c => c.tradeId));
    const metrics = metricsVM({ ...result, cycles: group, events: result.events.filter(e => e.tradeId && ids.has(e.tradeId)) }, filters);
    return { setupTag, tradeCount: group.length, reviewedCount: group.filter(c => c.overlay?.reviewStatus === 'reviewed').length, validRiskCount: validRiskTrades(group, filters.includeEstimatedRisk).length,
      winRate: metrics.winRate, profitFactor: metrics.profitFactor, expectancyR: metrics.averageR, sampleStatus: group.length >= 20 ? 'Đạt ngưỡng mẫu tối thiểu' : 'Chưa đủ mẫu (<20 lệnh)' };
  });
}
