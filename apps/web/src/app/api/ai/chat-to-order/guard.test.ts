import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_PROVIDER_CALLS_PER_WINDOW,
  MAX_PROVIDER_CHAT_CHARACTERS,
  providerBoundaryDecision,
  reserveProviderUsage,
} from "./guard.ts";

test("live AI boundary rejects missing session or shop before provider invocation", () => {
  let providerInvocations = 0;
  const unauthenticated = providerBoundaryDecision({
    chatLength: 100,
    shopId: "10000000-0000-4000-8000-000000000001",
    authenticated: false,
    authorizedShop: false,
    usageAllowed: true,
  });
  if (unauthenticated.ok) providerInvocations += 1;
  assert.deepEqual(unauthenticated, {
    ok: false,
    status: 401,
    message: "Sign in to an authorized seller workspace before using live AI extraction.",
  });
  assert.equal(providerInvocations, 0);

  const missingShop = providerBoundaryDecision({
    chatLength: 100,
    authenticated: true,
    authorizedShop: false,
    usageAllowed: true,
  });
  assert.equal(missingShop.ok ? null : missingShop.status, 400);
});

test("live AI boundary bounds provider input and per-user/shop usage", () => {
  const oversized = providerBoundaryDecision({
    chatLength: MAX_PROVIDER_CHAT_CHARACTERS + 1,
    shopId: "10000000-0000-4000-8000-000000000001",
    authenticated: true,
    authorizedShop: true,
    usageAllowed: true,
  });
  assert.equal(oversized.ok ? null : oversized.status, 413);

  const key = `test-${Date.now()}-${Math.random()}`;
  for (let count = 0; count < MAX_PROVIDER_CALLS_PER_WINDOW; count += 1) {
    assert.equal(reserveProviderUsage(key, 10_000), true);
  }
  assert.equal(reserveProviderUsage(key, 10_000), false);
  assert.equal(reserveProviderUsage(key, 10_000 + 10 * 60 * 1000), true);
});
