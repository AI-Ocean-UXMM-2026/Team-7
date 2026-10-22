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

test("copied Messenger sender labels provide the customer name", () => {
  const result = parseSimulatedChat(
    "Yoon Yati Linn: White tshirt L at 25,000 kyat 12:42 PM\nPhone: 09 777 222 111",
  );
  assert.equal(result.customer_name, "Yoon Yati Linn");
  assert.equal(result.customer_phone, "09 777 222 111");
});

test("seller shorthand keeps the product line, address, quantity, and customer label separate", () => {
  const result = parseSimulatedChat([
    "black hoodie XL ငါးထည်ယူမယ်",
    "Yankin ကိုပို့ပေးပါ",
    "0912345678",
    "COD ပါ",
    "customer-Yoon",
  ].join("\n"));
  assert.equal(result.customer_name, "Yoon");
  assert.equal(result.customer_phone, "0912345678");
  assert.equal(result.delivery_address, "Yankin");
  assert.equal(result.items[0]?.product_name, "black hoodie XL");
  assert.equal(result.items[0]?.quantity, 5);
});

test("copied seller chat reads customer labels and an explicit quantity from separate lines", () => {
  const result = parseSimulatedChat(
    "black hoodie XL qty-2\nYankin ကိုပို့ပေးပါ\n0912345678\nCOD ပါ\ncustomer-Yoon",
  );
  assert.equal(result.customer_name, "Yoon");
  assert.equal(result.delivery_address, "Yankin");
  assert.equal(result.items[0]?.product_name, "black hoodie XL");
  assert.equal(result.items[0]?.quantity, 2);
});

test("quantity stays missing when a product line has no explicit quantity", () => {
  const result = parseSimulatedChat("black hoodie XL\ncustomer-Yoon");
  assert.equal(result.items[0]?.quantity, null);
  assert.ok(result.missing_fields.includes("items.quantity"));
});

test("accepts common English labels, x quantity notation, and delivery labels", () => {
  const result = parseSimulatedChat([
    "Name - Su Su",
    "Phone: +95 9 421 555 888",
    "Address - 22 Bogyoke Road, Yangon",
    "Item: x2 black hoodie XL at 35000 MMK",
  ].join("\n"));
  assert.equal(result.customer_name, "Su Su");
  assert.equal(result.customer_phone, "+95 9 421 555 888");
  assert.equal(result.delivery_address, "22 Bogyoke Road, Yangon");
  assert.equal(result.items[0]?.product_name, "black hoodie XL");
  assert.equal(result.items[0]?.quantity, 2);
  assert.equal(result.items[0]?.unit_price_mmk, 35000);
});

test("accepts Burmese labels and Burmese digit quantities", () => {
  const result = parseSimulatedChat([
    "အမည် - မေမေ",
    "ဖုန်း - ၀၉၁၂၃၄၅၆၇၈၉",
    "လိပ်စာ - မန္တလေး ၃၅ လမ်း",
    "အနက်ရောင် hoodie ၂ ထည် ၃၅,၀၀၀ ကျပ်",
  ].join("\n"));
  assert.equal(result.customer_name, "မေမေ");
  assert.equal(result.customer_phone, "09123456789");
  assert.equal(result.delivery_address, "မန္တလေး ၃၅ လမ်း");
  assert.equal(result.items[0]?.quantity, 2);
  assert.equal(result.items[0]?.unit_price_mmk, 35000);
});

test("extracts multiple phone numbers, clean product names without conversation filler, and multiple products", () => {
  const result = parseSimulatedChat([
    "မင်္ဂလာပါ အစ်မ",
    "အမည် ဒေါ်အေးအေး",
    "ဖုန်း - 09 777 222 111 / 09 888 333 222",
    "လိပ်စာ - လှည်းတန်းလမ်း၊ ကမာရွတ်မြို့နယ်",
    "lipstick ပန်းရောင် ၂ ဘူး ယူမယ်နော် တစ်ဘူး ၂၅,၀၀၀ ကျပ်",
    "foundation ၁ ဘူး ၃၅,၀၀၀ ကျပ်",
  ].join("\n"));
  assert.equal(result.customer_name, "ဒေါ်အေးအေး");
  assert.equal(result.customer_phone, "09 777 222 111 / 09 888 333 222");
  assert.equal(result.delivery_address, "လှည်းတန်းလမ်း၊ ကမာရွတ်မြို့နယ်");
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0]?.product_name, "lipstick ပန်းရောင်");
  assert.equal(result.items[0]?.quantity, 2);
  assert.equal(result.items[0]?.unit_price_mmk, 25000);
  assert.equal(result.items[1]?.product_name, "foundation");
  assert.equal(result.items[1]?.quantity, 1);
  assert.equal(result.items[1]?.unit_price_mmk, 35000);
});

