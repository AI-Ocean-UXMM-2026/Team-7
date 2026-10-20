"use client";

import { useRef, useState } from "react";
import { Icon } from "@ocean/ui";
import {
  chatOrderExtractionSchema,
  chatOrderResponseSchema,
  orderDetailsSchema,
  saveOrderSchema,
  type ChatOrderExtraction,
} from "@ocean/contracts";
import { calculateOrderTotals, parseSimulatedChat } from "@ocean/core";
import {
  canAnalyzeHostedDraft,
  canConfirmHostedDraft,
  canMutateHostedDraft,
  resolveHostedSave,
  startNewHostedDraft,
  type HostedDraftPhase,
} from "./draft-lock";
import { ScreenshotToOrderWorkflow } from "./screenshot-workflow";

type View = "home" | "chat" | "match";
type FieldSource = "extracted" | "missing" | "manual";
type EditableItem = {
  key: string;
  product_name: string;
  product_name_source: FieldSource;
  quantity: string;
  quantity_source: FieldSource;
  unit_price_mmk: string;
  unit_price_mmk_source: FieldSource;
};
type EditableOrder = {
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
  items: EditableItem[];
};

const englishSample = "Hi! Could I get two Mira tote bags at 22,500 kyat each? Deliver to 14 Inya Road, Yangon. The name is Thiri Mon. Phone 09 777 222 111.";
const burmeseSample = "မင်္ဂလာပါ။ Mira tote bag နှစ်လုံး၊ တစ်လုံး ၂၂,၅၀၀ ကျပ်။ ရန်ကုန် အင်းလျားလမ်း ၁၄ ကိုပို့ပေးပါ။ နာမည်က သီရိမွန်ပါ။ ဖုန်း ၀၉ ၇၇၇ ၂၂၂ ၁၁၁။";

function text(value: string | null) { return value ?? ""; }
function amount(value: number | null) { return value === null ? "" : String(value); }
function source(value: string | null): FieldSource { return value ? "extracted" : "missing"; }
function integer(value: string) {
  if (!/^\d+$/.test(value.trim())) return null;
  const result = Number(value);
  return Number.isSafeInteger(result) ? result : null;
}

function orderFromExtraction(extraction: ChatOrderExtraction, createKey = () => crypto.randomUUID()): EditableOrder {
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
    items: parsed.items.map(item => ({
      key: createKey(),
      product_name: text(item.product_name),
      product_name_source: source(item.product_name),
      quantity: item.quantity === null ? "" : String(item.quantity),
      quantity_source: item.quantity === null ? "missing" : "extracted",
      unit_price_mmk: amount(item.unit_price_mmk),
      unit_price_mmk_source: item.unit_price_mmk === null ? "missing" : "extracted",
    })),
  };
}

function emptyOrder() {
  return orderFromExtraction({
    customer_name: null,
    customer_phone: null,
    delivery_address: null,
    notes: null,
    delivery_fee_mmk: null,
    discount_mmk: null,
    items: [{ product_name: null, quantity: null, unit_price_mmk: null }],
    missing_fields: [],
  }, () => "initial");
}

function draftTotals(order: EditableOrder) {
  const items = order.items.map(item => ({ quantity: integer(item.quantity) ?? -1, unit_price_mmk: integer(item.unit_price_mmk) ?? -1 }));
  const delivery = integer(order.delivery_fee_mmk);
  const discount = integer(order.discount_mmk);
  if (delivery === null || discount === null || items.some(item => item.quantity < 1 || item.unit_price_mmk < 0)) return { subtotal_mmk: null, total_mmk: null };
  try { return calculateOrderTotals(items, delivery, discount); }
  catch { return { subtotal_mmk: null, total_mmk: null }; }
}

