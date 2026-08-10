import test from "node:test";
import assert from "node:assert/strict";
import XLSX from "xlsx-js-style";
import { buildTradeWorkbook } from "../lib/trade-excel.ts";

const trades = [
  {
    id: "T-001",
    externalId: "503561083",
    date: "2026-07-24",
    openedAt: "2026-07-24T11:13:20Z",
    closedAt: "2026-07-24T19:50:01Z",
    symbol: "XAGUSD",
    market: "Forex",
    source: "MetaTrader 5",
    accountId: "MT5-01",
    side: "Buy",
    session: "London",
    setup: "Breakout + Retest",
    timeframe: "H1",
    risk: 1_000_000,
    pnl: 2_000_000,
    fees: 50_000,
    swap: 10_000,
    quantity: 0.1,
    entryPrice: 58.154,
    stopLoss: 58.079,
    takeProfit: 60.19,
    exitPrice: 58.576,
    pips: 42.2,
    discipline: 100,
    psychology: "Bình tĩnh",
    durationMin: 517,
    note: "Đúng kế hoạch",
  },
  {
    id: "T-002",
    date: "2026-07-25",
    symbol: "SOYBEAN.c",
    market: "Hàng hóa",
    source: "CQG",
    side: "Buy",
    session: "Châu Á",
    setup: "Pullback xu hướng",
    timeframe: "H1",
    risk: 1_000_000,
    pnl: -1_000_000,
    fees: 20_000,
    quantity: 1,
    entryPrice: 1234.85,
    exitPrice: 1228.98,
    discipline: 75,
    psychology: "Hơi vội",
    durationMin: 447,
    note: "Cắt lỗ đúng kế hoạch",
  },
  {
    id: "T-003",
    date: "2026-08-01",
    symbol: "XAUUSD",
    market: "Forex",
    source: "Thủ công",
    side: "Sell",
    session: "New York",
    setup: "Từ chối giá",
    timeframe: "M30",
    risk: 800_000,
    pnl: 0,
    fees: 0,
    quantity: 0.1,
    entryPrice: 3350,
    exitPrice: 3350,
    discipline: 100,
    psychology: "Trung lập",
    durationMin: 60,
    note: "Hòa vốn",
  },
];

test("builds a styled five-sheet report with the supplied raw-trade layout", () => {
  const workbook = buildTradeWorkbook(trades, new Date("2026-08-10T08:00:00Z"));

  assert.deepEqual(workbook.SheetNames, [
    "Tổng quan",
    "Phân tích",
    "Lịch sử chi tiết",
    "Theo mẫu gốc",
    "Danh mục trường",
  ]);

  const summary = workbook.Sheets["Tổng quan"];
  assert.equal(summary.B6.v, 3);
  assert.equal(summary.B7.v, 1);
  assert.equal(summary.B8.v, 1);
  assert.equal(summary.B10.v, 1 / 3);
  assert.equal(summary.B16.v, 920_000);
  assert.equal(summary.B16.f, "SUM('Lịch sử chi tiết'!$AB$6:$AB$5005)");
  assert.equal(summary.E6.v, "2026-07");
  assert.equal(summary.F6.v, 2);
  assert.equal(summary.I6.v, 0.5);

  const history = workbook.Sheets["Lịch sử chi tiết"];
  assert.equal(history.J6.v, "XAGUSD");
  assert.equal(history.Y6.v, 2_000_000);
  assert.equal(history.AB6.v, 1_940_000);
  assert.equal(history.AB6.f, "Y6-Z6-AA6");
  assert.equal(history.AD6.v, 1.94);
  assert.equal(history["!autofilter"].ref, "A5:AK8");
  assert.equal(history.A5.s.fill.fgColor.rgb, "1A2637");

  const reference = workbook.Sheets["Theo mẫu gốc"];
  assert.equal(reference.A5.v, "Mã số giao dịch");
  assert.equal(reference.O5.v, "Thời lượng giao dịch tính bằng giây");
  assert.equal(reference.A6.v, "503561083");
  assert.equal(reference.G6.v, 58.079);
  assert.equal(reference.H6.v, 60.19);
  assert.equal(reference.O6.v, 31_020);

  const output = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
    cellStyles: true,
  });
  assert.ok(output.byteLength > 25_000);

  const roundTripped = XLSX.read(output, { type: "buffer", cellStyles: true, cellDates: true });
  assert.deepEqual(roundTripped.SheetNames, workbook.SheetNames);
  assert.equal(roundTripped.Sheets["Lịch sử chi tiết"].AB6.f, "Y6-Z6-AA6");
  assert.equal(roundTripped.Sheets["Theo mẫu gốc"].O6.v, 31_020);
});
