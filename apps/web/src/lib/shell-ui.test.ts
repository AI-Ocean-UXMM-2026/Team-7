import assert from "node:assert/strict";
import test from "node:test";
import {
  createOrderSearchHref,
  createWorkspaceSwitcherHref,
  parseShellLanguage,
  shellLabels,
} from "./shell-ui.ts";

const shopId = "10000000-0000-4000-8000-000000000001";

test("shell language defaults safely and translates only the available shell labels", () => {
  assert.equal(parseShellLanguage(null), "en");
  assert.equal(parseShellLanguage("unknown"), "en");
  assert.equal(parseShellLanguage("my"), "my");
  assert.equal(shellLabels("my").dashboard, "ဒက်ရှ်ဘုတ်");
});

test("order search requires a nonempty query and preserves a valid shop context", () => {
  assert.equal(createOrderSearchHref(shopId, "  Thiri Mon  "), `/sales?shop=${shopId}&q=Thiri+Mon`);
  assert.equal(createOrderSearchHref("not-a-shop-id", "order 42"), "/sales?q=order+42");
  assert.equal(createOrderSearchHref(shopId, "  "), null);
  assert.equal(createOrderSearchHref(shopId, "x".repeat(201)), null);
});

test("workspace switching returns to the same supported section without carrying the old shop", () => {
  const params = new URLSearchParams({ shop: shopId, tab: "payments", q: "customer", order: shopId });
  const target = new URL(createWorkspaceSwitcherHref("/sales", params), "https://local.invalid");
  assert.equal(target.pathname, "/workspace");
  assert.equal(target.searchParams.get("next"), `/sales?tab=payments&q=customer&order=${shopId}`);

  const invalid = new URL(createWorkspaceSwitcherHref("/external", params), "https://local.invalid");
  assert.equal(invalid.searchParams.get("next"), "/");
});
