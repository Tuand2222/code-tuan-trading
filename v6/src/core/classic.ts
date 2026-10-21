import type { Journal, Trade } from '../data/schema';
import type { Filters } from './filters';
import { selectTrades } from './filters';
import { analyze, dayInZone } from './analyze';
import { D, dec, sum, number } from './money';
import { formatValue, type FormatKind } from '../ui/format';
import vi from '../i18n/vi.json';
export interface ClassicSource {
  journal: Journal;
  trades: Trade[];
}
export function classicReport(
  source: ClassicSource,
  filters: Filters,
  capital: number,
  dailyPct = 5,
  maximumPct = 10,
) {
  const { journal } = source;
  const selected = selectTrades(source.trades, filters, journal.id),
    r = analyze(journal, selected, {
      from: filters.from || undefined,
      to: filters.to || undefined,
    });
  const val = (key: string) =>
    r.metrics[key].value === null ? null : number(r.metrics[key].value!);
  const totalRisk = sum(r.closed.filter((f) => f.risk && f.net !== undefined).map((f) => f.risk!));
  let riskNet = D('0'),
    balance = D(String(capital)),
    peak = balance,
    low = balance,
    dd = D('0');
  const maximumAmount = (capital * maximumPct) / 100,
    dailyLimitAmount = (capital * dailyPct) / 100;
  const rows = r.days.map((day) => {
    const cs = r.closed.filter((f) => dayInZone(f.closeTime!, journal.timezone) === day.date),
      es = r.events.filter((e) => dayInZone(e.time, journal.timezone) === day.date);
    const startBalance = number(dec(balance));
    let dayLow = balance;
    for (const e of es) {
      if (e.net === undefined) continue;
      balance = balance.plus(e.net);
      if (balance.gt(peak)) peak = balance;
      if (balance.lt(low)) low = balance;
      if (balance.lt(dayLow)) dayLow = balance;
      if (peak.minus(balance).gt(dd)) dd = peak.minus(balance);
    }
    riskNet = riskNet.plus(sum(cs.filter((f) => f.risk && f.net !== undefined).map((f) => f.net!)));
    return {
      date: day.date,
      trades: cs.length,
      buys: cs.filter((f) => f.trade.side === 'long').length,
      sells: cs.filter((f) => f.trade.side === 'short').length,
      riskPercent: D(totalRisk).gt(0) ? number(dec(riskNet.div(totalRisk).mul(100))) : undefined,
      pnl: day.net === null ? 0 : number(day.net),
      risk: number(sum(cs.filter((f) => f.risk).map((f) => f.risk!))),
      riskCount: cs.filter((f) => f.risk).length,
      fees: es.every((e) => e.net !== undefined) ? number(sum(es.map((e) => e.cost))) : undefined,
      startBalance,
      endBalance: number(dec(balance)),
      lowestBalance: number(dec(dayLow)),
      dailyDrawdown: Math.max(0, startBalance - number(dec(dayLow))),
      maxLossLimit: capital - maximumAmount,
    };
  });
  const symbols = [...new Set(r.closed.map((f) => f.trade.symbol))]
    .map((symbol) => {
      const fs = r.closed.filter((f) => f.trade.symbol === symbol);
      return {
        symbol,
        trades: fs.length,
        wins: fs.filter((f) => f.net !== undefined && D(f.net).gt(0)).length,
        pnl: number(sum(fs.map((f) => f.net ?? '0'))),
      };
    })
    .sort((a, b) => b.pnl - a.pnl);
  const absoluteSum = rows.reduce((s, d) => s + Math.abs(d.pnl), 0),
    largest = Math.max(0, ...rows.map((d) => Math.abs(d.pnl)));
  return {
    metrics: r.metrics,
    ordered: r.closed.map((f) => ({
      ...f,
      platform: f.trade.tags.includes('legacy-v3') ? 'v3' : 'manual',
    })),
    rows,
    symbols,
    riskCount: r.closed.filter((f) => f.risk).length,
    reviewedCount: r.closed.filter((f) => f.trade.review.done).length,
    complete: r.events.every((e) => e.net !== undefined),
    balance: number(dec(balance)),
    net: val('net') ?? 0,
    maximumDrawdown: number(dec(dd)),
    dailyLimitAmount,
    maximumAmount,
    currentMaxLossLimit: capital - maximumAmount,
    maxLossUsed: Math.max(0, capital - number(dec(low))),
    anyDailyBreach: rows.some((d) => d.dailyDrawdown > dailyLimitAmount),
    anyMaximumBreach: number(dec(low)) < capital - maximumAmount,
    worstDailyDrawdown: Math.max(0, ...rows.map((d) => d.dailyDrawdown)),
    bestDay: Math.max(0, ...rows.map((d) => d.pnl)),
    consistency: absoluteSum ? (1 - largest / absoluteSum) * 100 : undefined,
    stats: Object.entries(r.metrics).map(([id, m]) => [
      vi.metricLabels[id as keyof typeof vi.metricLabels],
      formatValue(
        m.value,
        vi.metricHelp[id as keyof typeof vi.metricHelp].kind as FormatKind,
        journal.currency,
      ),
    ]),
  };
}
export function classicYear(
  year: number,
  source: ClassicSource,
  filters: Filters,
  capital: number,
) {
  const from = [filters.from, `${year}-01-01`].filter(Boolean).sort().at(-1)!,
    to = [filters.to, `${year}-12-31`].filter(Boolean).sort()[0]!,
    f = { ...filters, from, to };
  const selected = selectTrades(source.trades, f, source.journal.id),
    r = analyze(source.journal, selected, f),
    report = classicReport(source, f, capital);
  const val = (id: string) => (r.metrics[id].value === null ? null : number(r.metrics[id].value!));
  const risks = r.closed
      .filter((f) => f.r !== undefined)
      .map((f) => number(f.r!))
      .sort((a, b) => b - a),
    mean = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);
  const gain = mean(risks.filter((v) => v > 0)),
    loss = mean(risks.filter((v) => v < 0)),
    topN = Math.ceil(risks.length * 0.15),
    top = risks.slice(0, topN).reduce((s, v) => s + v, 0),
    bottom = risks.slice(topN),
    bottomTotal = bottom.reduce((s, v) => s + v, 0),
    profit = val('grossProfit'),
    net = val('net'),
    dd = val('maxDrawdown');
  const topCash = r.closed.every((f) => f.net !== undefined)
    ? r.closed
        .map((f) => number(f.net!))
        .sort((a, b) => b - a)
        .slice(0, Math.ceil(r.closed.length * 0.15))
        .reduce((s, v) => s + Math.max(0, v), 0)
    : null;
  return {
    year,
    hasData: !!r.events.length,
    total: r.closed.length,
    net,
    winRate: val('winRate'),
    avgGainR: gain,
    avgLossR: loss,
    winLossRatio: gain !== null && loss !== null && loss !== 0 ? Math.abs(gain / loss) : null,
    returnPercent: net === null ? null : (net / capital) * 100,
    profitFactor: r.metrics.profitFactor.reason === 'no-losses' ? Infinity : val('profitFactor'),
    expectedR: val('averageR'),
    top15Share: profit !== null && profit > 0 && topCash !== null ? (topCash / profit) * 100 : null,
    bottomR: mean(bottom),
    paretoRatio: bottomTotal ? Math.abs(top / bottomTotal) : null,
    maxDrawdownPercent: dd === null ? null : (dd / capital) * 100,
    recoveryFactor: val('recovery'),
    discipline: val('discipline'),
    riskCount: risks.length,
    reviewedCount: report.reviewedCount,
  };
}
