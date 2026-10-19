import { D } from "../../lib/trading/domain/decimal";
import { expect, it } from "vitest";
import original from "../../v6/tests/golden/fixture-30-trades.json";
import expected from "../../v6/tests/golden/golden.expected.json";
import { decodeBackup } from "../../lib/trading/storage/backup";
import { replayLedger } from "../../lib/trading/application/replayLedger";
import {
  metricsVM,
  calendarVM,
  feeImpact,
  reviewQueue,
  shadowCurve,
  rMultiple,
  dateInZone,
} from "../../lib/trading/selectors";
import { riskReport } from "../../lib/trading/selectors/riskReport";
import { inference, wilson } from "../../lib/trading/selectors/inference";
import { metricRegistry } from "../../lib/trading/selectors/metricRegistry";

// Reference audit only: this certifies the captured v3 fixture, not an S1 v6 core.
it("audits original v3 demo export against sections 4.1–4.9 without changing timestamps", async () => {
  const data = await decodeBackup(JSON.stringify(original)),
    r = await replayLedger(data),
    m = metricsVM(r),
    risk = riskReport(r),
    fees = feeImpact(r),
    shadow = shadowCurve(r);
  for (const [key, value] of Object.entries(expected.summary)) {
    if (!m[key]) continue;
    expect(m[key].status, key).toBe("ok");
    if (m[key].status !== "ok") throw Error(key);
    const format = metricRegistry.find((d) => d.id === key)!.format;
    const tolerance = ["count", "streak"].includes(format)
      ? 0
      : format === "money"
        ? expected.tolerances.moneyVND
        : format === "percent"
          ? expected.tolerances.percentPoints
          : expected.tolerances.ratio;
    expect(Math.abs(m[key].value - value), key).toBeLessThanOrEqual(tolerance);
  }
  expect(Number(fees.grossVND)).toBe(expected.fees.gross);
  expect(Number(fees.knownCommissionAndTaxVND)).toBe(
    expected.fees.commissionAndTax,
  );
  expect(Number(fees.knownCarryingPaidVND)).toBe(0);
  expect(Number(fees.knownCarryingReceivedVND)).toBe(0);
  expect(fees.unknownCostCount).toBe(0);
  expect(
    Math.abs(fees.erosionPercent! - expected.fees.erosionPercent),
  ).toBeLessThanOrEqual(0.05);
  expect(
    r.cycles.filter((c) => c.costCompleteness === "complete"),
  ).toHaveLength(30);
  expect(Number(risk.currentDrawdownVND)).toBe(
    expected.summary.currentDrawdown,
  );
  expect(
    Math.abs(risk.top5ProfitShare! - expected.summary.top5ProfitShare),
  ).toBeLessThanOrEqual(0.05);
  expect(
    Math.abs(Number(risk.meanRiskVND) - expected.summary.meanRisk),
  ).toBeLessThanOrEqual(0.5);
  expect(
    risk.months.map((d) => ({
      month: d.month,
      net: Number(d.netVND),
      events: d.events,
    })),
  ).toEqual(expected.months);
  const days = calendarVM(r);
  expect(
    Object.fromEntries(
      days
        .filter((d) => d.date.startsWith("2026-10"))
        .map((d) => [d.date, Number(d.netVND)]),
    ),
  ).toEqual(expected.octoberDays);
  for (const week of expected.octoberWeeks)
    expect(
      days
        .filter((d) => d.date >= week.from && d.date <= week.to)
        .reduce((s, d) => s + Number(d.netVND), 0),
    ).toBe(week.net);
  const weekCycles = r.cycles.filter(
    (c) =>
      dateInZone(c.closeTsUtc!) >= "2026-10-12" &&
      dateInZone(c.closeTsUtc!) <= "2026-10-18",
  );
  expect(weekCycles).toHaveLength(5);
  expect(
    weekCycles.filter((c) => c.overlay?.reviewStatus === "reviewed"),
  ).toHaveLength(4);
  expect(shadow.coverage.reviewed).toBe(24);
  expect(shadow.excluded).toBe(7);
  expect(shadow.selectionBias).toBe(true);
  expect([
    shadow.wins.reviewed,
    shadow.wins.total,
    shadow.losses.reviewed,
    shadow.losses.total,
  ]).toEqual([12, 18, 12, 12]);
  const queue = reviewQueue(r.cycles);
  expect(queue).toHaveLength(6);
  for (const pending of expected.pendingTrades) {
    const c = queue.find(
      (c) =>
        c.symbol === pending.symbol &&
        dateInZone(c.closeTsUtc!) === pending.date,
    )!;
    expect(Number(c.netVND)).toBe(pending.net);
    expect(D(rMultiple(c)!).minus(String(pending.r)).abs().lte("0.005")).toBe(
      true,
    );
  }
  for (const setup of expected.setups) {
    const cs = r.cycles.filter((c) => c.overlay?.setupTag === setup.name),
      sm = metricsVM({ ...r, cycles: cs }),
      inf = inference(cs);
    expect(cs).toHaveLength(setup.count);
    expect(
      cs.filter((c) => c.overlay?.reviewStatus === "reviewed"),
    ).toHaveLength(setup.reviewed);
    expect(sm.profitFactor).toMatchObject({ status: "ok" });
    if (sm.profitFactor.status === "ok")
      expect(Math.abs(sm.profitFactor.value - setup.pf)).toBeLessThanOrEqual(
        0.005,
      );
    expect(Math.abs(inf.mean! - setup.expectancyR)).toBeLessThanOrEqual(0.005);
    inf.ci!.forEach((v, i) =>
      expect(Math.abs(v - setup.ci[i])).toBeLessThanOrEqual(0.1),
    );
  }
  const ordered = [...r.cycles].sort((a, b) =>
    a.closeTsUtc!.localeCompare(b.closeTsUtc!),
  );
  for (const window of expected.rolling) {
    const cs = ordered.slice(-window.window),
      inf = inference(cs),
      sm = metricsVM({ ...r, cycles: cs });
    expect(cs).toHaveLength(window.available);
    expect(Math.abs(inf.mean! - window.expectancyR)).toBeLessThanOrEqual(0.005);
    inf.ci!.forEach((v, i) =>
      expect(Math.abs(v - window.ci[i])).toBeLessThanOrEqual(0.1),
    );
    if (sm.profitFactor.status === "ok")
      expect(Math.abs(sm.profitFactor.value - window.pf)).toBeLessThanOrEqual(
        0.005,
      );
    expect(sm.winRate).toMatchObject({ value: window.winRate });
  }
  const sample = r.cycles.find(
    (c) =>
      c.symbol === "VCB" &&
      dateInZone(c.closeTsUtc!) === expected.sampleTrade.date,
  )!;
  expect([
    Number(sample.grossVND),
    Number(sample.netVND),
    Number(sample.risk.amountVND),
    sample.overlay?.disciplineScore,
  ]).toEqual([180000, 159620, 200000, 90]);
  expect(wilson(18, 30)!.map((v) => v * 100)).toEqual(
    expect.arrayContaining(
      expected.wilson.all.map((v) => expect.closeTo(v, 1)),
    ),
  );
  expect(m.avgDuration).toMatchObject({
    status: "ok",
    value: expected.holding.observedMeanMinutes,
  });
  for (const scenario of expected.reviewScenarios) {
    const gap = Math.abs(1 - (12 + scenario.additionalWins) / 18) * 100;
    expect(gap > 15).toBe(scenario.warning);
  }
});
