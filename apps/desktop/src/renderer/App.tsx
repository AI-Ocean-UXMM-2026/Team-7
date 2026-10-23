import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  splitConversationMessages,
} from "./conversation-tools";
import { VoucherCard, type VoucherOrder } from "./VoucherModal";

type View = "home" | "chat" | "match";

const ASSISTANT_STRINGS = {
  en: {
    title: "တူတူတွက်မယ်",
    subtitle: "YOUR SELLER ASSISTANT",
    chatToOrder: "Chat to Order",
    chatToOrderDesc: "Turn customer messages into instant vouchers",
    matchPayment: "Match Payment to Order",
    matchPaymentDesc: "Verify transaction slip & connect order",
    backHome: "Back to home",
    openWorkspace: "Open workspace ↗",
    pasteFromClipboard: "📋 Paste from clipboard",
    writeOrder: "✏️ Write order",
    useTemplate: "✨ Use Template",
    templateNotice: "Template inserted! Fill in the customer details.",
    writePlaceholderNew: "Type customer conversation or order details (e.g. Daw Aye Aye, 09777222111, Kamayut, Lipstick 2 pcs 25000 kyat)…",
    writePlaceholderAppend: "Type new message or additional details (e.g. Daw Aye Aye, 09777222111, Kamayut)…",
    generateVoucher: "Generate Voucher",
    generating: "Generating voucher…",
    updateVoucher: "Update Voucher with New Message",
    pasteTitle: "Paste Customer Order",
    pasteDesc: "Copy customer chat from Facebook or TikTok, then click here to generate voucher.",
    pasteButton: "📋 Paste & Generate Voucher",
    analyzing: "Analyzing & Generating Voucher…",
    newOrder: "+ New Order",
  },
  my: {
    title: "တူတူတွက်မယ်",
    subtitle: "အရောင်းအထောက်အကူ",
    chatToOrder: "ချက်တင်မှ ဘောက်ချာထုတ်ရန်",
    chatToOrderDesc: "ဖောက်သည်စကားပြောချက်များမှ ချက်ချင်းဘောက်ချာထုတ်ယူပါ",
    matchPayment: "ငွေလွှဲစလစ်နှင့် အော်ဒါတိုက်ဆိုင်စစ်ဆေးရန်",
    matchPaymentDesc: "ငွေလွှဲပြေစာကို အတည်ပြုပြီး အော်ဒါနှင့် တွဲဆက်ပါ",
    backHome: "မူလစာမျက်နှာသို့",
    openWorkspace: "အရောင်းစနစ်ဖွင့်ရန် ↗",
    pasteFromClipboard: "📋 ကလစ်ဘုတ်မှ ကူးယူထည့်ရန်",
    writeOrder: "✏️ စာရိုက်ထည့်ရန်",
    useTemplate: "✨ ပုံစံထည့်ရန်",
    templateNotice: "အော်ဒါပုံစံ ထည့်သွင်းပြီးပါပြီ။ အချက်အလက်များ ဖြည့်စွက်ပေးပါ။",
    writePlaceholderNew: "ဖောက်သည်ပြောကြားချက် သို့မဟုတ် အော်ဒါအချက်အလက် ရိုက်ထည့်ပါ (ဥပမာ - ဒေါ်အေးအေး၊ ၀၉၇၇၇၂၂၂၁၁၁၊ ကမာရွတ်၊ နှုတ်ခမ်းနီ ၂ ခု ၂၅၀၀၀ ကျပ်)...",
    writePlaceholderAppend: "ဖြည့်စွက်အချက်အလက် သို့မဟုတ် မက်ဆေ့ခ်ျအသစ် ရိုက်ထည့်ပါ...",
    generateVoucher: "ဘောက်ချာထုတ်ရန်",
    generating: "ဘောက်ချာထုတ်နေပါသည်...",
    updateVoucher: "မက်ဆေ့ခ်ျအသစ်ဖြင့် ဘောက်ချာပြင်ဆင်ရန်",
    pasteTitle: "ဖောက်သည်အော်ဒါ ကူးယူထည့်ရန်",
    pasteDesc: "Facebook သို့မဟုတ် TikTok မှ ဖောက်သည်ပြောကြားချက်ကို copy ကူးပြီး ဤနေရာတွင် နှိပ်၍ ဘောက်ချာထုတ်ပါ",
    pasteButton: "📋 စာကူးယူပြီး ဘောက်ချာထုတ်မည်",
    analyzing: "အချက်အလက်စစ်ဆေးပြီး ဘောက်ချာထုတ်နေပါသည်...",
    newOrder: "+ အော်ဒါအသစ်",
  },
};

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
  const label = source === "extracted" ? "AI" : source === "manual" ? "Edited" : "Required";
  return <span className={`field-source field-source-${source}`}>{label}</span>;
}

