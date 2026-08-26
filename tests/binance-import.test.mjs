import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parseBinanceFuturesText } from "../lib/binance-import.ts";

const source = await fs.readFile(new URL("../test-fixtures/binance-futures-history.txt", import.meta.url), "utf8");

test("parses all closed Binance positions from the real PDF text fixture", () => {
  const result = parseBinanceFuturesText(source);
  assert.equal(result.detected, 20);
  assert.equal(result.trades.length, 20);
  const bySymbolAndPnl = (symbol, pnl) => result.trades.find((trade) => trade.symbol === symbol && trade.pnl === pnl);
  assert.ok(bySymbolAndPnl("ETHUSDT", 342.35952));
  assert.ok(bySymbolAndPnl("MSTRUSDT", 293.88669999));
  assert.ok(bySymbolAndPnl("XAGUSDT", 175.73394));
  assert.ok(bySymbolAndPnl("INTCUSDT", -117.45849991));
  assert.ok(bySymbolAndPnl("MSTRUSDT", -161.8321));
});

test("uses deterministic source ids for duplicate protection", () => {
  const first = parseBinanceFuturesText(source).trades.map((trade) => trade.externalId);
  const second = parseBinanceFuturesText(source).trades.map((trade) => trade.externalId);
  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, 20);
});
