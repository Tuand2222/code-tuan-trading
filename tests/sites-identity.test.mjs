import assert from "node:assert/strict";
import test from "node:test";
import { sitesIdentity } from "../lib/sites-identity.ts";

test("ignores identity headers outside the native Sites runtime", () => {
  const headers = new Headers({ "oai-authenticated-user-id": "attacker", "oai-authenticated-user-email": "a@example.com" });
  assert.equal(sitesIdentity(headers, false), null);
});
test("requires both identity headers", () => {
  assert.equal(sitesIdentity(new Headers(), true), null);
  assert.equal(sitesIdentity(new Headers({ "oai-authenticated-user-id": "123" }), true), null);
});
test("namespaces accounts and decodes Vietnamese names", () => {
  const headers = new Headers({ "oai-authenticated-user-id": "123", "oai-authenticated-user-email": "TUAN@example.com", "oai-authenticated-user-full-name": encodeURIComponent("Anh Tuấn"), "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8" });
  assert.deepEqual(sitesIdentity(headers, true), { id: "sites:123", email: "tuan@example.com", name: "Anh Tuấn" });
  headers.set("oai-authenticated-user-full-name", "%invalid");
  assert.equal(sitesIdentity(headers, true).name, "tuan@example.com");
});