function AssistantPanel() {
  const [language, setLanguageState] = useState<"en" | "my">(() => {
    try {
      return (localStorage.getItem("salesayar_assistant_lang") as "en" | "my") || "my";
    } catch {
      return "my";
    }
  });

  const setLanguage = (lang: "en" | "my") => {
    setLanguageState(lang);
    try {
      localStorage.setItem("salesayar_assistant_lang", lang);
    } catch {}
  };

  const t = ASSISTANT_STRINGS[language] || ASSISTANT_STRINGS.en;

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
  const [savedOrder, setSavedOrder] = useState<VoucherOrder | null>(null);
  const [savedShopName, setSavedShopName] = useState("တူတူတွက်မယ် Store");
  const [connectedUserEmail, setConnectedUserEmail] = useState<string | null>(null);
  const [availableShops, setAvailableShops] = useState<Array<{ shop_id: string; shop_name: string }>>([]);
  const [activeShopId, setActiveShopId] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connectedUrl, setConnectedUrl] = useState("http://127.0.0.1:3000/");
  const [showUrlEditor, setShowUrlEditor] = useState(false);
  const [targetUrlInput, setTargetUrlInput] = useState("");
  const [chatInputMode, setChatInputMode] = useState<"paste" | "write">("paste");
  const [showEditForm, setShowEditForm] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const burmeseTemplate = "အမည်- \nလိပ်စာ- \nဖုန်းနံပါတ်- \nပစ္စည်း- \nအရေအတွက်- ";
  const englishTemplate = "Name- \nAddress- \nPhone number- \nItem- \nQuantity- ";

  function applyTemplate() {
    const tpl = language === "my" ? burmeseTemplate : englishTemplate;
    setChat(tpl);
    setChatInputMode("write");
    setNotice(t.templateNotice);
  }

  const resetOrderState = useCallback(() => {
    setChat("");
    setHasOrder(false);
    setConfirmed(false);
    setSavedOrder(null);
    setOrderId(null);
    orderIdRef.current = null;
    setOrder(emptyEditableOrder());
    setShowEditForm(false);
    setNotice(language === "my" ? "အော်ဒါအသစ်အတွက် အဆင်သင့်ဖြစ်ပါပြီ" : "Ready for new order.");
  }, [language]);

  const refreshShopContext = useCallback(async () => {
    try {
      const ctx = await window.assistant.getShopContext();
      if (ctx) {
        if (ctx.shop_name) setSavedShopName(ctx.shop_name);
        if (ctx.shop_id) setActiveShopId(ctx.shop_id);
        if (ctx.user_email) setConnectedUserEmail(ctx.user_email);
        if (ctx.shops) setAvailableShops(ctx.shops);
      }
    } catch {}
  }, []);

  useEffect(() => {
    void refreshShopContext();
  }, [refreshShopContext, connectedUrl]);

  useEffect(() => {
    void window.assistant.getWebsiteUrl().then((url) => {
      if (url) {
        setConnectedUrl(url);
        setTargetUrlInput(url);
      }
    }).catch(() => {});
  }, []);

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
    setSavedOrder(null);
    setOrder((current) => ({ ...current, [field]: value, [sourceField]: "manual" } as EditableChatOrder));
    setConfirmed(false);
  }

  function editItem(index: number, field: "product_name" | "quantity" | "unit_price_mmk", value: string) {
    const sourceField = field === "product_name" ? "product_name_source" : field === "quantity" ? "quantity_source" : "unit_price_mmk_source";
    setSavedOrder(null);
    setOrder((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index
        ? { ...item, [field]: value, [sourceField]: "manual" as const }
        : item),
    }));
    setConfirmed(false);
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
    setSavedOrder(null);
    setOrder((current) => ({ ...current, items: [...current.items, item] }));
    setConfirmed(false);
  }

  function removeItem(index: number) {
    if (order.items.length === 1) return;
    setSavedOrder(null);
    setOrder((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
    setConfirmed(false);
  }

  async function copyText(text: string, successMessage: string) {
    try {
      await window.assistant.writeClipboardText(text);
      setNotice(successMessage);
    } catch {
      setNotice("Could not copy to clipboard. Select text manually.");
    }
  }

  async function generateOrderFromText(rawText: string) {
    const textToAnalyze = rawText.trim();
    if (!textToAnalyze) {
      setNotice("Please paste or write customer order details first.");
      return;
    }

    setIsExtracting(true);
    setHasOrder(false);
    setConfirmed(false);
    setSavedOrder(null);
    setNotice("Analyzing order details and generating voucher…");

    const nextOrderId = resolveDraftOrderId(null, () => crypto.randomUUID());
    orderIdRef.current = nextOrderId;
    setOrderId(nextOrderId);

    try {
      const result = await extractChatOrder(textToAnalyze);
      setOrder(result.order);
      setHasOrder(true);
      setShowEditForm(false);

      const itemsSummary = result.order.items
        .filter((it) => it.product_name)
        .map((it) => `${it.product_name} (${it.quantity || 1})`)
        .join(", ");
      const computedTotals = draftTotals(result.order);
      const replies = buildCustomerReplies(validateEditableOrder(result.order), {
        customerName: result.order.customer_name,
        itemsSummary,
        totalMmk: computedTotals.total_mmk,
        deliveryAddress: result.order.delivery_address,
        phone: result.order.customer_phone,
      });
      setMyReply(replies.my);
      setEnReply(replies.en);
      setNotice("✓ Voucher generated! Review or save as PNG.");
    } catch {
      setNotice("Could not organize conversation. Check details and try again.");
    } finally {
      setIsExtracting(false);
    }
  }

  async function handlePasteAndGenerate() {
    try {
      const clipboardText = await window.assistant.readClipboardText();
      if (!clipboardText.trim()) {
        setNotice("Clipboard is empty. Copy the customer message first.");
        return;
      }
      if (hasOrder) {
        await appendMessageAndReExtract(clipboardText);
      } else {
        setChat(clipboardText);
        setChatInputMode("paste");
        await generateOrderFromText(clipboardText);
      }
    } catch {
      setNotice("Could not read clipboard. Copy messages and try again.");
    }
  }

  async function appendMessageAndReExtract(newText: string) {
    const trimmed = newText.trim();
    if (!trimmed) return;
    const combined = chat.trim() ? `${chat.trim()}\n${trimmed}` : trimmed;
    setChat(combined);
    setIsExtracting(true);
    setNotice("Adding new message and updating voucher…");
    try {
      const result = await extractChatOrder(combined);
      setOrder((prev) => {
        const extracted = result.order;
        return {
          customer_name: extracted.customer_name || prev.customer_name,
          customer_name_source: extracted.customer_name ? extracted.customer_name_source : prev.customer_name_source,
          customer_phone: extracted.customer_phone || prev.customer_phone,
          customer_phone_source: extracted.customer_phone ? extracted.customer_phone_source : prev.customer_phone_source,
          delivery_address: extracted.delivery_address || prev.delivery_address,
          delivery_address_source: extracted.delivery_address ? extracted.delivery_address_source : prev.delivery_address_source,
          notes: extracted.notes || prev.notes,
          notes_source: extracted.notes ? extracted.notes_source : prev.notes_source,
          delivery_fee_mmk: (extracted.delivery_fee_mmk && extracted.delivery_fee_mmk !== "0") ? extracted.delivery_fee_mmk : prev.delivery_fee_mmk,
          delivery_fee_mmk_source: (extracted.delivery_fee_mmk && extracted.delivery_fee_mmk !== "0") ? extracted.delivery_fee_mmk_source : prev.delivery_fee_mmk_source,
          discount_mmk: (extracted.discount_mmk && extracted.discount_mmk !== "0") ? extracted.discount_mmk : prev.discount_mmk,
          discount_mmk_source: (extracted.discount_mmk && extracted.discount_mmk !== "0") ? extracted.discount_mmk_source : prev.discount_mmk_source,
          items: extracted.items.length > 0 && extracted.items.some((i) => i.product_name)
            ? extracted.items
            : prev.items,
        };
      });
      setSavedOrder(null);
      setConfirmed(false);
      setHasOrder(true);

      const itemsSummary = result.order.items
        .filter((it) => it.product_name)
        .map((it) => `${it.product_name} (${it.quantity || 1})`)
        .join(", ");
      const computedTotals = draftTotals(result.order);
      const replies = buildCustomerReplies(validateEditableOrder(result.order), {
        customerName: result.order.customer_name,
        itemsSummary,
        totalMmk: computedTotals.total_mmk,
        deliveryAddress: result.order.delivery_address,
        phone: result.order.customer_phone,
      });
      setMyReply(replies.my);
      setEnReply(replies.en);
      setNotice("✓ New message added! Voucher updated.");
    } catch {
      setNotice("Could not parse new message. You can also edit details directly.");
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleAppendFromClipboard() {
    try {
      const clipboardText = await window.assistant.readClipboardText();
      if (!clipboardText.trim()) {
        setNotice("Clipboard is empty. Copy the customer message first.");
        return;
      }
      await appendMessageAndReExtract(clipboardText);
    } catch {
      setNotice("Could not read clipboard. Copy message and try again.");
    }
  }

  async function confirmOrder() {
    if (!canConfirmDraft(confirmed, confirmationInFlight.current)) {
      setNotice(confirmed ? "This order is already saved to your shop." : "Saving in progress…");
      return;
    }
    const errors = validateEditableOrder(order);
    if (errors.length > 0) {
      setConfirmed(false);
      setShowEditForm(true);
      setNotice("Please complete required order fields before saving.");
      return;
    }

    const stableOrderId = resolveDraftOrderId(orderIdRef.current, () => crypto.randomUUID());
    orderIdRef.current = stableOrderId;
    setOrderId(stableOrderId);
    confirmationInFlight.current = true;
    setIsSaving(true);
    setNotice("Saving order to shop workspace…");

    try {
      const res = await window.assistant.saveOrder({
        id: stableOrderId,
        customer_name: order.customer_name.trim(),
        customer_phone: order.customer_phone.trim() || null,
        delivery_address: order.delivery_address.trim() || null,
        notes: order.notes.trim() || null,
        delivery_fee_mmk: Number(order.delivery_fee_mmk) || 0,
        discount_mmk: Number(order.discount_mmk) || 0,
        items: order.items.map((it) => ({
          product_name: it.product_name.trim(),
          quantity: Number(it.quantity) || 1,
          unit_price_mmk: Number(it.unit_price_mmk) || 0,
        })),
      });

      setSavedOrder(res.order as VoucherOrder);
      if (res.shop_name) setSavedShopName(res.shop_name);
      setConfirmed(true);
      setNotice(`✓ Order saved to ${res.shop_name}! It now appears on your Sales page.`);
      void refreshShopContext();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to save order. Verify website connection.");
    } finally {
      setIsSaving(false);
      confirmationInFlight.current = false;
    }
  }

  async function handleReconnect() {
    setIsReconnecting(true);
    setNotice("Opening browser to connect assistant…");
    try {
      const ctx = await window.assistant.reconnect();
      if (ctx) {
        if (ctx.shop_name) setSavedShopName(ctx.shop_name);
        if (ctx.shop_id) setActiveShopId(ctx.shop_id);
        if (ctx.user_email) setConnectedUserEmail(ctx.user_email);
        if (ctx.shops) setAvailableShops(ctx.shops);
        setNotice(`✓ Connected to ${ctx.shop_name} (${ctx.user_email || "Active User"})!`);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Reconnection timed out. Please try again.");
    } finally {
      setIsReconnecting(false);
    }
  }

  async function handleSelectShop(shopId: string) {
    try {
      await window.assistant.setActiveShop(shopId);
      setActiveShopId(shopId);
      const chosen = availableShops.find((s) => s.shop_id === shopId);
      if (chosen) setSavedShopName(chosen.shop_name);
      setNotice(`Active shop switched to: ${chosen?.shop_name || shopId}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to switch shop");
    }
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
        setNotice("The image could not be previewed.");
        return;
      }
      setScreenshot(reader.result);
      setScreenshotRevision((current) => current + 1);
      setScreenshotName(file.name);
      setNotice("Slip image ready. Review the extracted payment details.");
    });
    reader.addEventListener("error", () => setNotice("The image could not be read."));
    reader.readAsDataURL(file);
  }

  async function pasteTransactionImage() {
    try {
      const source = await window.assistant.readClipboardImage();
      if (!source) {
        setNotice("Clipboard has no image. Copy a payment screenshot first.");
        return;
      }
      setScreenshot(source);
      setScreenshotRevision((current) => current + 1);
      setScreenshotName("Pasted transaction.png");
      setNotice("Slip image ready. Review the extracted payment details.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The image could not be read.");
    }
  }

  if (window.location.search.includes("view=launcher")) return <Launcher />;

  if (!draftReady) {
    return (
      <main className="assistant-shell" aria-live="polite">
        <div className="panel-scroll">Loading assistant…</div>
      </main>
    );
  }

  const totals = draftTotals(order);
  const validationErrors = hasOrder ? validateEditableOrder(order) : [];
  const customerReplies = buildCustomerReplies(validationErrors, {
    customerName: order.customer_name,
    itemsSummary: order.items
      .filter((it) => it.product_name)
      .map((it) => `${it.product_name} (${it.quantity || 1})`)
      .join(", "),
    totalMmk: totals.total_mmk,
    deliveryAddress: order.delivery_address,
    phone: order.customer_phone,
  });
  const visibleMyReply = myReply || customerReplies.my;
  const visibleEnReply = enReply || customerReplies.en;

  // Single language detection according to customer sentences
  const isBurmese = /[\u1000-\u109F]/u.test(
    `${chat} ${order.customer_name} ${order.delivery_address} ${order.items.map((it) => it.product_name).join(" ")}`,
  );

  const currentVoucherOrder: VoucherOrder = {
    id: orderId || "draft",
    created_at: new Date().toISOString(),
    order_status: confirmed ? "confirmed" : "draft",
    subtotal_mmk: totals.subtotal_mmk ?? 0,
    delivery_fee_mmk: Number(order.delivery_fee_mmk) || 0,
    discount_mmk: Number(order.discount_mmk) || 0,
    total_mmk: totals.total_mmk ?? 0,
    delivery_address: order.delivery_address || null,
    notes: order.notes || null,
    customers: {
      name: order.customer_name || "Customer",
      phone: order.customer_phone || null,
    },
    order_items: order.items.map((it, idx) => ({
      id: it.key || String(idx),
      product_name: it.product_name || "Product",
      quantity: Math.max(1, Number(it.quantity) || 1),
      unit_price_mmk: Math.max(0, Number(it.unit_price_mmk) || 0),
      line_total_mmk: Math.max(1, Number(it.quantity) || 1) * Math.max(0, Number(it.unit_price_mmk) || 0),
    })),
  };

  return (
    <main className="assistant-shell">
      {/* Header with Mini Home Icon and Language Switcher */}
      <header className="panel-header">
        <div className="header-drag" aria-hidden="true">
          <span className="panel-mark">
            <img src={dolphin} alt="" />
          </span>
          <span className="title-copy">
            <strong>{t.title}</strong>
            <small>{t.subtitle}</small>
          </span>
        </div>
        <div className="window-actions">
          <div className="assistant-lang-switch" role="group" aria-label="Assistant Language">
            <button
              type="button"
              className={`lang-btn ${language === "en" ? "active" : ""}`}
              onClick={() => setLanguage("en")}
              title="Switch to English"
            >
              EN
            </button>
            <button
              type="button"
              className={`lang-btn ${language === "my" ? "active" : ""}`}
              onClick={() => setLanguage("my")}
              title="မြန်မာဘာသာသို့ ပြောင်းရန်"
            >
              မြန်မာ
            </button>
          </div>
          <button
            type="button"
            className="header-home-btn"
            title="Open workspace"
            aria-label="Open workspace"
            onClick={() => void window.assistant.openWebsite()}
          >
            <Icon name="home" size={15} />
          </button>
          <button
            className="window-action"
            aria-label="Minimize"
            title="Minimize"
            onClick={() => void window.assistant.hideAssistant()}
          >
            −
          </button>
          <button
            className="window-action close-action"
            aria-label="Close"
            title="Close"
            onClick={() => void window.assistant.hideAssistant()}
          >
            ×
          </button>
        </div>
      </header>

      <div className="panel-scroll view-enter-anim" key={view}>
        {view === "home" ? (
          <>
            {/* Mobbin-inspired Clean Hero */}
            <section className="home-hero">
              <div className="dolphin-avatar">
                <span className="welcome-ripple" />
                <img src={dolphin} alt="တူတူတွက်မယ်" />
              </div>
              <h1 className="home-title">{t.title}</h1>
              <p className="home-subtitle">{t.subtitle}</p>
            </section>

            {/* Two Clean Functions without text clutter */}
            <div className="clean-actions-list">
              <button
                type="button"
                className="clean-action-card"
                onClick={() => {
                  setView("chat");
                  setNotice("");
                }}
              >
                <div className="clean-action-icon chat-blue">
                  <Icon name="sales" size={24} />
                </div>
                <div className="clean-action-text">
                  <strong>{t.chatToOrder}</strong>
                  <span>{t.chatToOrderDesc}</span>
                </div>
                <span className="action-arrow">→</span>
              </button>

              <button
                type="button"
                className="clean-action-card"
                onClick={() => {
                  setView("match");
                  setNotice("");
                }}
              >
                <div className="clean-action-icon match-green">
                  <Icon name="wallet" size={24} />
                </div>
                <div className="clean-action-text">
                  <strong>{t.matchPayment}</strong>
                  <span>{t.matchPaymentDesc}</span>
                </div>
                <span className="action-arrow">→</span>
              </button>
            </div>

            {/* Connection Bar */}
            <div className="connection-status-bar">
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", flex: 1, minWidth: 0 }}>
                <span className="connection-indicator connected" />
                <span className="connection-text" title={connectedUrl}>
                  <code>{connectedUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</code>
                </span>
                {savedShopName && (
                  <span className="shop-badge" title={`Active shop: ${savedShopName}`}>
                    🏪 {savedShopName}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: "5px", alignItems: "center", flexShrink: 0 }}>
                {availableShops.length > 1 && (
                  <select
                    className="shop-select-mini"
                    value={activeShopId || ""}
                    onChange={(e) => void handleSelectShop(e.target.value)}
                    title="Switch shop"
                  >
                    {availableShops.map((s) => (
                      <option key={s.shop_id} value={s.shop_id}>
                        {s.shop_name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  className="switch-url-btn"
                  onClick={() => void handleReconnect()}
                  disabled={isReconnecting}
                  title="Reconnect to active browser account"
                >
                  {isReconnecting ? "Connecting…" : "🔄 Reconnect"}
                </button>
                <button
                  type="button"
                  className="switch-url-btn"
                  onClick={() => {
                    setShowUrlEditor(!showUrlEditor);
                    setTargetUrlInput(connectedUrl);
                  }}
                >
                  {showUrlEditor ? "Close" : "Change URL"}
                </button>
              </div>
            </div>

            {showUrlEditor && (
              <div className="url-editor-box">
                <div style={{ fontSize: "11px", color: "var(--text-muted, #64748b)" }}>
                  Connect to localhost (http://127.0.0.1:3000) or your Vercel deployment:
                </div>
                <input
                  type="url"
                  className="url-input"
                  value={targetUrlInput}
                  onChange={(e) => setTargetUrlInput(e.target.value)}
                  placeholder="https://ocean-ai-assistant.vercel.app or http://127.0.0.1:3000"
                />
                <div className="url-editor-actions">
                  <button
                    type="button"
                    className="primary-button url-save-btn"
                    onClick={async () => {
                      if (!targetUrlInput.trim()) return;
                      try {
                        const newUrl = await window.assistant.setWebsiteUrl(targetUrlInput.trim());
                        setConnectedUrl(newUrl);
                        setShowUrlEditor(false);
                        setNotice(`Connected workspace updated to: ${newUrl}. Click Reconnect if needed.`);
                        void refreshShopContext();
                      } catch (err) {
                        setNotice(err instanceof Error ? err.message : "Failed to update URL");
                      }
                    }}
                  >
                    Save & Switch
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={async () => {
                      try {
                        const newUrl = await window.assistant.setWebsiteUrl("http://127.0.0.1:3000/");
                        setConnectedUrl(newUrl);
                        setTargetUrlInput(newUrl);
                        setShowUrlEditor(false);
                        setNotice("Switched connection to localhost (http://127.0.0.1:3000/).");
                        void refreshShopContext();
                      } catch (err) {
                        setNotice(err instanceof Error ? err.message : "Failed to reset URL");
                      }
                    }}
                  >
                    Localhost (3000)
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Back Button */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <button
                className="back-link"
                style={{ margin: 0 }}
                onClick={() => {
                  setView("home");
                  setNotice("");
                }}
              >
                <span aria-hidden="true">←</span> {t.backHome}
              </button>
              <button
                type="button"
                className="header-home-btn"
                title="Open တူတူတွက်မယ် workspace"
                onClick={() => void window.assistant.openWebsite()}
              >
                <Icon name="home" size={14} /> {t.openWorkspace}
              </button>
            </div>

            {view === "chat" ? (
              <section className="workflow" aria-label="Chat to Order">

                {/* Mode Options: Paste from clipboard vs Write order */}
                <div className="chat-mode-tabs" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      type="button"
                      className={`mode-tab-btn ${chatInputMode === "paste" ? "active" : ""}`}
                      onClick={() => {
                        setChatInputMode("paste");
                        void handlePasteAndGenerate();
                      }}
                    >
                      {t.pasteFromClipboard}
                    </button>
                    <button
                      type="button"
                      className={`mode-tab-btn ${chatInputMode === "write" ? "active" : ""}`}
                      onClick={() => setChatInputMode("write")}
                    >
                      {t.writeOrder}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="template-chip-btn"
                    onClick={applyTemplate}
                    title={language === "my" ? "အော်ဒါပုံစံ အလိုအလျောက် ထည့်သွင်းရန်" : "Insert order quick template"}
                  >
                    {t.useTemplate}
                  </button>
                </div>

                {/* Top Write Box: Quick access to type or add new messages */}
                {chatInputMode === "write" && (
                  <div className="top-write-container">
                    <textarea
                      id="customer-chat"
                      className="chat-input"
                      value={chat}
                      maxLength={20_000}
                      rows={hasOrder ? 3 : 4}
                      onChange={(event) => setChat(event.target.value)}
                      placeholder={hasOrder ? t.writePlaceholderAppend : t.writePlaceholderNew}
                    />
                    <div style={{ marginTop: "6px", display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        className="primary-button"
                        style={{ flex: 1 }}
                        disabled={isExtracting || !chat.trim()}
                        onClick={() => void generateOrderFromText(chat)}
                      >
                        {isExtracting
                          ? t.generating
                          : hasOrder
                          ? t.updateVoucher
                          : t.generateVoucher}
                      </button>
                      {hasOrder && (
                        <button
                          type="button"
                          className="secondary-button"
                          title={language === "my" ? "ရှင်းလင်းပြီး အော်ဒါအသစ် စတင်ရန်" : "Clear and start new voucher"}
                          onClick={resetOrderState}
                        >
                          {t.newOrder}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Default Paste Mode: One-click paste action */}
                {!hasOrder && chatInputMode === "paste" && (
                  <div className="paste-mode-container">
                    <div
                      className="paste-mode-card"
                      onClick={() => void handlePasteAndGenerate()}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          void handlePasteAndGenerate();
                        }
                      }}
                    >
                      <div className="paste-card-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                        </svg>
                      </div>
                      <strong className="paste-card-title">{t.pasteTitle}</strong>
                      <p className="paste-card-desc">
                        {t.pasteDesc}
                      </p>
                      <button
                        type="button"
                        className="primary-button paste-action-btn"
                        disabled={isExtracting}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handlePasteAndGenerate();
                        }}
                      >
                        {isExtracting ? t.analyzing : t.pasteButton}
                      </button>
                      <div style={{ marginTop: "12px", textAlign: "center" }}>
                        <button
                          type="button"
                          className="template-chip-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            applyTemplate();
                          }}
                        >
                          {t.useTemplate}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Direct Voucher View without scrolling review form */}
                {hasOrder && (
                  <>
                    <VoucherCard
                      order={savedOrder || currentVoucherOrder}
                      shopName={savedShopName}
                      sourceText={chat}
                      isEditing={showEditForm}
                      onEdit={() => setShowEditForm(!showEditForm)}
                      onNewOrder={resetOrderState}
                      onSaveToShop={confirmOrder}
                      isSavingToShop={isSaving}
                      isSavedToShop={confirmed}
                    >

                      {/* Collapsible Edit Form directly below taskbar */}
                      {showEditForm && (
                        <div className="voucher-edit-drawer no-print">
                          <div className="voucher-edit-header">
                            <h4>Edit Order Details (အချက်အလက် ပြင်ဆင်ရန်)</h4>
                            <button
                              type="button"
                              className="voucher-edit-done-btn"
                              onClick={() => setShowEditForm(false)}
                            >
                              ✓ Done
                            </button>
                          </div>
                          <div className="field-grid">
                            <label className="form-field">
                              <span className="field-label-row">
                                Customer name <SourceTag source={order.customer_name_source} />
                              </span>
                              <input
                                autoComplete="off"
                                value={order.customer_name}
                                onChange={(event) => editTextField("customer_name", event.target.value)}
                              />
                            </label>
                            <label className="form-field">
                              <span className="field-label-row">
                                Phone <SourceTag source={order.customer_phone_source} />
                              </span>
                              <input
                                autoComplete="off"
                                value={order.customer_phone}
                                onChange={(event) => editTextField("customer_phone", event.target.value)}
                              />
                            </label>
                            <label className="form-field field-wide">
                              <span className="field-label-row">
                                Delivery address <SourceTag source={order.delivery_address_source} />
                              </span>
                              <textarea
                                value={order.delivery_address}
                                onChange={(event) => editTextField("delivery_address", event.target.value)}
                                rows={2}
                              />
                            </label>
                            <label className="form-field field-wide">
                              <span className="field-label-row">
                                Notes <span style={{ fontSize: "11px", color: "var(--text-muted, #64748b)" }}>(Optional)</span>
                              </span>
                              <input
                                value={order.notes}
                                onChange={(event) => editTextField("notes", event.target.value)}
                                placeholder="Delivery instructions or buyer notes"
                              />
                            </label>
                          </div>

                          <div className="items-heading" style={{ marginTop: "6px" }}>
                            <strong>Items (ပစ္စည်းများ)</strong>
                            <button type="button" className="text-button" onClick={addItem}>
                              + Add item
                            </button>
                          </div>
                          <div className="draft-items">
                            {order.items.map((item, index) => (
                              <div className="draft-item" key={item.key}>
                                <div className="draft-item-title">
                                  <span>Item {index + 1}</span>
                                  {order.items.length > 1 && (
                                    <button
                                      type="button"
                                      className="text-button danger-text"
                                      onClick={() => removeItem(index)}
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                                <label className="form-field">
                                  <span className="field-label-row">Product</span>
                                  <input
                                    value={item.product_name}
                                    onChange={(event) => editItem(index, "product_name", event.target.value)}
                                  />
                                </label>
                                <div className="field-grid item-fields">
                                  <label className="form-field">
                                    <span className="field-label-row">Qty</span>
                                    <input
                                      inputMode="numeric"
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(event) => editItem(index, "quantity", event.target.value)}
                                    />
                                  </label>
                                  <label className="form-field">
                                    <span className="field-label-row">Unit Price (MMK)</span>
                                    <input
                                      inputMode="numeric"
                                      type="number"
                                      min="0"
                                      value={item.unit_price_mmk}
                                      onChange={(event) => editItem(index, "unit_price_mmk", event.target.value)}
                                    />
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="field-grid totals-fields" style={{ marginTop: "4px" }}>
                            <label className="form-field">
                              <span className="field-label-row">
                                Delivery fee (MMK) <span style={{ fontSize: "11px", color: "var(--text-muted, #64748b)" }}>(Optional)</span>
                              </span>
                              <input
                                inputMode="numeric"
                                type="number"
                                min="0"
                                value={order.delivery_fee_mmk}
                                onChange={(event) => editTextField("delivery_fee_mmk", event.target.value)}
                                placeholder="0"
                              />
                            </label>
                            <label className="form-field">
                              <span className="field-label-row">
                                Discount (MMK) <span style={{ fontSize: "11px", color: "var(--text-muted, #64748b)" }}>(Optional)</span>
                              </span>
                              <input
                                inputMode="numeric"
                                type="number"
                                min="0"
                                value={order.discount_mmk}
                                onChange={(event) => editTextField("discount_mmk", event.target.value)}
                                placeholder="0"
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </VoucherCard>

                    {/* Customer Reply Section - Chosen according to pasted sentences */}
                    <section className="customer-reply-section">
                      <div className="customer-reply-title">
                        <span>{isBurmese ? "ဝယ်သူထံ အကြောင်းပြန်စာ" : "Customer Reply"}</span>
                      </div>
                      <div className="reply-item-box">
                        <textarea
                          className="reply-textarea"
                          value={isBurmese ? visibleMyReply : visibleEnReply}
                          onChange={(e) => {
                            if (isBurmese) setMyReply(e.target.value);
                            else setEnReply(e.target.value);
                          }}
                          rows={3}
                        />
                        <button
                          type="button"
                          className="copy-reply-btn"
                          onClick={() =>
                            void copyText(
                              isBurmese ? visibleMyReply : visibleEnReply,
                              isBurmese ? "အကြောင်းပြန်စာ ကူးယူပြီးပါပြီ" : "Reply copied to clipboard",
                            )
                          }
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            style={{ marginRight: 5, verticalAlign: -1 }}
                          >
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                          {isBurmese ? "စာသား ကူးယူမည်" : "Copy Reply"}
                        </button>
                      </div>
                    </section>

                    {/* Reset Button */}
                    <div style={{ marginTop: "12px", textAlign: "center" }}>
                      <button
                        type="button"
                        className="secondary-button"
                        style={{ minHeight: "36px", fontSize: "0.75rem" }}
                        onClick={resetOrderState}
                      >
                        {t.newOrder}
                      </button>
                    </div>
                  </>
                )}
              </section>
            ) : (
              <section className="workflow" aria-labelledby="match-heading">
                <div className="workflow-heading">
                  <span className="workflow-icon"><Icon name="wallet" /></span>
                  <div>
                    <h1 id="match-heading">Match Payment to Order</h1>
                  </div>
                </div>
                <div className="security-note">
                  <strong>Review before confirming</strong>
                  <p>Check your payment records. A screenshot alone cannot confirm received funds.</p>
                </div>
                <div className="upload-actions">
                  <label className="primary-button file-button">
                    Choose transaction image
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => readLocalImage(event.currentTarget.files?.[0])}
                    />
                  </label>
                  <button type="button" className="secondary-button" onClick={() => void pasteTransactionImage()}>
                    Paste copied image
                  </button>
                </div>
                <div
                  className="image-paste-zone"
                  tabIndex={0}
                  role="group"
                  aria-label="Paste a transaction screenshot"
                  onPaste={(event) => {
                    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"));
                    if (file) {
                      event.preventDefault();
                      readLocalImage(file);
                    } else {
                      setNotice("Copy a transaction screenshot and paste it here, or use Paste copied image.");
                    }
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    readLocalImage(event.dataTransfer.files?.[0]);
                  }}
                >
                  Click here and press Ctrl+V, or drop a transaction screenshot
                </div>
                {screenshot && (
                  <>
                    <figure className="image-preview">
                      <img src={screenshot} alt="Selected transaction image" />
                      <figcaption>
                        <span>Transaction image</span>
                        <span>{screenshotName}</span>
                      </figcaption>
                    </figure>
                    <PaymentReview key={screenshotRevision} image={screenshot} onNotice={setNotice} />
                  </>
                )}
              </section>
            )}
          </>
        )}
        {notice && <p className="status-message" role="status">{notice}</p>}
        <footer className="panel-footer">
          <span className="footer-pulse" aria-hidden="true" /> တူတူတွက်မယ်
        </footer>
      </div>
    </main>
  );
}

export default function AssistantApp() {
  if (window.location.search.includes("view=launcher")) return <Launcher />;
  return <AssistantPanel />;
}
