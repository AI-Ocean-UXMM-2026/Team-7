import {
  chatOrderExtractionSchema,
  chatOrderResponseSchema,
  type ChatOrderExtraction,
} from "@ocean/contracts";
import { calculateOrderTotals, parseSimulatedChat } from "@ocean/core";

export type FieldSource = "extracted" | "missing" | "manual";

export interface EditableChatOrderItem {
  key: string;
  product_name: string;
  product_name_source: FieldSource;
  quantity: string;
  quantity_source: FieldSource;
  unit_price_mmk: string;
  unit_price_mmk_source: FieldSource;
}

export interface EditableChatOrder {
  customer_name: string;
  customer_name_source: FieldSource;
  customer_phone: string;
  customer_phone_source: FieldSource;
  delivery_address: string;
  delivery_address_source: FieldSource;
  notes: string;
  notes_source: FieldSource;
  delivery_fee_mmk: string;
  delivery_fee_mmk_source: FieldSource;
  discount_mmk: string;
  discount_mmk_source: FieldSource;
  items: EditableChatOrderItem[];
}

export type DraftTotals = {
  subtotal_mmk: number | null;
  total_mmk: number | null;
};

export type ExtractionResult = {
  order: EditableChatOrder;
  mode: "live" | "simulation";
  notice: string;
};

function text(value: string | null) {
  return value ?? "";
}

function amount(value: number | null) {
  return value === null ? "" : String(value);
}

function source(value: string | null): FieldSource {
  return value ? "extracted" : "missing";
}

function itemFromExtraction(item: ChatOrderExtraction["items"][number]): EditableChatOrderItem {
  return {
    key: crypto.randomUUID(),
    product_name: text(item.product_name),
    product_name_source: source(item.product_name),
    quantity: item.quantity === null ? "" : String(item.quantity),
    quantity_source: item.quantity === null ? "missing" : "extracted",
    unit_price_mmk: amount(item.unit_price_mmk),
    unit_price_mmk_source: item.unit_price_mmk === null ? "missing" : "extracted",
  };
}

export function editableOrderFromExtraction(extraction: ChatOrderExtraction): EditableChatOrder {
  const parsed = chatOrderExtractionSchema.parse(extraction);
  return {
    customer_name: text(parsed.customer_name),
    customer_name_source: source(parsed.customer_name),
    customer_phone: text(parsed.customer_phone),
    customer_phone_source: source(parsed.customer_phone),
    delivery_address: text(parsed.delivery_address),
    delivery_address_source: source(parsed.delivery_address),
    notes: text(parsed.notes),
    notes_source: parsed.notes ? "extracted" : "manual",
    delivery_fee_mmk: amount(parsed.delivery_fee_mmk) || "0",
    delivery_fee_mmk_source: parsed.delivery_fee_mmk !== null ? "extracted" : "manual",
    discount_mmk: amount(parsed.discount_mmk) || "0",
    discount_mmk_source: parsed.discount_mmk !== null ? "extracted" : "manual",
    items: parsed.items.map(itemFromExtraction),
  };
}

export function emptyEditableOrder(): EditableChatOrder {
  return editableOrderFromExtraction({
    customer_name: null,
    customer_phone: null,
    delivery_address: null,
    notes: null,
    delivery_fee_mmk: 0,
    discount_mmk: 0,
    items: [{ product_name: null, quantity: null, unit_price_mmk: null }],
    missing_fields: [],
  });
}

function integer(value: string) {
  if (!/^\d+$/.test(value.trim())) return null;
  const result = Number(value);
  return Number.isSafeInteger(result) ? result : null;
}

function parseOptionalInt(value: string | null | undefined, defaultValue = 0): number | null {
  if (!value || !value.trim()) return defaultValue;
  return integer(value);
}

export function draftTotals(order: EditableChatOrder): DraftTotals {
  const items = order.items.map((item) => ({
    quantity: integer(item.quantity) ?? -1,
    unit_price_mmk: integer(item.unit_price_mmk) ?? -1,
  }));
  const delivery = parseOptionalInt(order.delivery_fee_mmk, 0);
  const discount = parseOptionalInt(order.discount_mmk, 0);
  if (
    delivery === null ||
    delivery < 0 ||
    discount === null ||
    discount < 0 ||
    items.some((item) => item.quantity < 1 || item.unit_price_mmk < 0)
  ) {
    return { subtotal_mmk: null, total_mmk: null };
  }
  try {
    return calculateOrderTotals(items, delivery, discount);
  } catch {
    return { subtotal_mmk: null, total_mmk: null };
  }
}

export function validateEditableOrder(order: EditableChatOrder) {
  const errors: string[] = [];
  if (!order.customer_name.trim()) errors.push("customer_name");
  if (order.delivery_address.trim() && !order.customer_phone.trim()) errors.push("customer_phone");
  order.items.forEach((item, index) => {
    if (!item.product_name.trim()) errors.push(`items.${index}.product_name`);
    const quantity = integer(item.quantity);
    const price = integer(item.unit_price_mmk);
    if (quantity === null || quantity < 1) errors.push(`items.${index}.quantity`);
    if (price === null || price < 0) errors.push(`items.${index}.unit_price_mmk`);
  });
  const delivery = parseOptionalInt(order.delivery_fee_mmk, 0);
  if (delivery === null || delivery < 0) errors.push("delivery_fee_mmk");
  const discount = parseOptionalInt(order.discount_mmk, 0);
  if (discount === null || discount < 0) errors.push("discount_mmk");
  if (draftTotals(order).total_mmk === null) errors.push("totals");
  return [...new Set(errors)];
}

