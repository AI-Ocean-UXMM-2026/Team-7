"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@ocean/ui";
import type { OrderDetails } from "@ocean/contracts";
import { saveOrder } from "@/app/sales/actions";
import { ScreenshotToOrderWorkflow } from "@/app/assistant/screenshot-workflow";
import { VoucherCard, type VoucherOrder } from "./voucher-card";
import { useShellLanguage } from "./shell-language";
import {
  buildCustomerReplies,
  draftTotals,
  emptyEditableOrder,
  extractChatOrder,
  validateEditableOrder,
  type EditableChatOrder,
  type FieldSource,
} from "@/lib/assistant-chat";
import dolphinAccountant from "../../../../assets/dolphin/dolphin-accountant.png";
import dolphinLauncher from "../../../../assets/dolphin/dolphin-launcher.png";

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
    dashboard: "Dashboard ↗",
    sales: "Sales ↗",
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
    editOrder: "Edit Order Details (အချက်အလက် ပြင်ဆင်ရန်)",
    done: "✓ Done",
    customerName: "Customer name",
    phone: "Phone",
    deliveryAddress: "Delivery address",
    notes: "Notes",
    optional: "(Optional)",
    products: "Products",
    addProduct: "+ Add product",
    deliveryFee: "Delivery fee (MMK)",
    discount: "Discount (MMK)",
    missingDetails: "Missing details? Add message:",
    pasteNew: "📋 Paste new",
    write: "✏️ Write",
    customerReply: "Customer Reply",
    copyReply: "📋 Copy Reply",
    newOrder: "+ New Order",
    orderSavedSuccess: "✓ Order saved to shop! It now appears on your Sales page.",
    viewInSales: "View in Sales Management ↗",
    goToDashboard: "Go to Dashboard ↗",
    startNextOrder: "+ Start Next Order",
  },
  my: {
    title: "တူတူတွက်မယ်",
    subtitle: "အရောင်းအထောက်အကူ",
    chatToOrder: "ချက်တင်မှ ဘောက်ချာထုတ်ရန်",
    chatToOrderDesc: "ဖောက်သည်စကားပြောချက်များမှ ချက်ချင်းဘောက်ချာထုတ်ယူပါ",
    matchPayment: "ငွေလွှဲစလစ်နှင့် အော်ဒါတိုက်ဆိုင်စစ်ဆေးရန်",
    matchPaymentDesc: "ငွေလွှဲပြေစာကို အတည်ပြုပြီး အော်ဒါနှင့် တွဲဆက်ပါ",
    backHome: "မူလစာမျက်နှာသို့",
    dashboard: "ဒက်ရှ်ဘုတ် ↗",
    sales: "အရောင်း ↗",
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
    editOrder: "အချက်အလက် ပြင်ဆင်ရန်",
    done: "✓ ပြီးပါပြီ",
    customerName: "ဖောက်သည်အမည်",
    phone: "ဖုန်းနံပါတ်",
    deliveryAddress: "ပို့ဆောင်ရမည့်လိပ်စာ",
    notes: "မှတ်ချက်",
    optional: "(မဖြစ်မနေ မဟုတ်ပါ)",
    products: "ပစ္စည်းများ",
    addProduct: "+ ပစ္စည်းအသစ်ထည့်ရန်",
    deliveryFee: "ပို့ဆောင်ခ (ကျပ်)",
    discount: "လျှော့ဈေး (ကျပ်)",
    missingDetails: "အချက်အလက်လိုသေးလား? မက်ဆေ့ခ်ျထပ်ဖြည့်ရန်:",
    pasteNew: "📋 အသစ်ကူးထည့်မည်",
    write: "✏️ စာရိုက်မည်",
    customerReply: "ဖောက်သည်ထံ အကြောင်းပြန်စာ",
    copyReply: "📋 ကူးယူမည်",
    newOrder: "+ အော်ဒါအသစ်",
    orderSavedSuccess: "✓ အော်ဒါကို သိမ်းဆည်းပြီးပါပြီ! အရောင်းစာရင်းတွင် ကြည့်ရှုနိုင်ပါသည်။",
    viewInSales: "အရောင်းစာရင်းတွင် ကြည့်ရန် ↗",
    goToDashboard: "ဒက်ရှ်ဘုတ်သို့ ↗",
    startNextOrder: "+ နောက်အော်ဒါအသစ် စတင်ရန်",
  },
};

