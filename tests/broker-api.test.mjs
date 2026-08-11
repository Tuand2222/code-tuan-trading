import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { hmacHex, verifyBrokerAccess } from "../lib/broker-api.ts";

test("broker signatures use HMAC SHA-256", async () => {
  const secret = "read-only-secret";
  const payload = "symbol=BTCUSDT&timestamp=1770736694138";
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  assert.equal(await hmacHex(secret, payload), expected);
});

test("Binance credentials are verified against the selected account API", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.match(url, /^https:\/\/fapi\.binance\.com\/fapi\/v3\/account\?/);
    assert.match(url, /signature=[0-9a-f]{64}/);
    assert.equal(init?.headers?.["X-MBX-APIKEY"], "key");
    return Response.json({ canTrade: true });
  };

  const result = await verifyBrokerAccess({
    provider: "binance",
    accountType: "futures",
    apiKey: "key",
    apiSecret: "secret",
  });
  assert.match(result.detail, /Futures API đã xác thực/);
});

test("Binance Spot retries an official fallback endpoint after a 403", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith("https://api.binance.com/")) {
      return new Response("Forbidden", { status: 403, statusText: "Forbidden" });
    }
    return Response.json({ balances: [] });
  };

  const result = await verifyBrokerAccess({
    provider: "binance",
    accountType: "spot",
    apiKey: "key",
    apiSecret: "secret",
  });
  assert.equal(calls.length, 2);
  assert.match(calls[1], /^https:\/\/api-gcp\.binance\.com\/api\/v3\/account\?/);
  assert.match(result.endpoint, /^https:\/\/api-gcp\.binance\.com\/api\/v3\/account$/);
});

test("Binance 403 diagnostics explain server-side WAF/IP blocking", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response("Forbidden", { status: 403, statusText: "Forbidden" });

  await assert.rejects(
    verifyBrokerAccess({
      provider: "binance",
      accountType: "futures",
      apiKey: "key",
      apiSecret: "secret",
    }),
    /HTTP 403 Forbidden.*WAF\/IP\/region\/rate-limit.*fapi\.binance\.com/s,
  );
});

test("Bybit rejects API keys that are not read-only", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({
    retCode: 0,
    retMsg: "OK",
    result: { readOnly: 0 },
  });

  await assert.rejects(
    verifyBrokerAccess({
      provider: "bybit",
      accountType: "linear",
      apiKey: "key",
      apiSecret: "secret",
    }),
    /Read-Only/,
  );
});

test("Bybit 403 diagnostics explain IP/rate/region restrictions", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response("Forbidden", { status: 403, statusText: "Forbidden" });

  await assert.rejects(
    verifyBrokerAccess({
      provider: "bybit",
      accountType: "linear",
      apiKey: "key",
      apiSecret: "secret",
    }),
    /HTTP 403 Forbidden.*IP rate-limit.*khu vực/s,
  );
});

test("pull bridge must return an accepted trade collection", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.headers?.Authorization, "Bearer bridge-token");
    return Response.json({ trades: [] });
  };

  const result = await verifyBrokerAccess({
    provider: "mt5",
    accountType: "pull",
    bridgeUrl: "https://bridge.example.com/trades",
    bridgeToken: "bridge-token",
  });
  assert.match(result.detail, /phản hồi hợp lệ/);
});
