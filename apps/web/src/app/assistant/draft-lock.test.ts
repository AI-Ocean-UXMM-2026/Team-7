import assert from "node:assert/strict";
import test from "node:test";
import {
  canAnalyzeHostedDraft,
  canConfirmHostedDraft,
  canMutateHostedDraft,
  resolveHostedSave,
  startNewHostedDraft,
  type HostedDraftPhase,
} from "./draft-lock.ts";

test("a deferred hosted save freezes edits, re-analysis, and confirmation", () => {
  let phase: HostedDraftPhase = "editable";
  let inFlight = false;
  assert.equal(canMutateHostedDraft(phase, inFlight), true);
  assert.equal(canAnalyzeHostedDraft(phase, inFlight), true);

  inFlight = true;
  phase = "saving";
  assert.equal(canMutateHostedDraft(phase, inFlight), false);
  assert.equal(canAnalyzeHostedDraft(phase, inFlight), false);
  assert.equal(canConfirmHostedDraft(phase, inFlight), false);
  assert.equal(startNewHostedDraft(phase, inFlight), null);
});

test("successful save freezes the confirmed draft until an explicit new draft", () => {
  const saved = resolveHostedSave("saving", "success");
  assert.equal(saved, "saved");
  assert.equal(canMutateHostedDraft(saved, false), false);
  assert.equal(canAnalyzeHostedDraft(saved, false), false);
  assert.equal(startNewHostedDraft(saved, false), "editable");
});

test("failed save returns to editable state for a stable-ID retry", () => {
  const editable = resolveHostedSave("saving", "failure");
  assert.equal(editable, "editable");
  assert.equal(canMutateHostedDraft(editable, false), true);
  assert.equal(canConfirmHostedDraft(editable, false), true);
  assert.equal(startNewHostedDraft(editable, false), null);
});
