import assert from "node:assert/strict";
import test from "node:test";
import { sameOriginMutation } from "./request-origin.ts";

test("same-origin shop writes accept local host aliases and reject cross-site origins", () => {
  const request = (origin: string, host = "127.0.0.1:3000") => new Request("http://127.0.0.1:3000/api/shop-receiving-accounts", { method: "POST", headers: { origin, host } });
  assert.equal(sameOriginMutation(request("http://localhost:3000")), true);
  assert.equal(sameOriginMutation(request("http://127.0.0.1:3000")), true);
  assert.equal(sameOriginMutation(request("https://evil.example")), false);
  assert.equal(sameOriginMutation(request("http://localhost:3001")), false);
  assert.equal(sameOriginMutation(new Request("http://127.0.0.1:3000/api/shop-receiving-accounts", { method: "POST", headers: { referer: "http://localhost:3000/settings" } })), true);
});
