import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { buildTradeWorkbook } from "../lib/trade-excel.ts";

test("builds a typed two-sheet Excel workbook from trade history", () => {
  const workbook = buildTradeWorkbook([{
    id: "T-001",
    date: "2026-08-10",
    symbol: "XAUUSD",
    market: "Forex",
    source: "MetaTrader 5",
    side: "Buy",
    session: "London",
    setup: "Breakout + Retest",
    timeframe: "H1",
    risk: 1_000_000,
    pnl: 2_000_000,
    fees: 50_000,
    quantity: 0.1,
    entryPrice: 3340,
    exitPrice: 3360,
    discipline: 100,
    psychology: "Bình tĩnh",
    durationMin: 90,
    note: "Đúng kế hoạch",
  }], new Date("2026-08-10T08:00:00Z"));

  assert.deepEqual(workbook.SheetNames, ["Tổng quan", "Lịch sử giao dịch"]);
  assert.equal(workbook.Sheets["Tổng quan"].B3.v, 1);
  assert.equal(workbook.Sheets["Lịch sử giao dịch"].E2.v, "XAUUSD");
  assert.equal(workbook.Sheets["Lịch sử giao dịch"].M2.v, 2_000_000);
  assert.equal(workbook.Sheets["Lịch sử giao dịch"].N2.v, 2);
  assert.equal(workbook.Sheets["Lịch sử giao dịch"]["!autofilter"].ref, "A1:W2");
  const output = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true });
  assert.ok(output.byteLength > 10_000);
});
