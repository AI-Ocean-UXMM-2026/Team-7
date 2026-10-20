import assert from "node:assert/strict";
import test from "node:test";
import { attachNavigationGuards, type NavigationGuardTarget } from "./navigation-guard.ts";

function fakeWebContents() {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  let windowOpenHandler: (() => { action: "deny" }) | undefined;
  const target: NavigationGuardTarget = {
    on(eventName, listener) {
      listeners.set(eventName, listener);
    },
    setWindowOpenHandler(handler) {
      windowOpenHandler = handler;
    },
  };
  return { target, listeners, getWindowOpenHandler: () => windowOpenHandler };
}

function navigationEvent() {
  let prevented = false;
  return {
    event: { preventDefault: () => { prevented = true; } },
    wasPrevented: () => prevented,
  };
}

test("navigation guard wires allowed hosted redirect and rejects unsafe main-frame redirects", () => {
  const fake = fakeWebContents();
  attachNavigationGuards(fake.target, {
    mode: "hosted",
    hostedUrl: "https://assistant.example.com/assistant",
    isDevelopment: false,
    devUrl: "http://127.0.0.1:5173",
    packagedRenderer: "file:///app/dist/index.html",
  });

  const allowed = navigationEvent();
  fake.listeners.get("will-redirect")?.(allowed.event, "https://assistant.example.com/assistant/login?next=%2Fassistant", false, true);
  assert.equal(allowed.wasPrevented(), false);

  const allowedNavigate = navigationEvent();
  fake.listeners.get("will-navigate")?.(allowedNavigate.event, "https://assistant.example.com/assistant?shop=10000000-0000-4000-8000-000000000001", false, true);
  assert.equal(allowedNavigate.wasPrevented(), false);

  const offOrigin = navigationEvent();
  fake.listeners.get("will-redirect")?.(offOrigin.event, "https://evil.example.com/assistant", false, true);
  assert.equal(offOrigin.wasPrevented(), true);

  const otherPath = navigationEvent();
  fake.listeners.get("will-redirect")?.(otherPath.event, "https://assistant.example.com/sales", false, true);
  assert.equal(otherPath.wasPrevented(), true);
});

test("navigation guard keeps subframe redirects out of the main-frame allowlist and denies window opens", () => {
  const fake = fakeWebContents();
  attachNavigationGuards(fake.target, {
    mode: "hosted",
    hostedUrl: "https://assistant.example.com/assistant",
    isDevelopment: false,
    devUrl: "http://127.0.0.1:5173",
    packagedRenderer: "file:///app/dist/index.html",
  });

  const subframe = navigationEvent();
  fake.listeners.get("will-redirect")?.(subframe.event, "https://evil.example.com/redirect", false, false);
  assert.equal(subframe.wasPrevented(), false);
  assert.deepEqual(fake.getWindowOpenHandler()?.(), { action: "deny" });
});
