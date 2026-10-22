import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@ocean/ui";
import type { AssistantDraftFields } from "../main/contract.js";
import { Launcher } from "./Launcher";
import { PaymentReview } from "./PaymentReview";
import { canConfirmDraft, resolveDraftOrderId } from "./draft-identity";
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
import {
  buildCustomerReplies,
  selectedConversation,
  splitConversationMessages,
  type ConversationMessage,
} from "./conversation-tools";

type View = "home" | "chat" | "match";

const defaultFields: AssistantDraftFields = {
  view: "home",
  chat: "",
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
  const [confirmed, setConfirmed] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const orderIdRef = useRef<string | null>(null);
  const confirmationInFlight = useRef(false);
  const [notice, setNotice] = useState("");
  const [extractionMode, setExtractionMode] = useState<"live" | "simulation">("simulation");
  const [screenshot, setScreenshot] = useState("");
  const [screenshotName, setScreenshotName] = useState("");
  const [screenshotRevision, setScreenshotRevision] = useState(0);
  const [draftReady, setDraftReady] = useState(false);
  const [myReply, setMyReply] = useState("");
  const [enReply, setEnReply] = useState("");
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const conversationMessages = useMemo(() => splitConversationMessages(chat), [chat]);

  useEffect(() => {
    let mounted = true;
    void window.assistant.loadDraft().then((draft) => {
      if (!mounted) return;
      if (draft) {
        setView(draft.fields.view);
        setChat(draft.fields.chat);
        setSelectedMessageIds(new Set(splitConversationMessages(draft.fields.chat).map((message) => message.id)));
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

  async function pasteFromClipboard() {
    try {
      const clipboardText = await window.assistant.readClipboardText();
      if (!clipboardText.trim()) {
        setNotice("Your clipboard is empty. Copy the customer messages first.");
        return;
      }
      setChat(clipboardText);
      setSelectedMessageIds(new Set(splitConversationMessages(clipboardText).map((message) => message.id)));
      setHasOrder(false);
      setConfirmed(false);
      setNotice("Conversation pasted. Select the messages you want to use, then create the order.");
    } catch {
      setNotice("The assistant could not read your clipboard. Copy the messages and try again.");
    }
  }

  function toggleMessage(message: ConversationMessage) {
    setSelectedMessageIds((current) => {
      const next = new Set(current);
      if (next.has(message.id)) next.delete(message.id);
      else next.add(message.id);
      return next;
    });
  }

  function selectAllMessages() {
    setSelectedMessageIds(new Set(conversationMessages.map((message) => message.id)));
  }

  function clearSelectedMessages() {
    setSelectedMessageIds(new Set());
  }

  async function copyText(text: string, successMessage: string) {
    try {
      await window.assistant.writeClipboardText(text);
      setNotice(successMessage);
    } catch {
      setNotice("The response could not be copied. Select the text and copy it manually.");
    }
  }

  async function copySelectedMessages() {
    const conversation = selectedConversation(conversationMessages, selectedMessageIds);
    if (!conversation) {
      setNotice("Select at least one message before copying.");
      return;
    }
    await copyText(conversation, "Selected customer messages copied to clipboard.");
  }

  async function analyzeChat() {
    const conversation = selectedConversation(conversationMessages, selectedMessageIds);
    if (!conversation.trim()) {
      setNotice("Select at least one customer message before creating an order.");
      return;
    }
    setHasOrder(false);
    setConfirmed(false);
    setOrder(emptyEditableOrder());
    const nextOrderId = resolveDraftOrderId(null, () => crypto.randomUUID());
    orderIdRef.current = nextOrderId;
    setOrderId(nextOrderId);
    setExtractionMode("simulation");
    setNotice("Reading the selected messages…");
    try {
      const result = await extractChatOrder(conversation);
      setOrder(result.order);
      setHasOrder(true);
      const replies = buildCustomerReplies(validateEditableOrder(result.order));
      setMyReply(replies.my);
      setEnReply(replies.en);
      setNotice(result.notice);
    } catch {
      setNotice("The conversation could not be organized. Check the copied text and try again.");
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
    setNotice("Order confirmed. You can continue managing it from your workspace.");
    confirmationInFlight.current = false;
  }

  function readLocalImage(file: File | undefined) {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type) || file.size > 8 * 1024 * 1024) {
      setNotice("Choose a JPG, PNG, or WebP image under 8 MiB.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        setNotice("The local image could not be previewed.");
        return;
      }
      setScreenshot(reader.result);
      setScreenshotRevision(current => current + 1);
      setScreenshotName(file.name);
      setNotice("Transaction image ready. Analyze it in this assistant and review every field.");
    });
    reader.addEventListener("error", () => setNotice("The local image could not be read."));
    reader.readAsDataURL(file);
  }

  async function pasteTransactionImage() {
    try {
      const source = await window.assistant.readClipboardImage();
      if (!source) {
        setNotice("The clipboard has no image. Copy a transaction screenshot first.");
        return;
      }
      setScreenshot(source);
      setScreenshotRevision(current => current + 1);
      setScreenshotName("Pasted transaction.png");
      setNotice("Transaction image ready. Analyze it in this assistant and review every field.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The copied image could not be read.");
    }
  }

  if (window.location.search.includes("view=launcher")) return <Launcher />;

  if (!draftReady) {
    return <main className="assistant-shell" aria-live="polite"><div className="panel-scroll">Restoring your draft…</div></main>;
  }

  const totals = draftTotals(order);
  const validationErrors = hasOrder ? validateEditableOrder(order) : [];
  const customerReplies = buildCustomerReplies(validationErrors);
  const visibleMyReply = myReply || customerReplies.my;
  const visibleEnReply = enReply || customerReplies.en;
  return (
    <main className="assistant-shell">
      <header className="panel-header">
        <div className="header-drag" aria-hidden="true"><span className="panel-mark"><img src={dolphin} alt="" /></span><span className="title-copy"><strong>တူတူတွက်မယ်</strong><small>YOUR SELLER ASSISTANT</small></span></div>
        <div className="window-actions"><button className="window-action" aria-label="Minimize assistant" title="Minimize assistant" onClick={() => void window.assistant.hideAssistant()}>−</button><button className="window-action close-action" aria-label="Close assistant and keep draft" title="Close assistant and keep draft" onClick={() => void window.assistant.hideAssistant()}>×</button></div>
      </header>
      <div className="panel-scroll">
        {view === "home" ? (
          <>
            <section className="panel-welcome"><div className="welcome-mascot" aria-hidden="true"><span className="welcome-ripple" /><img src={dolphin} alt="" /></div><span className="eyebrow">Ready when you are</span><h1>What are we working on?</h1><p>Turn customer conversations and payment screenshots into clear next steps.</p></section>
            <div className="action-list" aria-label="Choose an assistant workflow">
              <button className="action-card chat-action" onClick={() => { setView("chat"); setNotice(""); }}><span className="action-icon chat-icon"><Icon name="sales" size={22} /></span><span className="action-copy"><strong>Chat to Order</strong><small>Turn a conversation into an editable, validated order</small></span><span className="action-arrow" aria-hidden="true">→</span></button>
              <button className="action-card match-action" onClick={() => { setView("match"); setNotice(""); }}><span className="action-icon match-icon"><Icon name="wallet" size={22} /></span><span className="action-copy"><strong>Match Payment to Order</strong><small>Extract transaction details and connect the right order</small></span><span className="action-arrow" aria-hidden="true">→</span></button>
            </div>
            <button className="website-link" onClick={() => void window.assistant.openWebsite().catch(() => setNotice("Your workspace could not be opened. Check the website connection and try again."))}><Icon name="home" size={17} /><span>Open တူတူတွက်မယ် workspace</span><span aria-hidden="true">↗</span></button>
          </>
        ) : (
          <>
            <button className="back-link" onClick={() => { setView("home"); setNotice(""); }}><span aria-hidden="true">←</span> Back to assistant</button>
            {view === "chat" ? (
              <section className="workflow" aria-labelledby="chat-heading">
                <div className="workflow-heading"><span className="workflow-icon"><Icon name="sales" /></span><div><span className="eyebrow">A conversation, organized</span><h1 id="chat-heading">Chat to Order</h1></div></div>
                <label className="field-label" htmlFor="customer-chat">Customer conversation</label>
                <p className="field-hint">Copy messages from Messenger or TikTok, paste them here, select the customer messages, and review every extracted value.</p>
                <div className="capture-actions">
                  <button type="button" className="secondary-button" onClick={() => void pasteFromClipboard()}>Paste from clipboard</button>
                  <span className="capture-source">Messenger · TikTok</span>
                </div>
                <textarea id="customer-chat" className="chat-input" value={chat} maxLength={20_000} onChange={(event) => { const value = event.target.value; setChat(value); setSelectedMessageIds(new Set(splitConversationMessages(value).map((message) => message.id))); }} placeholder="Paste a customer conversation…" />
                {conversationMessages.length > 0 && (
                  <section className="message-selector" aria-label="Select messages for this order">
                    <div className="selector-header"><strong>Choose messages for this order</strong><span>{selectedMessageIds.size}/{conversationMessages.length} selected</span></div>
                    <div className="selector-actions"><button type="button" className="text-button" onClick={selectAllMessages}>Select all</button><button type="button" className="text-button" onClick={clearSelectedMessages}>Clear</button><button type="button" className="text-button" onClick={() => void copySelectedMessages()}>Copy selected</button></div>
                    <div className="message-list">{conversationMessages.map((message) => <label className={`message-row ${selectedMessageIds.has(message.id) ? "message-row-selected" : ""}`} key={message.id}><input type="checkbox" checked={selectedMessageIds.has(message.id)} onChange={() => toggleMessage(message)} /><span><strong>{message.sender ?? "Customer message"}</strong><small>{message.text}</small></span></label>)}</div>
                  </section>
                )}
                <button className="primary-button analyze-button" onClick={() => void analyzeChat()}>Create order from selected messages</button>
                {hasOrder && (
                  <section className="order-preview" aria-labelledby="order-heading">
                    <div className="preview-header"><div><span className="eyebrow">Editable order draft</span><h2 id="order-heading">Review before confirmation</h2></div></div>
                    {validationErrors.length > 0 && <div className="missing-card" role="status"><strong>Seller review needed</strong><span>Missing or invalid details stay visible until you correct them. Phone is required for delivery; use 0 for an unstated delivery fee or discount.</span></div>}
                    <section className="reply-card" aria-labelledby="reply-heading">
                      <div className="reply-card-header"><div><span className="eyebrow">Customer reply</span><h3 id="reply-heading">Ready to send</h3></div><span className="reply-state">{validationErrors.length > 0 ? "Needs details" : "Complete"}</span></div>
                      <label className="reply-field"><span>Burmese</span><textarea value={visibleMyReply} onChange={(event) => setMyReply(event.target.value)} rows={3} /></label>
                      <button type="button" className="secondary-button copy-button" onClick={() => void copyText(visibleMyReply, "Burmese reply copied to clipboard.")}>Copy Burmese reply</button>
                      <label className="reply-field"><span>English</span><textarea value={visibleEnReply} onChange={(event) => setEnReply(event.target.value)} rows={3} /></label>
                      <button type="button" className="secondary-button copy-button" onClick={() => void copyText(visibleEnReply, "English reply copied to clipboard.")}>Copy English reply</button>
                    </section>
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
                    <button className="primary-button confirm-button" disabled={confirmed} onClick={confirmOrder}>{confirmed ? "Order confirmed" : "Confirm order"}</button>
                    {confirmed && <div className="confirmation-note" role="status"><img className="reaction-mascot" src={dolphin} alt="" /><span><strong>Order confirmed</strong><small>Your reviewed order is ready in the workspace.</small></span></div>}
                  </section>
                )}
              </section>
            ) : (
              <section className="workflow" aria-labelledby="match-heading">
                <div className="workflow-heading"><span className="workflow-icon"><Icon name="wallet" /></span><div><span className="eyebrow">Connect a payment</span><h1 id="match-heading">Match Payment to Order</h1></div></div>
                <div className="security-note"><strong>Review before confirming</strong><p>Check your trusted payment records. A screenshot alone cannot confirm received funds.</p></div>
                <div className="upload-actions">
                  <label className="primary-button file-button">Choose transaction image<input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => readLocalImage(event.currentTarget.files?.[0])} /></label>
                  <button type="button" className="secondary-button" onClick={() => void pasteTransactionImage()}>Paste copied image</button>
                </div>
                <div className="image-paste-zone" tabIndex={0} role="group" aria-label="Paste a transaction screenshot" onPaste={(event) => {
                  const file = Array.from(event.clipboardData.files).find(item => item.type.startsWith("image/"));
                  if (file) { event.preventDefault(); readLocalImage(file); }
                  else setNotice("Copy a transaction screenshot and paste it here, or use Paste copied image.");
                }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
                  event.preventDefault();
                  readLocalImage(event.dataTransfer.files?.[0]);
                }}>Click here and press Ctrl+V, or drop a transaction screenshot</div>
                {screenshot && <><figure className="image-preview"><img src={screenshot} alt="Selected transaction image" /><figcaption><span>Transaction image</span><span>{screenshotName}</span></figcaption></figure><PaymentReview key={screenshotRevision} image={screenshot} onNotice={setNotice} /></>}
              </section>
            )}
          </>
        )}
        {notice && <p className="status-message" role="status">{notice}</p>}
        <footer className="panel-footer"><span className="footer-pulse" aria-hidden="true" /> တူတူတွက်မယ် is ready</footer>
      </div>
    </main>
  );
}

export default function AssistantApp() {
  if (window.location.search.includes("view=launcher")) return <Launcher />;
  return <AssistantPanel />;
}
