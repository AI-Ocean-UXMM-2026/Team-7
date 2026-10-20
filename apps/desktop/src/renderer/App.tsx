import { useEffect, useRef, useState } from "react";
import { Icon } from "@ocean/ui";
import type { AssistantDraftFields } from "../main/contract.js";
import { Launcher } from "./Launcher";
import { canConfirmDraft, resolveDraftOrderId } from "./draft-identity";
import sampleTransfer from "./assets/demo-transfer.svg?url";
import dolphin from "../../../../assets/dolphin/dolphin-accountant.png";
import {
  draftTotals,
  emptyEditableOrder,
  extractChatOrder,
  formatMmk,
  validateEditableOrder,
  type EditableChatOrder,
  type EditableChatOrderItem,
  type FieldSource,
} from "./chat-order";

type View = "home" | "chat" | "match";

const englishSample =
  "Hi! Could I get two Mira tote bags at 22,500 kyat each? Deliver to 14 Inya Road, Yangon. The name is Thiri Mon.";
const burmeseSample =
  "မင်္ဂလာပါ။ Mira tote bag နှစ်လုံး၊ တစ်လုံး ၂၂,၅၀၀ ကျပ်။ ရန်ကုန် အင်းလျားလမ်း ၁၄ ကိုပို့ပေးပါ။ နာမည်က သီရိမွန်ပါ။";

const defaultFields: AssistantDraftFields = {
  view: "home",
  chat: englishSample,
  order: emptyEditableOrder(),
  hasOrder: false,
  confirmed: false,
  orderId: null,
  notice: "",
  extractionMode: "simulation",
};

function SourceTag({ source }: { source: FieldSource }) {
  const label = source === "extracted" ? "From message" : source === "manual" ? "Edited" : "Needs input";
  return <span className={`field-source field-source-${source}`}>{label}</span>;
}

