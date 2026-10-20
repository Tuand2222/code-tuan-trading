import expected from '../../tests/golden/golden.expected.json';
import { analyze } from './analyze';
import { D } from './money';
import type { Journal, Trade } from '../data/schema';
export function verifyGolden(journal: Journal, trades: Trade[], result = analyze(journal, trades)) {
  const checks: { id: string; actual: string | null; expected: string; pass: boolean }[] = [];
  const check = (
    id: string,
    actual: string | number | null | undefined,
    target: number,
    tolerance = 0.005,
  ) =>
    checks.push({
      id,
      actual: actual === undefined || actual === null ? null : String(actual),
      expected: String(target),
      pass:
        actual !== null &&
        actual !== undefined &&
        D(String(actual)).minus(String(target)).abs().lte(String(tolerance)),
    });
  for (const [id, target] of Object.entries(expected.summary))
    if (result.metrics[id])
      check(
        id,
        result.metrics[id].value,
        target,
        [
          'total',
          'wins',
          'losses',
          'breakeven',
          'currentStreak',
          'longestWin',
          'longestLoss',
        ].includes(id)
          ? 0
          : ['winRate', 'discipline'].includes(id)
            ? 0.05
            : [
                  'grossProfit',
                  'grossLoss',
                  'avgWin',
                  'avgLoss',
                  'net',
                  'expectancy',
                  'maxDrawdown',
                  'biggestWin',
                  'biggestLoss',
                ].includes(id)
              ? 0.5
              : 0.005,
      );
  check('currentDrawdown', result.currentDrawdown, expected.summary.currentDrawdown, 0);
  check('meanRisk', result.meanRisk, expected.summary.meanRisk, 0.5);
  check('top5Share', result.top5ProfitShare, expected.summary.top5ProfitShare, 0.05);
  check(
    'holdingMinutes',
    result.metrics.avgDuration.value,
    expected.holding.observedMeanMinutes,
    0.000000001,
  );
  check('feeGross', result.fees.gross, expected.fees.gross, 0);
  check('feeCost', result.fees.cost, expected.fees.commissionAndTax, 0);
  check('erosion', result.fees.erosion, expected.fees.erosionPercent, 0.05);
  expected.months.forEach((m) => {
    const actual = result.months.find((x) => x.label === m.month);
    check(m.month, actual?.net, m.net, 0);
    check(m.month + '-events', actual?.events, m.events, 0);
  });
  Object.entries(expected.octoberDays).forEach(([date, net]) =>
    check(date, result.days.find((d) => d.date === date)?.net, net, 0),
  );
  expected.octoberWeeks.forEach((w) =>
    check(
      w.from + '-week',
      result.days
        .filter((d) => d.date >= w.from && d.date <= w.to)
        .reduce((s, d) => s + Number(d.net), 0),
      w.net,
      0,
    ),
  );
  expected.rBuckets.forEach((b, i) => check('bucket' + i, result.rBuckets[i], b.count, 0));
  check('reviewed', result.shadow.reviewed, 24, 0);
  check('shadowExcluded', result.shadow.excluded, 7, 0);
  check('queue', result.queue.length, 6, 0);
  check('reviewedWins', result.shadow.reviewedWins, 12, 0);
  check('reviewedLosses', result.shadow.reviewedLosses, 12, 0);
  for (const target of expected.rolling) {
    const actual = result.rolling.find((x) => x.window === target.window)!;
    check('rolling' + target.window, actual.mean, target.expectancyR);
    check('rollingPF' + target.window, actual.profitFactor, target.pf);
    actual.ci?.forEach((v, i) =>
      check('rollingCI' + target.window + '-' + i, v, target.ci[i], 0.1),
    );
  }
  return { pass: checks.every((c) => c.pass), checks };
}
