import assert from "node:assert/strict";
import test from "node:test";

import {
  isEmailIdentifier,
  normalizePhoneNumber,
  safeAuthReturnTo,
} from "../lib/auth-utils.ts";

test("normalizes Vietnamese and international phone numbers", () => {
  assert.equal(normalizePhoneNumber("0912 345 678"), "+84912345678");
  assert.equal(normalizePhoneNumber("+1 (415) 555-2671"), "+14155552671");
  assert.equal(normalizePhoneNumber("123"), null);
});

test("only accepts safe same-site authentication return paths", () => {
  assert.equal(safeAuthReturnTo("/#settings"), "/#settings");
  assert.equal(safeAuthReturnTo("/nhat-ky?view=week"), "/nhat-ky?view=week");
  assert.equal(safeAuthReturnTo("https://evil.example/steal"), "/");
  assert.equal(safeAuthReturnTo("//evil.example/steal"), "/");
  assert.equal(safeAuthReturnTo("/api/auth/callback/google"), "/");
  assert.equal(safeAuthReturnTo("/dang-nhap?loop=1"), "/");
});

test("distinguishes email identifiers from phone identifiers", () => {
  assert.equal(isEmailIdentifier("trader@example.com"), true);
  assert.equal(isEmailIdentifier("0912345678"), false);
});