function validationErrors(order: EditableOrder) {
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

function mmk(value: number | null) { return value === null ? "—" : `${value.toLocaleString("en-US")} MMK`; }

function SourceTag({ source: value }: { source: FieldSource }) {
  return <span className={`hosted-source hosted-source-${value}`}>{value === "extracted" ? "From message" : value === "manual" ? "Edited" : "Needs input"}</span>;
}

export function HostedAssistantPanel({ shopId, shopName }: { shopId: string; shopName: string }) {
  const [view, setView] = useState<View>("home");
  const [chat, setChat] = useState(englishSample);
  const [order, setOrder] = useState<EditableOrder>(() => emptyOrder());
  const [hasOrder, setHasOrder] = useState(false);
  const [draftPhase, setDraftPhase] = useState<HostedDraftPhase>("editable");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "simulation">("simulation");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const saving = draftPhase === "saving";
  const confirmed = draftPhase === "saved";

  function draftIsMutable() {
    return canMutateHostedDraft(draftPhase, inFlight.current);
  }

  function lockedDraftNotice() {
    setNotice(confirmed ? "This order is saved. Start a new draft to analyze another conversation." : "The order is being saved. Please wait for the readback to finish.");
  }

  function editField(field: keyof Pick<EditableOrder, "customer_name" | "customer_phone" | "delivery_address" | "notes" | "delivery_fee_mmk" | "discount_mmk">, value: string) {
    if (!draftIsMutable()) { lockedDraftNotice(); return; }
    setOrder(current => ({ ...current, [field]: value, [`${field}_source`]: "manual" } as EditableOrder));
    setNotice("Your correction is marked Edited. Review the complete order before confirming.");
  }

  function editItem(index: number, field: keyof Pick<EditableItem, "product_name" | "quantity" | "unit_price_mmk">, value: string) {
    if (!draftIsMutable()) { lockedDraftNotice(); return; }
    const sourceField = field === "product_name" ? "product_name_source" : field === "quantity" ? "quantity_source" : "unit_price_mmk_source";
    setOrder(current => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value, [sourceField]: "manual" as const } : item) }));
    setNotice("Your correction is marked Edited. Review the complete order before confirming.");
  }

  function updateChat(value: string) {
    if (!draftIsMutable()) { lockedDraftNotice(); return; }
    setChat(value);
  }

  function useSampleChat() {
    if (!draftIsMutable()) { lockedDraftNotice(); return; }
    setChat(current => current.startsWith("မင်္ဂလာပါ") ? englishSample : burmeseSample);
  }

  function addItem() {
    if (!draftIsMutable()) { lockedDraftNotice(); return; }
    setOrder(current => ({ ...current, items: [...current.items, { key: crypto.randomUUID(), product_name: "", product_name_source: "manual", quantity: "1", quantity_source: "manual", unit_price_mmk: "", unit_price_mmk_source: "missing" }] }));
  }

  function removeItem(index: number) {
    if (!draftIsMutable()) { lockedDraftNotice(); return; }
    setOrder(current => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
  }

  async function analyze() {
    if (!canAnalyzeHostedDraft(draftPhase, inFlight.current)) { lockedDraftNotice(); return; }
    if (!chat.trim()) { setNotice("Paste a customer conversation before analyzing it."); return; }
    setBusy(true);
    setHasOrder(false);
    setOrderId(null);
    setNotice("Dolphin is thinking…");
    try {
      const response = await fetch("/api/ai/chat-to-order", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat: chat.trim(), shop_id: shopId }),
      });
      const body: unknown = await response.json();
      const parsed = chatOrderResponseSchema.safeParse(body);
      if (!parsed.success) throw new Error(response.ok ? "The assistant returned an unsupported response." : "The hosted assistant could not analyze this conversation.");
      if (parsed.data.mode === "live") {
        setOrder(orderFromExtraction(parsed.data.extraction));
        setMode("live");
        setNotice(parsed.data.message ?? "AI extraction complete. Review every field before saving.");
      } else if (parsed.data.mode === "simulation") {
        setOrder(orderFromExtraction(parsed.data.extraction));
        setMode("simulation");
        setNotice(parsed.data.message);
      } else {
        setOrder(orderFromExtraction(parsed.data.fallback));
        setMode("simulation");
        setNotice(parsed.data.error);
      }
      setOrderId(crypto.randomUUID());
      setHasOrder(true);
    } catch (error) {
      setOrder(orderFromExtraction(parseSimulatedChat(chat.trim())));
      setOrderId(crypto.randomUUID());
      setMode("simulation");
      setHasOrder(true);
      setNotice(error instanceof Error ? `${error.message} A clearly marked local simulation is ready for review; no order was saved.` : "The hosted assistant was unavailable. A clearly marked local simulation is ready for review; no order was saved.");
    } finally { setBusy(false); }
  }

  async function confirmOrder() {
    if (!canConfirmHostedDraft(draftPhase, inFlight.current)) { lockedDraftNotice(); return; }
    const errors = validationErrors(order);
    if (errors.length) { setNotice("Complete the highlighted order fields. A phone number is required when a delivery address is present; use 0 for an unstated delivery fee or discount."); return; }
    const stableId = orderId ?? crypto.randomUUID();
    setOrderId(stableId);
    const payload = {
      shop_id: shopId,
      id: stableId,
      expected_updated_at: null,
      customer_name: order.customer_name.trim(),
      customer_phone: order.customer_phone.trim() || null,
      delivery_address: order.delivery_address.trim() || null,
      notes: order.notes.trim() || null,
      order_status: "confirmed" as const,
      fulfillment_status: "unfulfilled" as const,
      delivery_fee_mmk: integer(order.delivery_fee_mmk) ?? 0,
      discount_mmk: integer(order.discount_mmk) ?? 0,
      items: order.items.map(item => ({ product_name: item.product_name.trim(), quantity: integer(item.quantity) ?? 0, unit_price_mmk: integer(item.unit_price_mmk) ?? 0 })),
    };
    const valid = saveOrderSchema.safeParse(payload);
    if (!valid.success) { setNotice("The order changed while it was being reviewed. Check the highlighted fields and try again."); return; }
    inFlight.current = true;
    setDraftPhase("saving");
    setNotice("Saving the confirmed order and reading it back…");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(valid.data),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "The authenticated order workflow could not save this order.";
        throw new Error(message);
      }
      const saved = body && typeof body === "object" && "order" in body ? body.order : null;
      if (!orderDetailsSchema.safeParse(saved).success) throw new Error("The order save returned no valid readback. Reload Sales Management before retrying.");
      setDraftPhase(resolveHostedSave("saving", "success"));
      setNotice("Order saved and read back from the authenticated Sales workflow.");
    } catch (error) {
      setDraftPhase(resolveHostedSave("saving", "failure"));
      setNotice(error instanceof Error ? error.message : "Live save failed. The stable draft ID is preserved for a safe retry.");
    } finally {
      inFlight.current = false;
    }
  }

  function startNewDraft() {
    const nextPhase = startNewHostedDraft(draftPhase, inFlight.current);
    if (!nextPhase) { lockedDraftNotice(); return; }
    setDraftPhase(nextPhase);
    setOrder(emptyOrder());
    setOrderId(null);
    setHasOrder(false);
    setMode("simulation");
    setChat(englishSample);
    setView("chat");
    setNotice("New draft ready. Review every value before confirming.");
  }

  const totals = draftTotals(order);
  const errors = hasOrder ? validationErrors(order) : [];
  return <main className="hosted-assistant-shell">
    <header className="hosted-assistant-header">
      <div><span className="eyebrow">Hosted seller assistant · {shopName}</span><h1>SaleSayar AI</h1><p>From conversation to a reviewed order.</p></div>
      <span className="hosted-workspace-link">Sales Management remains in the web workspace</span>
    </header>
    <div className="hosted-assistant-body">
      <div className="hosted-assistant-ribbon"><span aria-hidden="true">●</span> Private hosted session <span>·</span> {mode === "live" ? "AI extraction" : "Simulation fallback when provider is unavailable"}</div>
      {view === "home" ? <>
        <section className="hosted-welcome"><span className="eyebrow">A little help with the busy bits</span><h2>Your shop, a little simpler.</h2><p>Review every suggestion before anything reaches your orders.</p></section>
        <div className="hosted-action-list" aria-label="Choose an assistant workflow">
          <button className="hosted-action-card hosted-action-primary" onClick={() => { setView("chat"); setNotice(""); }}><span className="hosted-action-icon"><Icon name="sales" size={22} /></span><span><strong>Chat to Order</strong><small>Turn a customer conversation into an editable order</small></span><span aria-hidden="true">→</span></button>
          <button className="hosted-action-card hosted-action-secondary" onClick={() => { setView("match"); setNotice(""); }}><span className="hosted-action-icon"><Icon name="wallet" size={22} /></span><span><strong>Screenshot to Order Match</strong><small>Preview a local image without verifying payment</small></span><span aria-hidden="true">→</span></button>
        </div>
        <div className="hosted-safety-note"><strong>Review first</strong><span>AI never saves an order without your confirmation. A screenshot alone cannot confirm received funds.</span></div>
      </> : <>
        <button className="hosted-back-link" disabled={saving} onClick={() => { setView("home"); setNotice(""); }}>← Back to assistant</button>
        {view === "chat" ? <section className="hosted-workflow" aria-labelledby="hosted-chat-heading">
          <div className="hosted-workflow-heading"><Icon name="sales" /><div><span className="eyebrow">A conversation, organized</span><h2 id="hosted-chat-heading">Chat to Order</h2></div></div>
          <label className="hosted-field-label" htmlFor="hosted-customer-chat">Customer conversation</label>
          <p className="hosted-field-hint">Paste English, Burmese, or mixed-language text. The seller reviews every extracted value.</p>
          <textarea id="hosted-customer-chat" className="hosted-chat-input" maxLength={20_000} value={chat} disabled={saving || confirmed} onChange={event => updateChat(event.target.value)} />
          <button className="hosted-sample-link" disabled={saving || confirmed} onClick={useSampleChat}>文 Use {chat.startsWith("မင်္ဂလာပါ") ? "English" : "Burmese"} sample</button>
          <button className="hosted-primary-button" disabled={busy || saving || confirmed} onClick={() => void analyze()}>{busy ? "Dolphin is thinking…" : saving ? "Saving draft…" : confirmed ? "Saved · start a new draft below" : "Analyze conversation"}</button>
          {busy && <div className="hosted-status-card" role="status">Reading names, items, amounts, and missing details…</div>}
          {hasOrder && <section className="hosted-order-preview" aria-labelledby="hosted-order-heading">
            <div className="hosted-preview-heading"><div><span className="eyebrow">Editable order draft</span><h3 id="hosted-order-heading">Review before confirmation</h3></div><span className={`hosted-mode hosted-mode-${mode}`}>{mode === "live" ? "AI" : "Simulation"}</span></div>
            <p className="hosted-note">{mode === "live" ? "AI returned a structured draft. Confirm that every value matches the customer message." : "Simulation is clearly marked and never pretends to be a verified AI result."}</p>
            {errors.length > 0 && <div className="hosted-missing" role="status"><strong>Seller review needed</strong><span>Missing or invalid details stay visible until corrected. Phone is required for delivery.</span></div>}
            <div className="hosted-fields">
              <label>Customer name <SourceTag source={order.customer_name_source} /><input disabled={saving || confirmed} value={order.customer_name} onChange={event => editField("customer_name", event.target.value)} /></label>
              <label>Phone <SourceTag source={order.customer_phone_source} /><input disabled={saving || confirmed} value={order.customer_phone} onChange={event => editField("customer_phone", event.target.value)} /></label>
              <label className="hosted-wide">Delivery address <SourceTag source={order.delivery_address_source} /><textarea disabled={saving || confirmed} rows={2} value={order.delivery_address} onChange={event => editField("delivery_address", event.target.value)} /></label>
              <label className="hosted-wide">Notes <SourceTag source={order.notes_source} /><textarea disabled={saving || confirmed} rows={2} value={order.notes} onChange={event => editField("notes", event.target.value)} /></label>
            </div>
            <div className="hosted-items-heading"><strong>Products</strong><button className="hosted-text-button" disabled={saving || confirmed} type="button" onClick={addItem}>+ Add product</button></div>
            <div className="hosted-items">{order.items.map((item, index) => <div className="hosted-item" key={item.key}><div className="hosted-item-heading"><span>Item {index + 1}</span>{order.items.length > 1 && <button className="hosted-text-button hosted-danger" disabled={saving || confirmed} type="button" onClick={() => removeItem(index)}>Remove</button>}</div><label>Product <SourceTag source={item.product_name_source} /><input disabled={saving || confirmed} value={item.product_name} onChange={event => editItem(index, "product_name", event.target.value)} /></label><div className="hosted-item-grid"><label>Quantity <SourceTag source={item.quantity_source} /><input disabled={saving || confirmed} type="number" min="1" value={item.quantity} onChange={event => editItem(index, "quantity", event.target.value)} /></label><label>Unit price (MMK) <SourceTag source={item.unit_price_mmk_source} /><input disabled={saving || confirmed} type="number" min="0" step="1" value={item.unit_price_mmk} onChange={event => editItem(index, "unit_price_mmk", event.target.value)} /></label></div></div>)}</div>
            <div className="hosted-item-grid"><label>Delivery fee (MMK) <SourceTag source={order.delivery_fee_mmk_source} /><input disabled={saving || confirmed} type="number" min="0" step="1" value={order.delivery_fee_mmk} onChange={event => editField("delivery_fee_mmk", event.target.value)} /></label><label>Discount (MMK) <SourceTag source={order.discount_mmk_source} /><input disabled={saving || confirmed} type="number" min="0" step="1" value={order.discount_mmk} onChange={event => editField("discount_mmk", event.target.value)} /></label></div>
            <div className="hosted-total"><span>Deterministic MMK total</span><strong>{mmk(totals.total_mmk)}</strong></div><p className="hosted-total-note">Subtotal: {mmk(totals.subtotal_mmk)} · Delivery and discount remain separate.</p>
            <button className="hosted-primary-button" disabled={saving || confirmed} onClick={() => void confirmOrder()}>{saving ? "Saving and reading back…" : confirmed ? "Order already confirmed" : "Confirm and save order"}</button>
            {confirmed && <div className="hosted-success" role="status"><strong>Order saved and read back</strong><span>The authenticated Sales workflow returned the saved record.</span><button className="hosted-secondary-button" type="button" onClick={startNewDraft}>Start a new draft</button></div>}
          </section>}
        </section> : <ScreenshotToOrderWorkflow shopId={shopId} />}
      </>}
      {notice && !busy && <p className="hosted-notice" role="status">{notice}</p>}
    </div>
    <footer className="hosted-assistant-footer">Private hosted session · shop access is checked before live AI extraction and order save.</footer>
  </main>;
}
