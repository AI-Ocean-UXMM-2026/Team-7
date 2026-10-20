import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedHostedNavigation, resolveHostedAssistantUrl } from "./hosted-assistant.ts";

test("hosted assistant URL accepts only HTTPS or explicit local development origins", () => {
  assert.equal(resolveHostedAssistantUrl("https://assistant.example.com"), "https://assistant.example.com/assistant");
  assert.equal(resolveHostedAssistantUrl("http://127.0.0.1:3000"), "http://127.0.0.1:3000/assistant");
  assert.equal(resolveHostedAssistantUrl("http://localhost:3000/assistant"), "http://localhost:3000/assistant");
  for (const value of ["", "javascript:alert(1)", "http://assistant.example.com", "https://user:pass@assistant.example.com", "https://assistant.example.com/other", "https://assistant.example.com?next=/sales"]) {
    assert.equal(resolveHostedAssistantUrl(value), null, value);
  }
});

test("hosted navigation allows only assistant and bounded sign-in paths on the same origin", () => {
  const base = "https://assistant.example.com/assistant";
  assert.equal(isAllowedHostedNavigation("https://assistant.example.com/assistant?shop=10000000-0000-4000-8000-000000000001", base), true);
  assert.equal(isAllowedHostedNavigation("https://assistant.example.com/assistant/login?next=%2Fassistant", base), true);
  assert.equal(isAllowedHostedNavigation("https://assistant.example.com/sales", base), false);
  assert.equal(isAllowedHostedNavigation("https://evil.example.com/assistant", base), false);
  assert.equal(isAllowedHostedNavigation("https://assistant.example.com/assistant#external", base), false);
});
