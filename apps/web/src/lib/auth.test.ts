import assert from "node:assert/strict";
import test from "node:test";
import { assistantDestination, assistantSignInHref, authDestination, getAppUrl, shopDestination, signInHref } from "./auth.ts";
import { isSupabaseConfigured } from "./supabase/config.ts";

test("auth callback permits only allowlisted internal destinations", () => {
  for (const input of [null, "https://evil.test", "//evil.test", "/\\evil.test", "/workspace?next=https://evil.test"]) {
    assert.equal(authDestination(input), "/workspace");
  }
  assert.equal(authDestination("/login/reset-password"), "/login/reset-password");
  for (const input of ["//evil.test/sales", "/%2f%2fevil.test", "/auth/confirm?code=secret", "/login", "/sales\nLocation:https://evil.test", "https://local.invalid/sales"]) {
    assert.equal(authDestination(input), "/workspace");
  }
  assert.equal(authDestination("/sales?tab=payments&next=https://evil.test&code=secret"), "/sales?tab=payments");
});

test("sign-in and onboarding retain the intended destination without granting shop access", () => {
  const shop = "10000000-0000-4000-8000-000000000001";
  const target = `/sales?shop=${shop}&tab=orders&q=Thiri`;
  const login = new URL(signInHref(target), "https://local.invalid");
  assert.equal(login.pathname, "/login");
  assert.equal(login.searchParams.get("next"), target);
  const destination = new URL(shopDestination("/sales?tab=orders&q=Thiri", shop), "https://local.invalid");
  assert.equal(destination.searchParams.get("shop"), shop);
  assert.equal(destination.searchParams.get("q"), "Thiri");
  assert.equal(destination.searchParams.get("source"), "live");
  assert.equal(shopDestination("/workspace", shop), `/workspace/${shop}`);
});

test("hosted assistant sign-in retains only the bounded assistant return path", () => {
  const shop = "10000000-0000-4000-8000-000000000001";
  assert.equal(assistantDestination(`/assistant?shop=${shop}`), `/assistant?shop=${shop}`);
  assert.equal(assistantDestination("/assistant?view=match"), "/assistant?view=match");
  const challenge = "a".repeat(64);
  assert.equal(authDestination(`/assistant/connect?challenge=${challenge}`), `/assistant/connect?challenge=${challenge}`);
  assert.equal(authDestination(`/assistant/connect?challenge=${challenge}&done=1`), `/assistant/connect?challenge=${challenge}&done=1`);
  assert.equal(authDestination("/assistant/connect?challenge=invalid"), "/assistant");
  assert.equal(assistantDestination("/sales?shop=" + shop), "/assistant");
  const href = new URL(assistantSignInHref(`/assistant?shop=${shop}`), "https://local.invalid");
  assert.equal(href.pathname, "/assistant/login");
  assert.equal(href.searchParams.get("next"), `/assistant?shop=${shop}`);
});

test("callback origin rejects untrusted protocols and nonlocal cleartext", () => {
  const before = process.env.NEXT_PUBLIC_APP_URL;
  try {
    for (const value of ["javascript:alert(1)", "http://example.com", "https://user:password@example.com"]) {
      process.env.NEXT_PUBLIC_APP_URL = value;
      assert.throws(getAppUrl);
    }
    process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3000/path?ignore=1";
    assert.equal(getAppUrl(), "http://127.0.0.1:3000");
  } finally {
    if (before === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = before;
  }
});

test("placeholder configuration and secret keys never enable public clients", () => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://your-project-ref.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_replace_with_project_key";
    assert.equal(isSupabaseConfigured(), false);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_secret_test";
    assert.equal(isSupabaseConfigured(), false);
  } finally {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
  }
});