function SourceTag({ source }: { source: FieldSource }) {
  const label = source === "extracted" ? "AI" : source === "manual" ? "Edited" : "Required";
  return <span className={`field-source field-source-${source}`}>{label}</span>;
}

export function SayaAssistant({
  shopId = "10000000-0000-4000-8000-000000000001",
  onOrderSaved,
}: {
  shopId?: string;
  onOrderSaved?: (order: OrderDetails) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>("home");
  const [resumeEvidenceId, setResumeEvidenceId] = useState<string | null>(null);
  const [targetOrderId, setTargetOrderId] = useState<string | null>(null);

  const { language, setLanguage } = useShellLanguage();
  const t = ASSISTANT_STRINGS[language] || ASSISTANT_STRINGS.en;

  // Core Chat to Order state matching desktop assistant
  const [chat, setChat] = useState("");
  const [order, setOrder] = useState<EditableChatOrder>(() => emptyEditableOrder());
  const [hasOrder, setHasOrder] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const orderIdRef = useRef<string | null>(null);
  const [notice, setNotice] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [chatInputMode, setChatInputMode] = useState<"paste" | "write">("paste");
  const [showEditForm, setShowEditForm] = useState(false);
  const [showAppendWrite, setShowAppendWrite] = useState(false);
  const [appendInput, setAppendInput] = useState("");
  const [savedOrder, setSavedOrder] = useState<VoucherOrder | null>(null);
  const [activeShopId, setActiveShopId] = useState<string>(shopId);
  const [shopName, setShopName] = useState("တူတူတွက်မယ် Store");

  // Keep active shop in sync via payment-context
  useEffect(() => {
    let active = true;
    const target = shopId || activeShopId;
    const q = target ? `?shop_id=${encodeURIComponent(target)}` : "";
    fetch(`/api/assistant/payment-context${q}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) {
          if (data.shop_id) setActiveShopId(data.shop_id);
          if (data.shop_name) setShopName(data.shop_name);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [shopId]);

  const resetOrderState = useCallback(() => {
    setChat("");
    setHasOrder(false);
    setConfirmed(false);
    setSavedOrder(null);
    setOrderId(null);
    orderIdRef.current = null;
    setOrder(emptyEditableOrder());
    setShowEditForm(false);
    setShowAppendWrite(false);
    setAppendInput("");
    setNotice("");
    setTargetOrderId(null);
  }, []);

  // Listen for open events triggered by topbar / banner buttons
  useEffect(() => {
    const handleOpen = (e: Event) => {
      setIsOpen(true);
      const detail = (e as CustomEvent<{ view?: View; evidenceId?: string; reset?: boolean; orderId?: string; shopId?: string }>).detail;
      if (detail?.reset) {
        resetOrderState();
      }
      if (detail?.view) setView(detail.view);
      setResumeEvidenceId(detail?.evidenceId ?? null);
      if (detail?.orderId) setTargetOrderId(detail.orderId);
      if (detail?.shopId) setActiveShopId(detail.shopId);
    };
    window.addEventListener("open-saya-assistant", handleOpen);
    return () => window.removeEventListener("open-saya-assistant", handleOpen);
  }, [resetOrderState]);

  function editTextField(
    field: "customer_name" | "customer_phone" | "delivery_address" | "notes" | "delivery_fee_mmk" | "discount_mmk",
    value: string,
  ) {
    const sourceField = `${field}_source` as keyof EditableChatOrder;
    setSavedOrder(null);
    setConfirmed(false);
    setOrder((current) => ({
      ...current,
      [field]: value,
      [sourceField]: "manual" as const,
    }));
  }

  function editItem(
    index: number,
    field: "product_name" | "quantity" | "unit_price_mmk",
    value: string,
  ) {
    const sourceField = `${field}_source` as const;
    setSavedOrder(null);
    setConfirmed(false);
    setOrder((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
              [sourceField]: "manual" as const,
            }
          : item,
      ),
    }));
  }

  function updateQuantity(index: number, delta: number) {
    setOrder((current) => {
      const items = [...current.items];
      const item = items[index];
      if (!item) return current;
      const currentQty = Math.max(1, Number(item.quantity) || 1);
      const newQty = Math.max(1, currentQty + delta);
      items[index] = {
        ...item,
        quantity: String(newQty),
        quantity_source: "manual",
      };
      return { ...current, items };
    });
    setSavedOrder(null);
    setConfirmed(false);
  }

  function addItem() {
    setOrder((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          key: crypto.randomUUID(),
          product_name: "",
          product_name_source: "manual",
          quantity: "1",
          quantity_source: "manual",
          unit_price_mmk: "0",
          unit_price_mmk_source: "missing",
        },
      ],
    }));
    setSavedOrder(null);
    setConfirmed(false);
  }

  function removeItem(index: number) {
    setOrder((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
    setSavedOrder(null);
    setConfirmed(false);
  }

  const burmeseTemplate = "အမည်- \nလိပ်စာ- \nဖုန်းနံပါတ်- \nပစ္စည်း- \nအရေအတွက်- ";
  const englishTemplate = "Name- \nAddress- \nPhone number- \nItem- \nQuantity- ";

  function applyTemplate() {
    const tpl = language === "my" ? burmeseTemplate : englishTemplate;
    setChat(tpl);
    setChatInputMode("write");
    setNotice(t.templateNotice);
  }

  const generateOrderFromText = useCallback(
    async (rawText: string) => {
      const textToAnalyze = rawText.trim();
      if (!textToAnalyze) {
        setNotice(language === "my" ? "ဖောက်သည်အော်ဒါ အချက်အလက်များ အရင်ရိုက်ထည့်ပါ သို့မဟုတ် ကူးထည့်ပါ" : "Please paste or write customer order details first.");
        return;
      }

      setIsExtracting(true);
      setHasOrder(false);
      setConfirmed(false);
      setSavedOrder(null);
      setNotice(language === "my" ? "အော်ဒါအချက်အလက် စစ်ဆေးပြီး ဘောက်ချာထုတ်နေပါသည်…" : "Analyzing order details and generating voucher…");

      const nextOrderId = crypto.randomUUID();
      orderIdRef.current = nextOrderId;
      setOrderId(nextOrderId);

      try {
        const targetShop = activeShopId || shopId;
        const result = await extractChatOrder(textToAnalyze, targetShop);
        setOrder(result.order);
        setHasOrder(true);
        setShowEditForm(false);
        setNotice(result.notice || (language === "my" ? "✓ ဘောက်ချာ ထုတ်ပြီးပါပြီ! အချက်အလက်စစ်ဆေးပြီး သိမ်းဆည်းနိုင်ပါသည်" : "✓ Voucher generated! Review or save as PNG."));
      } catch {
        setNotice(language === "my" ? "အချက်အလက် မဖတ်နိုင်ပါ။ ပြန်လည်စစ်ဆေးပြီး ထပ်ကြိုးစားပါ" : "Could not organize conversation. Check details and try again.");
      } finally {
        setIsExtracting(false);
      }
    },
    [activeShopId, shopId, language],
  );

  async function handlePasteAndGenerate() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText && clipboardText.trim()) {
          if (hasOrder) {
            await appendMessageAndReExtract(clipboardText);
          } else {
            setChat(clipboardText);
            setChatInputMode("paste");
            await generateOrderFromText(clipboardText);
          }
          return;
        }
      }
    } catch {
      // Browser clipboard permission denied or not supported
    }

    // Fallback: switch to write box so user can paste with Ctrl+V
    setChatInputMode("write");
    setNotice(language === "my" ? "ဖောက်သည်ပြောကြားချက်ကို အောက်တွင် ရိုက်ထည့်ပြီး ဘောက်ချာထုတ်ရန် နှိပ်ပါ" : "Paste your customer chat below, then click Generate Voucher.");
  }

  async function appendMessageAndReExtract(newText: string) {
    const trimmed = newText.trim();
    if (!trimmed) return;
    const combined = chat.trim() ? `${chat.trim()}\n${trimmed}` : trimmed;
    setChat(combined);
    setIsExtracting(true);
    setNotice(language === "my" ? "မက်ဆေ့ခ်ျအသစ် ထပ်ဖြည့်ပြီး ဘောက်ချာပြင်ဆင်နေပါသည်…" : "Adding new message and updating voucher…");
    try {
      const targetShop = activeShopId || shopId;
      const result = await extractChatOrder(combined, targetShop);
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
          delivery_fee_mmk:
            extracted.delivery_fee_mmk && extracted.delivery_fee_mmk !== "0"
              ? extracted.delivery_fee_mmk
              : prev.delivery_fee_mmk,
          delivery_fee_mmk_source:
            extracted.delivery_fee_mmk && extracted.delivery_fee_mmk !== "0"
              ? extracted.delivery_fee_mmk_source
              : prev.delivery_fee_mmk_source,
          discount_mmk:
            extracted.discount_mmk && extracted.discount_mmk !== "0" ? extracted.discount_mmk : prev.discount_mmk,
          discount_mmk_source:
            extracted.discount_mmk && extracted.discount_mmk !== "0" ? extracted.discount_mmk_source : prev.discount_mmk_source,
          items:
            extracted.items.length > 0 && extracted.items.some((i) => i.product_name)
              ? extracted.items
              : prev.items,
        };
      });
      setSavedOrder(null);
      setConfirmed(false);
      setHasOrder(true);
      setNotice(language === "my" ? "✓ မက်ဆေ့ခ်ျအသစ် ထည့်သွင်းပြီးပါပြီ! ဘောက်ချာကို အပ်ဒိတ်လုပ်ပြီးပါပြီ" : "✓ New message added! Voucher updated.");
    } catch {
      setNotice(language === "my" ? "မက်ဆေ့ခ်ျအသစ် မဖတ်နိုင်ပါ။ တိုက်ရိုက်ပြင်ဆင်နိုင်ပါသည်" : "Could not parse new message. You can also edit details directly.");
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleAppendFromClipboard() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText && clipboardText.trim()) {
          await appendMessageAndReExtract(clipboardText);
          return;
        }
      }
    } catch {}
    setShowAppendWrite(true);
    setNotice(language === "my" ? "ဖြည့်စွက်အချက်အလက်ကို အောက်ပါကွက်လပ်တွင် ရိုက်ထည့်ပါ" : "Type or paste the additional details in the box below.");
  }

  async function confirmOrder() {
    if (confirmed) {
      setNotice(language === "my" ? "ဤအော်ဒါကို ဆိုင်စာရင်းထဲတွင် သိမ်းဆည်းပြီးသား ဖြစ်ပါသည်" : "This order is already saved to your shop.");
      return;
    }
    const errors = validateEditableOrder(order);
    if (errors.length > 0) {
      setConfirmed(false);
      setShowEditForm(true);
      setNotice(language === "my" ? "မဖြစ်မနေ လိုအပ်သောအချက်အလက်များကို ဖြည့်စွက်ပါ" : "Please complete required order fields before saving.");
      return;
    }

    const stableOrderId = orderIdRef.current || crypto.randomUUID();
    orderIdRef.current = stableOrderId;
    setOrderId(stableOrderId);
    setIsSaving(true);
    setNotice(language === "my" ? "အော်ဒါကို ဆိုင်စာရင်းထဲသို့ သိမ်းဆည်းနေပါသည်…" : "Saving order to shop workspace…");

    try {
      let targetShopId = activeShopId || shopId;
      if (!targetShopId || targetShopId === "00000000-0000-4000-8000-000000000001") {
        try {
          const ctxRes = await fetch("/api/assistant/payment-context");
          if (ctxRes.ok) {
            const ctx = await ctxRes.json();
            if (ctx.shop_id) {
              targetShopId = ctx.shop_id;
              setActiveShopId(ctx.shop_id);
              if (ctx.shop_name) setShopName(ctx.shop_name);
            }
          }
        } catch {}
      }

      const payload = {
        shop_id: targetShopId,
        id: stableOrderId,
        expected_updated_at: null,
        customer_name: order.customer_name.trim(),
        customer_phone: order.customer_phone.trim() || null,
        delivery_address: order.delivery_address.trim() || null,
        notes: order.notes.trim() || null,
        order_status: "confirmed" as const,
        fulfillment_status: "unfulfilled" as const,
        delivery_fee_mmk: Number(order.delivery_fee_mmk) || 0,
        discount_mmk: Number(order.discount_mmk) || 0,
        items: order.items.map((it) => ({
          product_name: it.product_name.trim(),
          quantity: Number(it.quantity) || 1,
          unit_price_mmk: Number(it.unit_price_mmk) || 0,
        })),
      };

      const result = await saveOrder(payload);
      if (result.error) {
        setNotice(result.error);
      } else if (result.order) {
        setSavedOrder(result.order as unknown as VoucherOrder);
        setConfirmed(true);
        setNotice(
          language === "my"
            ? `✓ အော်ဒါကို ${shopName} တွင် သိမ်းဆည်းပြီးပါပြီ! အရောင်းစာရင်းတွင် ကြည့်ရှုနိုင်ပါသည်။`
            : `✓ Order saved to ${shopName}! It now appears on your Sales page.`
        );
        if (onOrderSaved) onOrderSaved(result.order);
        window.dispatchEvent(new CustomEvent("refresh-orders"));
        try {
          window.localStorage.setItem("salesayar_orders_updated", Date.now().toString());
        } catch {}
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to save order.");
    } finally {
      setIsSaving(false);
    }
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

  const isBurmese = /[\u1000-\u109F]/u.test(
    `${chat} ${order.customer_name} ${order.delivery_address} ${order.items.map((it) => it.product_name).join(" ")}`,
  );
  const singleLanguageReply = isBurmese ? customerReplies.my : customerReplies.en;

  const currentVoucherOrder: VoucherOrder = useMemo(
    () => ({
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
    }),
    [orderId, confirmed, totals, order],
  );

  return (
    <>
      {/* Floating launcher when minimized */}
      {!isOpen && (
        <button
          type="button"
          className="saya-floating-launcher"
          onClick={() => setIsOpen(true)}
          aria-label="Open တူတူတွက်မယ် Assistant"
          title="Open တူတူတွက်မယ် Assistant"
        >
          <Image
            src={dolphinLauncher}
            alt=""
            width={78}
            height={78}
            priority
          />
        </button>
      )}

      {/* Docked Assistant Panel identical to Electron desktop assistant */}
      {isOpen && (
        <aside className="saya-docked-panel assistant-shell" aria-label="တူတူတွက်မယ် Assistant">
          {/* Header with Mini Home Icon leading directly to Dashboard */}
          <header className="panel-header">
            <div className="header-drag" aria-hidden="true">
              <span className="panel-mark">
                <Image src={dolphinAccountant} alt="" width={34} height={34} priority />
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
              <Link
                href={activeShopId ? `/?shop=${encodeURIComponent(activeShopId)}` : "/"}
                className="header-home-btn"
                title={t.dashboard}
                aria-label={t.dashboard}
              >
                <Icon name="home" size={15} />
              </Link>
              <button
                type="button"
                className="window-action"
                aria-label="Minimize"
                title="Minimize"
                onClick={() => setIsOpen(false)}
              >
                −
              </button>
              <button
                type="button"
                className="window-action close-action"
                aria-label="Close"
                title="Close"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>
          </header>

          {/* Scrollable Body with Smooth View Transitions */}
          <div className="panel-scroll view-enter-anim" key={view}>
            {view === "home" ? (
              <>
                {/* Mobbin-inspired Clean Hero */}
                <section className="home-hero">
                  <div className="dolphin-avatar">
                    <span className="welcome-ripple" />
                    <Image src={dolphinAccountant} alt="တူတူတွက်မယ်" width={86} height={86} priority />
                  </div>
                  <h1 className="home-title">{t.title}</h1>
                  <p className="home-subtitle">{t.subtitle}</p>
                </section>

                {/* Two Clean Action Cards */}
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
                      setResumeEvidenceId(null);
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

                {/* Web Active Shop Bar (Clean, no external reconnect hoops) */}
                <div className="web-active-shop-bar">
                  <div className="web-active-shop-info">
                    <span className="dot" />
                    <span>
                      Active Shop: <strong>{shopName}</strong>
                    </span>
                  </div>
                  <div className="web-active-shop-links">
                    <Link
                      href={activeShopId ? `/?shop=${encodeURIComponent(activeShopId)}` : "/"}
                      className="web-lead-btn"
                      title={t.dashboard}
                    >
                      {t.dashboard}
                    </Link>
                    <Link
                      href={activeShopId ? `/sales?shop=${encodeURIComponent(activeShopId)}` : "/sales"}
                      className="web-lead-btn"
                      title={t.sales}
                    >
                      {t.sales}
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* View Top Bar with Back and Direct Dashboard Links */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <button
                    type="button"
                    className="back-link"
                    style={{ margin: 0, background: "none", border: "none", cursor: "pointer" }}
                    onClick={() => {
                      setView("home");
                      setNotice("");
                    }}
                  >
                    <span aria-hidden="true">←</span> {t.backHome}
                  </button>
                  <Link
                    href={activeShopId ? `/?shop=${encodeURIComponent(activeShopId)}` : "/"}
                    className="header-home-btn"
                    title={t.dashboard}
                    style={{ textDecoration: "none" }}
                  >
                    <Icon name="home" size={14} /> {t.dashboard}
                  </Link>
                </div>

                {view === "chat" ? (
                  <section className="workflow" aria-label="Chat to Order">
                    {/* Mode Tabs: Paste from clipboard vs Write order + Quick Template */}
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

                    {/* Top Write Box: Direct input to compose or update */}
                    {chatInputMode === "write" && (
                      <div className="top-write-container">
                        <textarea
                          id="web-customer-chat"
                          className="chat-input"
                          value={chat}
                          maxLength={20_000}
                          rows={hasOrder ? 3 : 4}
                          onChange={(e) => setChat(e.target.value)}
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

                    {/* Default Paste Mode Card */}
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

                    {/* Direct Voucher View without scrolling review forms */}
                    {hasOrder && (
                      <>
                        <VoucherCard
                          order={savedOrder || currentVoucherOrder}
                          shopName={shopName}
                          sourceText={chat}
                          isEditing={showEditForm}
                          onEdit={() => setShowEditForm(!showEditForm)}
                          onNewOrder={resetOrderState}
                          onSaveToShop={confirmOrder}
                          isSavingToShop={isSaving}
                          isSavedToShop={confirmed}
                        >
                          {/* Collapsible Edit Form directly below toolbar */}
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
                                    onChange={(e) => editTextField("customer_name", e.target.value)}
                                  />
                                </label>
                                <label className="form-field">
                                  <span className="field-label-row">
                                    Phone <SourceTag source={order.customer_phone_source} />
                                  </span>
                                  <input
                                    autoComplete="off"
                                    value={order.customer_phone}
                                    onChange={(e) => editTextField("customer_phone", e.target.value)}
                                  />
                                </label>
                                <label className="form-field field-wide">
                                  <span className="field-label-row">
                                    Delivery address <SourceTag source={order.delivery_address_source} />
                                  </span>
                                  <textarea
                                    value={order.delivery_address}
                                    onChange={(e) => editTextField("delivery_address", e.target.value)}
                                    rows={2}
                                  />
                                </label>
                                <label className="form-field field-wide">
                                  <span className="field-label-row">
                                    Notes <span style={{ fontSize: "11px", color: "var(--text-muted, #64748b)" }}>(Optional)</span>
                                  </span>
                                  <input
                                    value={order.notes}
                                    onChange={(e) => editTextField("notes", e.target.value)}
                                    placeholder="Delivery instructions or buyer notes"
                                  />
                                </label>
                              </div>

                              <div className="items-heading" style={{ marginTop: "4px" }}>
                                <strong>Products ({order.items.length})</strong>
                                <button type="button" className="text-button" onClick={addItem}>
                                  + Add product
                                </button>
                              </div>
                              <div className="items-list">
                                {order.items.map((item, index) => (
                                  <div className="item-row" key={item.key}>
                                    <div className="item-main">
                                      <input
                                        className="item-name-input"
                                        placeholder="Product name"
                                        value={item.product_name}
                                        onChange={(e) => editItem(index, "product_name", e.target.value)}
                                      />
                                      {order.items.length > 1 && (
                                        <button
                                          type="button"
                                          className="item-delete-btn"
                                          title="Remove item"
                                          onClick={() => removeItem(index)}
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                    <div className="item-metrics">
                                      <div className="qty-control">
                                        <button
                                          type="button"
                                          aria-label="Decrease quantity"
                                          onClick={() => updateQuantity(index, -1)}
                                        >
                                          −
                                        </button>
                                        <input
                                          type="number"
                                          min="1"
                                          className="qty-input"
                                          value={item.quantity}
                                          onChange={(e) => editItem(index, "quantity", e.target.value)}
                                        />
                                        <button
                                          type="button"
                                          aria-label="Increase quantity"
                                          onClick={() => updateQuantity(index, 1)}
                                        >
                                          +
                                        </button>
                                      </div>
                                      <div className="price-input-wrapper">
                                        <input
                                          type="number"
                                          min="0"
                                          step="1"
                                          className="price-input"
                                          placeholder="Price"
                                          value={item.unit_price_mmk}
                                          onChange={(e) => editItem(index, "unit_price_mmk", e.target.value)}
                                        />
                                        <span className="price-unit">MMK</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="field-grid" style={{ marginTop: "6px" }}>
                                <label className="form-field">
                                  <span className="field-label-row">
                                    Delivery fee (MMK) <span style={{ fontSize: "11px", color: "var(--text-muted, #64748b)" }}>(Optional)</span>
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={order.delivery_fee_mmk}
                                    onChange={(e) => editTextField("delivery_fee_mmk", e.target.value)}
                                  />
                                </label>
                                <label className="form-field">
                                  <span className="field-label-row">
                                    Discount (MMK) <span style={{ fontSize: "11px", color: "var(--text-muted, #64748b)" }}>(Optional)</span>
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={order.discount_mmk}
                                    onChange={(e) => editTextField("discount_mmk", e.target.value)}
                                  />
                                </label>
                              </div>
                            </div>
                          )}

                          {/* Quick Append Message Bar */}
                          <div className="voucher-append-bar no-print">
                            <div className="voucher-append-actions">
                              <span style={{ fontSize: "0.72rem", color: "#1e3a8a", fontWeight: 650 }}>
                                Missing details? Add message:
                              </span>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button
                                  type="button"
                                  className="append-paste-btn"
                                  onClick={() => void handleAppendFromClipboard()}
                                  title="Paste new message from customer"
                                >
                                  📋 Paste new
                                </button>
                                <button
                                  type="button"
                                  className="append-write-toggle-btn"
                                  onClick={() => setShowAppendWrite(!showAppendWrite)}
                                >
                                  ✏️ Write
                                </button>
                              </div>
                            </div>
                            {showAppendWrite && (
                              <div className="append-input-box">
                                <textarea
                                  className="append-textarea"
                                  rows={2}
                                  value={appendInput}
                                  onChange={(e) => setAppendInput(e.target.value)}
                                  placeholder="Type customer reply or missing info (e.g. Daw Mya, 09444333222, Hledan)…"
                                />
                                <button
                                  type="button"
                                  className="primary-button append-submit-btn"
                                  disabled={isExtracting || !appendInput.trim()}
                                  onClick={async () => {
                                    await appendMessageAndReExtract(appendInput);
                                    setAppendInput("");
                                    setShowAppendWrite(false);
                                  }}
                                >
                                  Update Voucher
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Single Language Customer Reply Box */}
                          <div className="customer-reply-section no-print">
                            <div className="customer-reply-title">
                              <span>Customer Reply ({isBurmese ? "မြန်မာစာဖြင့် အကြောင်းပြန်ရန်" : "English Reply"})</span>
                              <button
                                type="button"
                                className="copy-reply-btn"
                                onClick={() => {
                                  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                                    navigator.clipboard.writeText(singleLanguageReply);
                                    setNotice("✓ Customer reply copied to clipboard!");
                                  }
                                }}
                              >
                                📋 Copy Reply
                              </button>
                            </div>
                            <div className="reply-item-box">
                              <textarea
                                className="reply-textarea"
                                rows={3}
                                readOnly
                                value={singleLanguageReply}
                              />
                            </div>
                          </div>
                        </VoucherCard>

                        {/* Order Saved Success Bar with direct link leading to Dashboard, Sales, and starting Next Order */}
                        {confirmed && (
                          <div className="web-saved-success-bar no-print">
                            <strong>
                              {language === "my"
                                ? `✓ အော်ဒါကို ${shopName} တွင် သိမ်းဆည်းပြီးပါပြီ! အရောင်းစာရင်းတွင် ကြည့်ရှုနိုင်ပါသည်။`
                                : `✓ Order saved to ${shopName}! It now appears on your Sales page.`}
                            </strong>
                            <div className="web-saved-actions">
                              <Link
                                href={`/sales?shop=${encodeURIComponent(activeShopId || shopId)}&order=${savedOrder?.id || orderId}`}
                                className="web-lead-btn primary"
                              >
                                {t.viewInSales}
                              </Link>
                              <Link
                                href={`/?shop=${encodeURIComponent(activeShopId || shopId)}`}
                                className="web-lead-btn"
                              >
                                {t.goToDashboard}
                              </Link>
                              <button
                                type="button"
                                className="web-lead-btn"
                                style={{ background: "#2563eb", color: "#ffffff", border: "none", fontWeight: 650, cursor: "pointer" }}
                                onClick={resetOrderState}
                              >
                                {t.startNextOrder}
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                ) : (
                  /* SCREENSHOT TO ORDER MATCH VIEW */
                  <section className="workflow" aria-label="Match Payment to Order">
                    <ScreenshotToOrderWorkflow
                      key={`${activeShopId}-${resumeEvidenceId ?? targetOrderId ?? "web-match"}`}
                      shopId={activeShopId}
                      resumeEvidenceId={resumeEvidenceId}
                      initialOrderId={targetOrderId}
                    />
                  </section>

                )}
              </>
            )}
          </div>

          {/* Bottom Notice Notification */}
          {notice && (
            <div className="assistant-notice-bar" role="status">
              <span>{notice}</span>
              <button type="button" className="notice-dismiss" onClick={() => setNotice("")}>
                ×
              </button>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
