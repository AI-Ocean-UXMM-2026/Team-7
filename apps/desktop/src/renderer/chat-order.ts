import {
  chatOrderExtractionSchema,
  type ChatOrderExtraction,
} from "@ocean/contracts";
import { calculateOrderTotals, parseSimulatedChat } from "@ocean/core";
import type { AssistantDraftFields } from "../main/contract.js";

export type FieldSource = "extracted" | "missing" | "manual";
export type EditableChatOrder = AssistantDraftFields["order"];
export type EditableChatOrderItem = EditableChatOrder["items"][number];

export type DraftTotals = {
  subtotal_mmk: number | null;
  total_mmk: number | null;
};

export type ExtractionResult = {
  order: EditableChatOrder;
  mode: "simulation";
  notice: string;
};

function text(value: string | null) {
  return value ?? "";
}

function amount(value: number | null) {
  return value === null ? "" : String(value);
}

function source(value: string | null) : FieldSource {
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
    notes_source: source(parsed.notes),
    delivery_fee_mmk: amount(parsed.delivery_fee_mmk),
    delivery_fee_mmk_source: parsed.delivery_fee_mmk === null ? "missing" : "extracted",
    discount_mmk: amount(parsed.discount_mmk),
    discount_mmk_source: parsed.discount_mmk === null ? "missing" : "extracted",
    items: parsed.items.map(itemFromExtraction),
  };
}

export function emptyEditableOrder(): EditableChatOrder {
  return editableOrderFromExtraction({
    customer_name: null,
    customer_phone: null,
    delivery_address: null,
    notes: null,
    delivery_fee_mmk: null,
    discount_mmk: null,
    items: [{ product_name: null, quantity: null, unit_price_mmk: null }],
    missing_fields: [],
  });
}

function integer(value: string) {
  if (!/^\d+$/.test(value.trim())) return null;
  const result = Number(value);
  return Number.isSafeInteger(result) ? result : null;
}

export function draftTotals(order: EditableChatOrder): DraftTotals {
  const items = order.items.map((item) => ({
    quantity: integer(item.quantity) ?? -1,
    unit_price_mmk: integer(item.unit_price_mmk) ?? -1,
  }));
  const delivery = integer(order.delivery_fee_mmk);
  const discount = integer(order.discount_mmk);
  if (delivery === null || discount === null || items.some((item) => item.quantity < 1 || item.unit_price_mmk < 0)) {
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
  if (integer(order.delivery_fee_mmk) === null || integer(order.delivery_fee_mmk)! < 0) errors.push("delivery_fee_mmk");
  if (integer(order.discount_mmk) === null || integer(order.discount_mmk)! < 0) errors.push("discount_mmk");
  if (draftTotals(order).total_mmk === null) errors.push("totals");
  return [...new Set(errors)];
}

export async function extractChatOrder(chat: string): Promise<ExtractionResult> {
  return {
    order: editableOrderFromExtraction(parseSimulatedChat(chat)),
    mode: "simulation" as const,
    notice: "Offline simulation: this local panel never sends customer messages to a service. Use the hosted assistant for live AI and authenticated saving.",
  };
}

export function formatMmk(value: number | null) {
  return value === null ? "—" : `${value.toLocaleString("en-US")} MMK`;
}

