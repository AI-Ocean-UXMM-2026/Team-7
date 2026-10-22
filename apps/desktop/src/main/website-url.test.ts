import assert from "node:assert/strict";
import test from "node:test";
import { resolveWebsiteUrl } from "./website-url.ts";

test("uses the configured HTTPS website URL", () => {
  assert.equal(
    resolveWebsiteUrl("https://salesayar.example/sales?tab=orders"),
    "https://salesayar.example/sales?tab=orders",
  );
});

test("rejects insecure and credential-bearing website URLs", () => {
  assert.equal(resolveWebsiteUrl("http://salesayar.example"), null);
  assert.equal(resolveWebsiteUrl("https://user:secret@salesayar.example"), null);
});

test("falls back to the local website during development", () => {
  assert.equal(resolveWebsiteUrl(undefined, true), "http://127.0.0.1:3000/");
  assert.equal(resolveWebsiteUrl(undefined, false), null);
});
