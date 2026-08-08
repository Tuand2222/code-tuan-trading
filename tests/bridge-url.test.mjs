import assert from "node:assert/strict";
import test from "node:test";

import { getPublicBridgeUrl } from "../lib/bridge-url.ts";

test("accepts a public HTTPS bridge", () => {
  const url = getPublicBridgeUrl("https://bridge.example.com/trades");
  assert.equal(url.hostname, "bridge.example.com");
  assert.equal(url.protocol, "https:");
});

test("rejects non-HTTPS and embedded credentials", () => {
  assert.throws(() => getPublicBridgeUrl("http://bridge.example.com/trades"), /HTTPS/);
  assert.throws(() => getPublicBridgeUrl("https://user:secret@bridge.example.com/trades"), /credentials/);
});

test("rejects local and private bridge hosts", () => {
  for (const value of [
    "https://localhost/trades",
    "https://bridge.local/trades",
    "https://127.0.0.1/trades",
    "https://10.0.0.5/trades",
    "https://172.20.0.5/trades",
    "https://192.168.1.5/trades",
    "https://[::1]/trades",
    "https://[fd00::1]/trades",
  ]) assert.throws(() => getPublicBridgeUrl(value), /public HTTPS host/);
});
