import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import {
  DEFAULT_RISK,
  netPnl,
  analyzeRiskTrades,
  riskDesk,
  positionSize,
} from "../../lib/risk-analytics";
import { identifyTrade, planIngestion } from "../../lib/unified-ingestion";
import { positionCycles } from "../../lib/position-cycles";
import {
  buildGovernanceWorkbook,
  workbookBytes,
  executivePdf,
  GOVERNANCE_SHEETS,
  type ReportTrade,
} from "../../lib/governance-report";
const trade = (o: Partial<ReportTrade> = {}): ReportTrade => ({
  id: "one",
  date: "2026-10-23",
  symbol: "BTCUSDT",
  side: "Buy",
  session: "London",
  setup: "Trend",
  timeframe: "H1",
  pnl: 100,
  fees: 10,
  swap: 2,
  risk: 50,
  discipline: 100,
  psychology: "Calm",
  durationMin: 30,
  note: "private note",
  ...o,
});
describe("PDF governance financial boundary", () => {
  it("uses gross minus costs consistently, never treats an execution as a closed decision", () => {
    expect(netPnl(trade())).toBe(88);
    const a = analyzeRiskTrades([
      trade(),
      trade({ id: "raw", recordKind: "fill", pnl: 200 }),
    ]);
    expect(a.net).toBe(88);
    expect(a.n).toBe(1);
    expect(a.expectancyR).toBe(1.76);
    expect(a.sqn).toBeNull();
    expect(a.excludedFills).toBe(1);
  });
  it("uses sample variance and per-trade R for SQN, Sharpe and Sortino", () => {
    const ts = [-1, 0, 2].map((r, i) =>
      trade({ id: String(i), pnl: r * 100, fees: 0, swap: 0, risk: 100 }),
    );
    const a = analyzeRiskTrades(ts);
    expect(a.expectancyR).toBeCloseTo(1 / 3);
    expect(a.sqn).toBeCloseTo((Math.sqrt(3) * (1 / 3)) / Math.sqrt(7 / 3));
    expect(a.sharpe).toBeCloseTo(1 / 3 / Math.sqrt(7 / 3));
    expect(a.sortino).toBeCloseTo(1 / 3 / Math.sqrt(1 / 3));
    expect(
      analyzeRiskTrades(ts.map((t) => ({ ...t, pnl: 100 }))).sqn,
    ).toBeNull();
  });
  it("cuts budget by half in defense, respects lot steps, and stops sizing at the full-stop tier", () => {
    const settings = { ...DEFAULT_RISK, initialCapital: 50000 };
    expect(positionSize(500, 100, 95, 1, 0, 1)?.quantity).toBe(100);
    const loss = trade({ pnl: -5000, fees: 0, swap: 0 });
    const d = riskDesk([loss], settings, new Date("2026-10-24T00:00Z"));
    expect(d.tier).toBe("defensive");
    expect(d.riskBudget).toBe(225);
    expect(riskDesk([trade({pnl:-7500, fees:0, swap:0})], settings).tier).toBe("stop");
    expect(positionSize(225, 100, 95, 1, 0, 1)?.quantity).toBe(45);
    expect(
      riskDesk([trade({ pnl: -8000, fees: 0, swap: 0 })], settings).riskBudget,
    ).toBe(0);
    expect(positionSize(100, 100, 100, 1, 0, 1)).toBeNull();
    expect(
      positionSize(100, 100, 95, 1, 1, 0.1)?.actualRisk,
    ).toBeLessThanOrEqual(100);
  });
  it("uses local trading day and exact 50/70/80/90 warning boundaries", () => {
    const settings = { ...DEFAULT_RISK, initialCapital: 50000 };
    for (const [usage, level] of [
      [49, "safe"],
      [50, "amber"],
      [70, "warning"],
      [80, "danger"],
      [90, "critical"],
    ] as const) {
      const d = riskDesk(
        [trade({ pnl: (-1500 * usage) / 100, fees: 0, swap: 0 })],
        settings,
        new Date("2026-10-22T18:00Z"),
      );
      expect(d.today).toBe("2026-10-23");
      expect(d.level).toBe(level);
    }
    expect(
      riskDesk([trade({ recordKind: "fill", feesKnown: false })], settings)
        .tier,
    ).toBe("unknown");
  });
});
it("assigns timestamped closing receipts to the configured timezone day", () => {
  const t = trade({
    date: "2026-10-22",
    closedAt: "2026-10-22T18:00:00Z",
    pnl: -1050,
    fees: 0,
    swap: 0,
  });
  const settings = { ...DEFAULT_RISK, initialCapital: 50000 };
  const d = riskDesk([t], settings, new Date("2026-10-22T18:01:00Z"));
  expect(d.today).toBe("2026-10-23");
  expect(d.dayNet).toBe(-1050);
  expect(d.level).toBe("warning");
  expect(d.days[0].date).toBe("2026-10-23");
});
it("orders intraday equity by actual close time before record identifiers", () => {
  const rows = [
    trade({
      id: "z",
      pnl: -100,
      fees: 0,
      swap: 0,
      closedAt: "2026-10-23T01:00:00Z",
    }),
    trade({
      id: "a",
      pnl: 200,
      fees: 0,
      swap: 0,
      closedAt: "2026-10-23T02:00:00Z",
    }),
    trade({
      id: "m",
      pnl: -100,
      fees: 0,
      swap: 0,
      closedAt: "2026-10-23T03:00:00Z",
    }),
  ];
  expect(analyzeRiskTrades(rows, 1000).maxDD).toBe(100);
});
describe("identity and cycle conservation", () => {
  it("deduplicates exact broker identity across transports but keeps accounts apart", async () => {
    const t = trade({
      source: "Binance API",
      accountId: "acct",
      externalId: "42",
    });
    const a = await identifyTrade(t, "owner"),
      b = await identifyTrade(
        { ...t, source: "Binance CSV", id: "different" },
        "owner",
      );
    expect(a.dedupHash).toBe(b.dedupHash);
    expect(
      (await identifyTrade({ ...t, accountId: "other" }, "owner")).dedupHash,
    ).not.toBe(a.dedupHash);
  });
  it("never deletes distinct identical fills based on rounded time, price or qty", async () => {
    const a = trade({ id: "a", entryPrice: 100, quantity: 0.00000001 }),
      b = trade({ id: "b", entryPrice: 100, quantity: 0.00000002 });
    const plan = await planIngestion([a], [b]);
    expect(plan.additions).toHaveLength(1);
    expect(plan.duplicates).toHaveLength(0);
    expect(plan.candidates).toHaveLength(1);
  });
  it("projects one complete position from scale-in/out without deleting original fills", () => {
    const fills = [
      trade({
        id: "1",
        recordKind: "fill",
        pnl: 0,
        fees: 1,
        swap: 0,
        quantity: 1,
        entryPrice: 100,
      }),
      trade({
        id: "2",
        recordKind: "fill",
        pnl: 0,
        fees: 2,
        swap: 0,
        quantity: 2,
        entryPrice: 110,
      }),
      trade({
        id: "3",
        recordKind: "fill",
        side: "Sell",
        pnl: 20,
        fees: 1,
        swap: 0,
        quantity: 1,
        entryPrice: 120,
      }),
      trade({
        id: "4",
        recordKind: "fill",
        side: "Sell",
        pnl: 40,
        fees: 2,
        swap: 0,
        quantity: 2,
        entryPrice: 130,
      }),
    ];
    const before = JSON.stringify(fills),
      p = positionCycles(fills);
    expect(p.closed).toHaveLength(1);
    expect(p.closed[0].quantity).toBe(3);
    expect(p.closed[0].entryPrice).toBeCloseTo(106.6666667);
    expect(p.closed[0].exitPrice).toBeCloseTo(126.6666667);
    expect(netPnl(p.closed[0])).toBe(54);
    expect(JSON.stringify(fills)).toBe(before);
    expect(p.open).toHaveLength(0);
  });
});
describe("institutional result files", () => {
  it("creates five styled sheets, real frozen rows and cached audit formulas", () => {
    const wb = buildGovernanceWorkbook([trade()], {
      ...DEFAULT_RISK,
      initialCapital: 50000,
    });
    expect(wb.SheetNames).toEqual(GOVERNANCE_SHEETS);
    expect(wb.Sheets[GOVERNANCE_SHEETS[1]].O2).toMatchObject({
      f: "L2-M2-N2",
      v: 88,
    });
    const files = unzipSync(workbookBytes(wb));
    expect(strFromU8(files["xl/worksheets/sheet1.xml"])).toContain(
      'state="frozen"',
    );
    expect(strFromU8(files["xl/worksheets/sheet2.xml"])).toContain(
      "<f>L2-M2-N2</f>",
    );
  });
  it("generates a single-page PDF with embedded Vietnamese glyphs", async () => {
    const pdf = await executivePdf(
      [trade()],
      DEFAULT_RISK,
      new Uint8Array(readFileSync("public/fonts/BeVietnamPro-Regular.ttf")),
    );
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
