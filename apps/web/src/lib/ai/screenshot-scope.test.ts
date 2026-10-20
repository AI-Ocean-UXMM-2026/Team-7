import assert from "node:assert/strict";
import test from "node:test";
import { completeMatchScope, MATCH_CONTEXT_LIMIT } from "./screenshot-scope.ts";

test("match scope accepts a complete 200-row result and blocks the 201-row sentinel", () => {
  assert.equal(completeMatchScope(new Array(MATCH_CONTEXT_LIMIT)).complete, true);
  assert.equal(completeMatchScope(new Array(MATCH_CONTEXT_LIMIT + 1)).complete, false);
});
