import assert from "node:assert/strict";
import test from "node:test";
import { createSampleProvider, createSampleSnapshot, resetSampleExpenses } from "./sample-provider.ts";
import { expenseInputSchema, summarizeFinancials } from "@ocean/contracts";

test("sample expenses remain isolated, validate and survive a provider reload in the same tab", async context => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } });
  context.after(() => { if (previous) Object.defineProperty(globalThis, "sessionStorage", previous); else Reflect.deleteProperty(globalThis, "sessionStorage"); });
  const provider = createSampleProvider("2026-10-20");
  const initial = await provider.load();
  assert.equal(initial.source, "sample");
  const input = { description: "စမ်းသပ် · packaging", category: "Packaging" as const, amount_mmk: 3500, expense_date: "2026-10-20", notes: null };
  assert.equal(expenseInputSchema.safeParse({ ...input, amount_mmk: 0 }).success, false);
  assert.equal(expenseInputSchema.safeParse({ ...input, amount_mmk: 1.5 }).success, false);
  assert.equal(expenseInputSchema.safeParse({ ...input, expense_date: "2026-02-30" }).success, false);
  const saved = await provider.saveExpense(input);
  const reloaded = await createSampleProvider("2026-10-20").load();
  assert.equal(reloaded.expenses.length, initial.expenses.length + 1);
  assert.equal(reloaded.expenses.find(row => row.id === saved.id)?.amount_mmk, 3500);
  await provider.saveExpense({ ...input, amount_mmk: 5000 }, saved.id);
  assert.equal((await provider.load()).expenses.find(row => row.id === saved.id)?.amount_mmk, 5000);
  const range = { from: "2026-10-20", to: "2026-10-20" };
  assert.equal(summarizeFinancials(await provider.load(), range).operatingExpenses, summarizeFinancials(initial, range).operatingExpenses + 5000);
  await assert.rejects(provider.saveExpense({ ...input, amount_mmk: 1.5 }));
  resetSampleExpenses();
  assert.deepEqual((await provider.load()).expenses, initial.expenses);
  values.set("salesayar:sample-expenses:v1", "broken-json");
  await assert.rejects(provider.load()); // never silently replace corrupted data
});
test("sample fixtures have typed rows and explicit payment data, not UI totals", () => {
  const data = createSampleSnapshot("2026-10-20");
  assert.ok(data.orders.length > 0);
  assert.ok(data.payments?.length);
  assert.ok(data.orders.some(order => order.customers?.name === "မြမြ"));
});
