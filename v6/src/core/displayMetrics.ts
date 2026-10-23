import type { analyze, Metric } from './analyze';
import type { Journal } from '../data/schema';
import { D, dec, sum } from './money';
import type { FormatKind } from '../ui/format';
export function displayMetric(
  id: string,
  metric: Metric,
  result: ReturnType<typeof analyze>,
  journal: Journal,
  kind: FormatKind,
) {
  const unit = journal.settings.displayUnit;
  if (kind !== 'money' || unit === 'money') return { metric, kind };
  if (unit === 'percent')
    return {
      kind: 'percent' as const,
      metric: {
        ...metric,
        value:
          metric.value !== null && journal.startingBalance && D(journal.startingBalance).gt(0)
            ? dec(D(metric.value).div(journal.startingBalance).mul(100))
            : null,
      },
    };
  const closed = result.closed,
    known = closed.every((f) => f.r !== undefined),
    valid = closed.filter((f) => f.r !== undefined),
    wins = closed.filter((f) => f.net !== undefined && D(f.net).gt(0)),
    losses = closed.filter((f) => f.net !== undefined && D(f.net).lt(0));
  const total = (fs: typeof closed) =>
    fs.length && fs.every((f) => f.r !== undefined) ? sum(fs.map((f) => f.r!)) : null;
  const average = (fs: typeof closed) => {
    const value = total(fs);
    return value === null ? null : dec(D(value).div(fs.length));
  };
  const facts = new Map([...result.closed, ...result.open].map((f) => [f.id, f]));
  let equity = D('0'),
    peak = D('0'),
    dd = D('0'),
    eventKnown = true;
  for (const e of result.events) {
    const f = facts.get(e.tradeId);
    if (e.net === undefined || !f?.risk) {
      eventKnown = false;
      continue;
    }
    equity = equity.plus(D(e.net).div(f.risk));
    if (equity.gt(peak)) peak = equity;
    const draw = peak.minus(equity);
    if (draw.gt(dd)) dd = draw;
  }
  let value: string | null = null;
  if (id === 'net') value = eventKnown && result.events.length ? dec(equity) : null;
  if (id === 'maxDrawdown') value = eventKnown && result.events.length >= 2 ? dec(dd) : null;
  if (id === 'expectancy') value = known ? average(closed) : null;
  if (id === 'avgWin') value = average(wins);
  if (id === 'avgLoss') value = average(losses);
  if (id === 'grossProfit') value = total(wins);
  if (id === 'grossLoss') value = total(losses);
  if (id === 'biggestWin' || id === 'biggestLoss') {
    const selected = id === 'biggestWin' ? wins : losses;
    if (selected.length) {
      const f = selected.reduce((a, b) =>
        id === 'biggestWin' ? (D(a.net!).gt(b.net!) ? a : b) : D(a.net!).lt(b.net!) ? a : b,
      );
      value = f.r ?? null;
    }
  }
  return { kind: 'R' as const, metric: { ...metric, value, n: valid.length, of: closed.length } };
}
