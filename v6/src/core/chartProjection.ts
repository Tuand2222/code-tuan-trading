import type { analyze } from './analyze';
import type { Journal, Trade, CashFlow } from '../data/schema';
import { capitalReport } from './capital';
import { tradeFacts } from './trade';
import { D, dec } from './money';
export function projectCurve(
  journal: Journal,
  trades: Trade[],
  result: ReturnType<typeof analyze>,
  unit: 'money' | 'percent' | 'R',
  flows: CashFlow[] = [],
) {
  if (unit === 'money') return result.curve;
  if (unit === 'percent' && flows.length) {
    const report = capitalReport(journal, trades, flows, result),
      byId = new Map(report.points.map((p) => [p.tradeId + '|' + p.id, p.twrPercent]));
    return result.curve.map((p, i) => ({
      ...p,
      net: byId.get(result.events[i].tradeId + '|' + result.events[i].id) ?? null,
      shadow: null,
    }));
  }
  if (unit === 'percent')
    return result.curve.map((p) => ({
      ...p,
      net:
        journal.startingBalance && D(journal.startingBalance).gt(0) && p.net !== null
          ? dec(D(p.net).div(journal.startingBalance).mul(100))
          : null,
      shadow:
        journal.startingBalance && D(journal.startingBalance).gt(0) && p.shadow !== null
          ? dec(D(p.shadow).div(journal.startingBalance).mul(100))
          : null,
    }));
  const facts = new Map(
    trades.filter((t) => t.journalId === journal.id).map((t) => [t.id, tradeFacts(t)]),
  );
  let real = D('0'),
    shadow = D('0'),
    unknown = false,
    shadowUnknown = false;
  return result.curve.map((p, i) => {
    const e = result.events[i],
      f = facts.get(p.tradeId);
    const violation =
      !!f &&
      f.trade.review.done &&
      ((f.trade.disciplineLegacy ?? 100) < 80 || f.trade.errorTagIds.length > 0);
    const r = e.net !== undefined && f?.risk ? D(e.net).div(f.risk) : undefined;
    if (!r) unknown = true;
    else real = real.plus(r);
    if (!violation) {
      if (!r) shadowUnknown = true;
      else shadow = shadow.plus(r);
    }
    return { ...p, net: unknown ? null : dec(real), shadow: shadowUnknown ? null : dec(shadow) };
  });
}
