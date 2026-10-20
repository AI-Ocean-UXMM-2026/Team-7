import test from "node:test";
import assert from "node:assert/strict";
import { parseSimulatedChat } from "./chat-to-order.ts";

test("simulated extraction handles English multiple items and customer details", () => {
  const result = parseSimulatedChat(
    "Hi, I am Alice. Please get two Mira tote bags at 22,500 kyat each and one blue mug at 15,000 kyat. Deliver to 14 Inya Road, Yangon. Phone 09 777 222 111. Note: call before delivery.",
  );
  assert.equal(result.customer_name, "Alice");
  assert.equal(result.customer_phone, "09 777 222 111");
  assert.equal(result.delivery_address, "14 Inya Road, Yangon");
  assert.deepEqual(result.items, [
    { product_name: "Mira tote bags", quantity: 2, unit_price_mmk: 22500 },
    { product_name: "blue mug", quantity: 1, unit_price_mmk: 15000 },
  ]);
  assert.equal(result.notes, "call before delivery");
  assert.ok(result.missing_fields.includes("delivery_fee_mmk"));
  assert.ok(result.missing_fields.includes("discount_mmk"));
});

test("simulated extraction normalizes Burmese digits and quantity words", () => {
  const result = parseSimulatedChat(
    "မင်္ဂလာပါ။ Mira tote bag နှစ်လုံး၊ တစ်လုံး ၂၂,၅၀၀ ကျပ်။ ရန်ကုန် အင်းလျားလမ်း ၁၄ ကိုပို့ပေးပါ။ နာမည်က သီရိမွန်ပါ။",
  );
  assert.equal(result.customer_name, "သီရိမွန်");
  assert.equal(result.delivery_address, "ရန်ကုန် အင်းလျားလမ်း ၁၄");
  assert.equal(result.items[0]?.quantity, 2);
  assert.equal(result.items[0]?.unit_price_mmk, 22500);
  assert.ok(result.missing_fields.includes("customer_phone"));
});

test("missing or ambiguous details stay unknown", () => {
  const result = parseSimulatedChat("Can I get tote bag? Please tell me the price later.");
  assert.equal(result.items[0]?.product_name, "tote bag");
  assert.equal(result.items[0]?.quantity, null);
  assert.equal(result.items[0]?.unit_price_mmk, null);
  assert.equal(result.customer_name, null);
  assert.equal(result.delivery_address, null);
  assert.ok(result.missing_fields.includes("items.quantity"));
  assert.ok(result.missing_fields.includes("items.unit_price_mmk"));
});
