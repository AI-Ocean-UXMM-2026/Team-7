import assert from "node:assert/strict";
import test from "node:test";
import { canConfirmDraft, resolveDraftOrderId } from "./draft-identity.ts";

test("an uncertain save retry reuses the same draft order ID", () => {
  const first = resolveDraftOrderId(null, () => "10000000-0000-4000-8000-000000000001");
  const retry = resolveDraftOrderId(first, () => {
    throw new Error("a retry must not create a second order ID");
  });
  assert.equal(retry, first);
});

test("a confirmed draft cannot start a second confirmation", () => {
  assert.equal(canConfirmDraft(false, false), true);
  assert.equal(canConfirmDraft(false, true), false);
  assert.equal(canConfirmDraft(true, false), false);
});
