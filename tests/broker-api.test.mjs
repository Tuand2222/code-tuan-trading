­r‡^Ñf¥–Ø¦{NìyÊ'vÃ®¶›­import assert from "node:assert/strict";
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
  assert.match(result.detail, /Futures API Ä‘Ã£ xÃ¡c thá»±c/);
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
  assert.match(result.detail, /pháº£n há»“i há»£p lá»‡/);
});
