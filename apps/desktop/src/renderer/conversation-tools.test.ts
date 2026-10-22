import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomerReplies,
  selectedConversation,
  splitConversationMessages,
} from "./conversation-tools.ts";

test("splits copied Messenger text into selectable customer messages", () => {
  const messages = splitConversationMessages([
    "Yoon Yati Linn: White tshirt L တစ်ထည်ယူမယ် ဖုန်း 09xxxxxxxxx 12:42 PM",
    "black hoodie XL တစ်ထည်ယူမယ် Yankin ကိုပို့ပေးပါ COD ပါ 12:43 PM",
  ].join("\n"));

  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.sender, "Yoon Yati Linn");
  assert.match(messages[0]?.text ?? "", /White tshirt L/u);
  assert.doesNotMatch(messages[0]?.text ?? "", /12:42 PM/u);
});

test("combines only selected messages for order extraction", () => {
  const messages = splitConversationMessages("one\ntwo\nthree");
  assert.equal(selectedConversation(messages, new Set([messages[0]!.id, messages[2]!.id])), "one\nthree");
});

test("builds Burmese and English replies that request actual missing details", () => {
  const replies = buildCustomerReplies(["customer_phone", "delivery_address", "items.0.unit_price_mmk"]);

  assert.match(replies.my, /ဖုန်းနံပါတ်/u);
  assert.match(replies.my, /ပို့ဆောင်ရမည့်လိပ်စာ/u);
  assert.match(replies.en, /phone number/i);
  assert.match(replies.en, /delivery address/i);
  assert.doesNotMatch(replies.en, /customer name/i);
});

test("builds a confirmation reply when required order details are complete", () => {
  const replies = buildCustomerReplies([]);
  assert.match(replies.my, /အော်ဒါအသေးစိတ်/u);
  assert.match(replies.en, /order details/i);
});