function AssistantPanel() {
  const [view, setView] = useState<View>(defaultFields.view);
  const [chat, setChat] = useState(defaultFields.chat);
  const [order, setOrder] = useState<EditableChatOrder>(() => emptyEditableOrder());
  const [hasOrder, setHasOrder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const orderIdRef = useRef<string | null>(null);
  const confirmationInFlight = useRef(false);
  const [notice, setNotice] = useState("");
  const [extractionMode, setExtractionMode] = useState<"live" | "simulation">("simulation");
  const [screenshot, setScreenshot] = useState("");
  const [screenshotName, setScreenshotName] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    void window.assistant.loadDraft().then((draft) => {
      if (!mounted) return;
      if (draft) {
        setView(draft.fields.view);
        setChat(draft.fields.chat);
        setOrder(draft.fields.order);
        setHasOrder(draft.fields.hasOrder);
        setConfirmed(draft.fields.confirmed);
        setOrderId(draft.fields.orderId);
        orderIdRef.current = draft.fields.orderId;
        setNotice(draft.fields.notice);
        setExtractionMode(draft.fields.extractionMode);
        setScreenshot(draft.screenshot?.source ?? "");
        setScreenshotName(draft.screenshot?.name ?? "");
      }
      setDraftReady(true);
    }).catch(() => {
      if (mounted) setDraftReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const fields: AssistantDraftFields = {
      view,
      chat,
      order,
      hasOrder,
      confirmed,
      orderId,
      notice,
      extractionMode,
    };
    window.assistant.saveDraftFields(fields);
  }, [draftReady, view, chat, order, hasOrder, confirmed, orderId, notice, extractionMode]);

  useEffect(() => {
    if (!draftReady) return;
    window.assistant.saveDraftScreenshot(screenshot ? { source: screenshot, name: screenshotName } : null);
  }, [draftReady, screenshot, screenshotName]);

  function editTextField(
    field: "customer_name" | "customer_phone" | "delivery_address" | "notes" | "delivery_fee_mmk" | "discount_mmk",
    value: string,
  ) {
    const sourceField = `${field}_source` as keyof EditableChatOrder;
    setOrder((current) => ({ ...current, [field]: value, [sourceField]: "manual" } as EditableChatOrder));
    setConfirmed(false);
    setNotice("Your correction is marked Edited. Review the complete order before confirming.");
  }

  function editItem(index: number, field: "product_name" | "quantity" | "unit_price_mmk", value: string) {
    const sourceField = field === "product_name" ? "product_name_source" : field === "quantity" ? "quantity_source" : "unit_price_mmk_source";
    setOrder((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index
        ? { ...item, [field]: value, [sourceField]: "manual" as const }
        : item),
    }));
    setConfirmed(false);
    setNotice("Your correction is marked Edited. Review the complete order before confirming.");
  }

  function addItem() {
    const item: EditableChatOrderItem = {
      key: crypto.randomUUID(),
      product_name: "",
      product_name_source: "manual",
      quantity: "1",
      quantity_source: "manual",
      unit_price_mmk: "",
      unit_price_mmk_source: "missing",
    };
    setOrder((current) => ({ ...current, items: [...current.items, item] }));
    setConfirmed(false);
  }

  function removeItem(index: number) {
    if (order.items.length === 1) return;
    setOrder((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
    setConfirmed(false);
  }

  async function analyzeChat() {
    if (!chat.trim()) {
      setNotice("Paste a customer conversation before analyzing it.");
      return;
    }
    setBusy(true);
    setHasOrder(false);
    setConfirmed(false);
    setNotice("Dolphin is thinking…");
    try {
      const result = await extractChatOrder(chat.trim());
      setOrder(result.order);
      const nextOrderId = resolveDraftOrderId(null, () => crypto.randomUUID());
      orderIdRef.current = nextOrderId;
      setOrderId(nextOrderId);
      setExtractionMode(result.mode);
      setHasOrder(true);
      setNotice(result.notice);
    } catch {
      setOrder(emptyEditableOrder());
      const nextOrderId = resolveDraftOrderId(null, () => crypto.randomUUID());
      orderIdRef.current = nextOrderId;
      setOrderId(nextOrderId);
      setExtractionMode("simulation");
      setHasOrder(true);
      setNotice("The conversation could not be analyzed. A blank simulation draft is ready for manual entry.");
    } finally {
      setBusy(false);
    }
  }

  function confirmOrder() {
    if (!canConfirmDraft(confirmed, confirmationInFlight.current)) {
      setNotice(confirmed ? "This draft is already confirmed. Analyze a new conversation to create another draft." : "A confirmation is already in progress. Please wait for its result.");
      return;
    }
    const errors = validateEditableOrder(order);
    if (errors.length > 0) {
      setConfirmed(false);
      setNotice("Complete the highlighted order fields. A phone number is required when a delivery address is present; use 0 for an unstated delivery fee or discount.");
      return;
    }

    const stableOrderId = resolveDraftOrderId(orderIdRef.current, () => crypto.randomUUID());
    orderIdRef.current = stableOrderId;
    setOrderId(stableOrderId);
    confirmationInFlight.current = true;
    setConfirmed(true);
    setNotice("Offline sample confirmation complete. No order was saved. Configure the hosted assistant origin to use live AI and authenticated saving.");
    confirmationInFlight.current = false;
  }

  function readLocalImage(file: File | undefined) {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type) || file.size > 8 * 1024 * 1024) {
      setNotice("Choose a JPG, PNG, WebP, or GIF image under 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        setNotice("The local image could not be previewed.");
        return;
      }
      setScreenshot(reader.result);
      setScreenshotName(file.name);
      setNotice("Local preview only. The image has not been uploaded or verified.");
    });
    reader.addEventListener("error", () => setNotice("The local image could not be read."));
    reader.readAsDataURL(file);
  }

  function useExampleImage() {
    setScreenshot(sampleTransfer);
    setScreenshotName("synthetic-transfer-example.svg");
    setNotice("Sample image selected. This illustration is not a real transaction.");
  }

  if (window.location.search.includes("view=launcher")) return <Launcher />;

  if (!draftReady) {
    return <main className="assistant-shell" aria-live="polite"><div className="panel-scroll">Restoring your draft…</div></main>;
  }

  const totals = draftTotals(order);
  const validationErrors = hasOrder ? validateEditableOrder(order) : [];
  return (
    <main className="assistant-shell">
      <header className="panel-header">
        <div className="header-drag" aria-hidden="true"><span className="panel-mark"><img src={dolphin} alt="" /></span><span className="title-copy"><strong>SaleSayar AI</strong><small>YOUR SELLER ASSISTANT</small></span></div>
        <div className="window-actions"><button className="window-action" aria-label="Minimize assistant" title="Minimize assistant" onClick={() => void window.assistant.hideAssistant()}>−</button><button className="window-action close-action" aria-label="Close assistant and keep draft" title="Close assistant and keep draft" onClick={() => void window.assistant.hideAssistant()}>×</button></div>
      </header>
      <div className="panel-scroll">
        <div className="demo-ribbon"><span aria-hidden="true">●</span> Offline simulation <span className="ribbon-divider">·</span> Hosted live mode opens on the configured web origin</div>
        {view === "home" ? (
          <>
            <section className="panel-welcome"><span className="eyebrow">A little help with the busy bits</span><h1>Your shop, a little simpler.</h1><p>A little help turning conversations into clearer next steps.</p></section>
            <div className="action-list" aria-label="Choose an assistant workflow">
              <button className="action-card chat-action" onClick={() => { setView("chat"); setNotice(""); }}><span className="action-icon chat-icon"><Icon name="sales" size={22} /></span><span className="action-copy"><strong>Chat to Order</strong><small>Turn a conversation into an editable, validated order</small></span><span className="action-arrow" aria-hidden="true">→</span></button>
              <button className="action-card match-action" onClick={() => { setView("match"); setNotice(""); }}><span className="action-icon match-icon"><Icon name="wallet" size={22} /></span><span className="action-copy"><strong>Screenshot to Order Match</strong><small>Preview an image and review a sample match</small></span><span className="action-arrow" aria-hidden="true">→</span></button>
            </div>
            <div className="assistant-note"><span className="note-mark">i</span><p>This local panel never sends customer messages or saves orders. The hosted assistant handles live AI only after seller sign-in and shop authorization. Nothing automatically verifies payment.</p></div>
          </>
        ) : (
          <>
            <button className="back-link" onClick={() => { setView("home"); setNotice(""); }}><span aria-hidden="true">←</span> Back to assistant</button>
            {view === "chat" ? (
              <section className="workflow" aria-labelledby="chat-heading">
                <div className="workflow-heading"><span className="workflow-icon"><Icon name="sales" /></span><div><span className="eyebrow">A conversation, organized</span><h1 id="chat-heading">Chat to Order</h1></div></div>
                <label className="field-label" htmlFor="customer-chat">Customer conversation</label>
                <p className="field-hint">Paste English, Burmese, or mixed-language text. The seller reviews every extracted value.</p>
                <textarea id="customer-chat" className="chat-input" value={chat} maxLength={20_000} onChange={(event) => setChat(event.target.value)} placeholder="Paste a customer conversation…" />
                <button className="language-sample" onClick={() => setChat((current) => current.startsWith("မင်္ဂလာပါ") ? englishSample : burmeseSample)}><span aria-hidden="true">文</span> Use {chat.startsWith("မင်္ဂလာပါ") ? "English" : "Burmese"} sample</button>
                <button className="primary-button analyze-button" disabled={busy} onClick={() => void analyzeChat()}>{busy ? <><span className="button-spinner" aria-hidden="true" /> Dolphin is thinking…</> : "Analyze conversation"}</button>
                {busy && <div className="thinking-card" role="status"><span className="thinking-mascot"><img src={dolphin} alt="" /></span><span><strong>Reading the conversation</strong><small>Checking names, items, amounts, and missing details.</small></span><span className="thinking-dots" aria-hidden="true"><i /><i /><i /></span></div>}
                {hasOrder && (
                  <section className="order-preview" aria-labelledby="order-heading">
                    <div className="preview-header"><div><span className="eyebrow">Editable order draft</span><h2 id="order-heading">Review before confirmation</h2></div><span className={`preview-badge preview-badge-${extractionMode}`}>{extractionMode === "live" ? "AI" : "Simulation"}</span></div>
                    <p className="fixture-note">This local panel is offline simulation only. The hosted assistant provides live AI after seller sign-in; confirm that every value matches the customer message.</p>
                    {validationErrors.length > 0 && <div className="missing-card" role="status"><strong>Seller review needed</strong><span>Missing or invalid details stay visible until you correct them. Phone is required for delivery; use 0 for an unstated delivery fee or discount.</span></div>}
                    <div className="field-grid">
                      <label className="form-field"><span className="field-label-row">Customer name <SourceTag source={order.customer_name_source} /></span><input autoComplete="off" value={order.customer_name} onChange={(event) => editTextField("customer_name", event.target.value)} /></label>
                      <label className="form-field"><span className="field-label-row">Phone <SourceTag source={order.customer_phone_source} /></span><input autoComplete="off" value={order.customer_phone} onChange={(event) => editTextField("customer_phone", event.target.value)} /></label>
                      <label className="form-field field-wide"><span className="field-label-row">Delivery address <SourceTag source={order.delivery_address_source} /></span><textarea value={order.delivery_address} onChange={(event) => editTextField("delivery_address", event.target.value)} rows={2} /></label>
                      <label className="form-field field-wide"><span className="field-label-row">Notes <SourceTag source={order.notes_source} /></span><textarea value={order.notes} onChange={(event) => editTextField("notes", event.target.value)} rows={2} /></label>
                    </div>
                    <div className="items-heading"><strong>Products</strong><button type="button" className="text-button" onClick={addItem}>+ Add product</button></div>
                    <div className="draft-items">{order.items.map((item, index) => <div className="draft-item" key={item.key}><div className="draft-item-title"><span>Item {index + 1}</span>{order.items.length > 1 && <button type="button" className="text-button danger-text" onClick={() => removeItem(index)}>Remove</button>}</div><label className="form-field"><span className="field-label-row">Product <SourceTag source={item.product_name_source} /></span><input value={item.product_name} onChange={(event) => editItem(index, "product_name", event.target.value)} /></label><div className="field-grid item-fields"><label className="form-field"><span className="field-label-row">Quantity <SourceTag source={item.quantity_source} /></span><input inputMode="numeric" type="number" min="1" max="1000000" value={item.quantity} onChange={(event) => editItem(index, "quantity", event.target.value)} /></label><label className="form-field"><span className="field-label-row">Unit price (MMK) <SourceTag source={item.unit_price_mmk_source} /></span><input inputMode="numeric" type="number" min="0" step="1" value={item.unit_price_mmk} onChange={(event) => editItem(index, "unit_price_mmk", event.target.value)} /></label></div></div>)}</div>
                    <div className="field-grid totals-fields"><label className="form-field"><span className="field-label-row">Delivery fee (MMK) <SourceTag source={order.delivery_fee_mmk_source} /></span><input inputMode="numeric" type="number" min="0" step="1" value={order.delivery_fee_mmk} onChange={(event) => editTextField("delivery_fee_mmk", event.target.value)} /></label><label className="form-field"><span className="field-label-row">Discount (MMK) <SourceTag source={order.discount_mmk_source} /></span><input inputMode="numeric" type="number" min="0" step="1" value={order.discount_mmk} onChange={(event) => editTextField("discount_mmk", event.target.value)} /></label></div>
                    <div className="line-total"><span>Deterministic MMK total</span><strong>{formatMmk(totals.total_mmk)}</strong></div><p className="total-breakdown">Subtotal: {formatMmk(totals.subtotal_mmk)} · Delivery and discount are separate fields.</p>
                    <button className="primary-button confirm-button" disabled={confirmed} onClick={confirmOrder}>{confirmed ? "Order already confirmed" : "Confirm offline sample"}</button>
                    {confirmed && <div className="confirmation-note" role="status"><img className="reaction-mascot" src={dolphin} alt="" /><span><strong>Sample order reviewed</strong><small>Confirmation simulated. No live order was saved.</small></span></div>}
                  </section>
                )}
              </section>
            ) : (
              <section className="workflow" aria-labelledby="match-heading">
                <div className="workflow-heading"><span className="workflow-icon"><Icon name="wallet" /></span><div><span className="eyebrow">A helpful second look</span><h1 id="match-heading">Screenshot to Order Match</h1></div></div>
                <div className="security-note"><strong>Review, then check your records</strong><p>Matching is simulated. Images stay on this device. A screenshot alone cannot confirm received funds.</p></div>
                <div className="sample-actions"><button className="primary-button sample-button" onClick={useExampleImage}>Use sample image</button><label className="secondary-button file-button">Choose local image<input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => readLocalImage(event.currentTarget.files?.[0])} /></label></div>
                {screenshot && <><figure className="image-preview"><img src={screenshot} alt="Selected local image preview" /><figcaption><span>Local image preview</span><span>{screenshotName}</span></figcaption></figure><section className="match-card" aria-labelledby="match-order-heading"><div className="preview-header"><div><span className="eyebrow">Suggested order</span><h2 id="match-order-heading">Possible order match</h2></div><span className="match-score">Sample</span></div><p className="fixture-note">This preset suggestion does not analyze your image.</p><div className="match-order"><div className="order-symbol"><Icon name="orders" /></div><div><strong>Order #SS-1048</strong><small>Thiri Mon · 2 × Mira tote bag</small></div></div><div className="match-detail"><span>Illustrative amount</span><strong>45,000 MMK</strong></div><div className="review-status"><span className="review-dot" aria-hidden="true" /><span><strong>Needs your review</strong><small>Suggestion only · no transfer status is set</small></span></div><button className="secondary-button review-button" onClick={() => setNotice("Suggestion reviewed for this session. Check trusted payment records before confirming funds. No payment status has changed.")}>Review suggestion</button></section></>}
              </section>
            )}
          </>
        )}
        {notice && !busy && <p className="status-message" role="status">{notice}</p>}
        <footer className="panel-footer"><span className="footer-pulse" aria-hidden="true" /> Offline simulation · live mode uses the hosted assistant origin</footer>
      </div>
    </main>
  );
}

export default function AssistantApp() {
  if (window.location.search.includes("view=launcher")) return <Launcher />;
  return <AssistantPanel />;
}