export async function extractChatOrder(chat: string, shopId?: string): Promise<ExtractionResult> {
  try {
    const res = await fetch("/api/ai/chat-to-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat, shop_id: shopId }),
    });
    if (res.ok) {
      const data = await res.json();
      const parsed = chatOrderResponseSchema.safeParse(data);
      if (parsed.success && parsed.data.mode === "live") {
        return {
          order: editableOrderFromExtraction(parsed.data.extraction),
          mode: "live",
          notice: parsed.data.message || "✓ Order details extracted with AI! Review and confirm.",
        };
      }
    }
  } catch {
    // Network or server error - fallback to deterministic parser
  }

  return {
    order: editableOrderFromExtraction(parseSimulatedChat(chat)),
    mode: "simulation",
    notice: "Your order draft is ready. Review every field before confirming.",
  };
}

export type ConversationMessage = {
  id: string;
  sender: string | null;
  text: string;
};

function cleanMessageLine(line: string) {
  return line
    .replace(/\s+\d{1,2}:\d{2}\s*(?:AM|PM)\s*(?:✓✓|✓)?\s*$/iu, "")
    .replace(/\s+(?:✓✓|✓)\s*$/u, "")
    .trim();
}

export function splitConversationMessages(value: string): ConversationMessage[] {
  return value
    .split(/\r?\n/u)
    .map(cleanMessageLine)
    .filter(Boolean)
    .map((line, index) => {
      const labeled = line.match(/^([^:：]{1,80})[:：]\s*(.+)$/u);
      return {
        id: `message-${index}-${line.length}`,
        sender: labeled?.[1]?.trim() || null,
        text: labeled?.[2]?.trim() || line,
      };
    });
}

const details = {
  customer_name: { my: "အမည်", en: "customer name" },
  customer_phone: { my: "ဖုန်းနံပါတ်", en: "phone number" },
  delivery_address: { my: "ပို့ဆောင်ရမည့်လိပ်စာ", en: "delivery address" },
  product_name: { my: "မှာယူမည့်ပစ္စည်း", en: "product" },
  quantity: { my: "အရေအတွက်", en: "quantity" },
  unit_price_mmk: { my: "ပစ္စည်းဈေးနှုန်း", en: "item price" },
} as const;

function detailKey(field: string): keyof typeof details | null {
  if (field.includes("product_name")) return "product_name";
  if (field.includes("quantity")) return "quantity";
  if (field.includes("unit_price_mmk")) return "unit_price_mmk";
  if (field === "customer_name" || field === "customer_phone" || field === "delivery_address") return field;
  return null;
}

function naturalList(values: string[], conjunction: string) {
  if (values.length < 2) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} ${conjunction} ${values.at(-1)}`;
}

export function buildCustomerReplies(
  missingFields: string[],
  orderSummary?: {
    customerName?: string;
    itemsSummary?: string;
    totalMmk?: number | null;
    deliveryAddress?: string;
    phone?: string;
  },
) {
  const keys = [...new Set(missingFields.map(detailKey).filter((key): key is keyof typeof details => key !== null))];
  const name = orderSummary?.customerName?.trim();
  const items = orderSummary?.itemsSummary?.trim();
  const totalStrMy = orderSummary?.totalMmk ? `${orderSummary.totalMmk.toLocaleString("en-US")} ကျပ်` : "";
  const totalStrEn = orderSummary?.totalMmk ? `${orderSummary.totalMmk.toLocaleString("en-US")} MMK` : "";
  const address = orderSummary?.deliveryAddress?.trim();

  if (keys.length === 0) {
    if (name || items) {
      return {
        my: `မင်္ဂလာပါရှင့်${name ? ` ${name}` : ""}။ မှာယူထားသော ${items || "ပစ္စည်းများ"}${totalStrMy ? ` စုစုပေါင်း ${totalStrMy}` : ""}${address ? ` (${address} သို့ ပို့ဆောင်ရန်)` : ""} ကို အတည်ပြုလက်ခံရရှိပါပြီရှင့်။ အော်ဒါပို့ဆောင်ပေးပါမယ်ရှင့်။ ကျေးဇူးတင်ပါတယ်ရှင့်။`,
        en: `Hello${name ? ` ${name}` : ""}, thank you for ordering ${items || "items"}${totalStrEn ? ` (Total: ${totalStrEn})` : ""}${address ? ` to ${address}` : ""}. Your order has been received and confirmed. Thank you!`,
      };
    }
    return {
      my: "ကျေးဇူးတင်ပါတယ်ရှင့်။ အော်ဒါအသေးစိတ်ကို စစ်ဆေးပြီး အတည်ပြုပေးပါမယ်ရှင့်။",
      en: "Thank you. We’ll review your order details and confirm them with you shortly.",
    };
  }

  const myDetails = naturalList(keys.map((key) => details[key].my), "နှင့်");
  const enDetails = naturalList(keys.map((key) => details[key].en), "and");

  if (name || items) {
    return {
      my: `မင်္ဂလာပါရှင့်${name ? ` ${name}` : ""}။ ${items ? `${items} မှာယူထားတာ လက်ခံရရှိပါပြီရှင့်။ ` : ""}အော်ဒါပို့ဆောင်ပေးဖို့အတွက် ${myDetails} လေး ပို့ပေးပါဦးရှင့်။ ကျေးဇူးတင်ပါတယ်ရှင့်။`,
      en: `Hello${name ? ` ${name}` : ""}, thank you for ordering${items ? ` ${items}` : ""}. To confirm and deliver your order, please provide your ${enDetails}. Thank you!`,
    };
  }

  return {
    my: `အော်ဒါတင်ပေးဖို့ ${myDetails} လေး ပို့ပေးပါရှင့်။ ကျေးဇူးတင်ပါတယ်ရှင့်။`,
    en: `To place your order, please send your ${enDetails}. Thank you.`,
  };
}
