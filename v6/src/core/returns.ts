import type { Journal, Trade, CashFlow } from '../data/schema';
import { analyze, dayInZone } from './analyze';
import { capitalReport } from './capital';
import { D, dec } from './money';
export function dailyReturns(journal: Journal, trades: Trade[], flows: CashFlow[]) {
  const result = analyze(journal, trades, {}, [], { inference: false }),
    capital = capitalReport(journal, trades, flows, result),
    days = new Map<string, { before: string | null; after: string | null }>(),
    dates = new Map<string, string>();
  let prior: string | null = '0';
  for (const p of capital.points) {
    let day = dates.get(p.time);
    if (!day) {
      day = dayInZone(p.time, journal.timezone);
      dates.set(p.time, day);
    }
    const group = days.get(day);
    if (group) group.after = p.twrPercent;
    else days.set(day, { before: prior, after: p.twrPercent });
    prior = p.twrPercent;
  }
  return new Map(
    [...days].map(([day, v]) => [
      day,
      v.before === null || v.after === null || D(v.before).lte('-100')
        ? null
        : dec(D(v.after).div(100).plus(1).div(D(v.before).div(100).plus(1)).minus(1).mul(100)),
    ]),
  );
}
