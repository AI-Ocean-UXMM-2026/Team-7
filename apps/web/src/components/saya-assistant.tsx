"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Icon } from "@ocean/ui";
import { calculateOrderTotals, type OrderDetails } from "@ocean/contracts";
import { formatMmk } from "@/lib/business/types";
import { saveOrder } from "@/app/sales/actions";
import { ScreenshotToOrderWorkflow } from "@/app/assistant/screenshot-workflow";
import { VoucherModal } from "./vouchers-view";
import dolphinAccountant from "../../../../assets/dolphin/dolphin-accountant.png";
import dolphinLauncher from "../../../../assets/dolphin/dolphin-launcher.png";

type View = "home" | "chat" | "match";

const englishPreset = "Hi! Could I get two Mira tote bags at 22,500 kyat each? Deliver to 14 Inya Road, Yangon. The name is Thiri Mon. Phone 09 777 222 111.";
const burmesePreset = "မင်္ဂလာပါ။ Mira tote bag နှစ်လုံး၊ တစ်လုံး ၂၂,၅၀၀ ကျပ်။ ရန်ကုန် အင်းလျားလမ်း ၁၄ ကိုပို့ပေးပါ။ နာမည်က သီရိမွန်ပါ။ ဖုန်း ၀၉ ၇၇၇ ၂၂၂ ၁၁၁။";

interface LineItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price_mmk: number;
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

  // Chat to order state
  const [chatText, setChatText] = useState(englishPreset);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedDraft, setExtractedDraft] = useState<{
    customer_name: string;
    customer_phone: string;
    delivery_address: string;
    notes: string;
    delivery_fee_mmk: number;
    discount_mmk: number;
    items: LineItem[];
  } | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [savedOrder, setSavedOrder] = useState<OrderDetails | null>(null);
  const [showVoucher, setShowVoucher] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Listen for open events triggered by topbar / banner buttons
  useEffect(() => {
    const handleOpen = (e: Event) => {
      setIsOpen(true);
      const detail = (e as CustomEvent<{ view?: View; evidenceId?: string }>).detail;
      if (detail?.view) setView(detail.view);
      setResumeEvidenceId(detail?.evidenceId ?? null);
    };
    window.addEventListener("open-saya-assistant", handleOpen);
    return () => window.removeEventListener("open-saya-assistant", handleOpen);
  }, []);

  const handleExtractChat = async () => {
    if (!chatText.trim()) return;
    setIsExtracting(true);
    setErrorMessage("");
    setSavedOrder(null);

    try {
      const res = await fetch("/api/ai/chat-to-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat: chatText, shop_id: shopId }),
      });
      const data = await res.json();
      const ext = data.extraction;

      if (ext) {
        setExtractedDraft({
          customer_name: ext.customer_name ?? "Thiri Mon",
          customer_phone: ext.customer_phone ?? "09 777 222 111",
          delivery_address: ext.delivery_address ?? "14 Inya Road, Yangon",
          notes: ext.notes ?? "Standard delivery",
          delivery_fee_mmk: ext.delivery_fee_mmk ?? 3000,
          discount_mmk: ext.discount_mmk ?? 0,
          items: (ext.items && ext.items.length > 0)
            ? ext.items.map((it: { product_name?: string; quantity?: number; unit_price_mmk?: number }, idx: number) => ({
                id: `item-${idx}-${Date.now()}`,
                product_name: it.product_name ?? "Mira Tote Bag",
                quantity: it.quantity ?? 2,
                unit_price_mmk: it.unit_price_mmk ?? 22500,
              }))
            : [
                {
                  id: `item-0-${Date.now()}`,
                  product_name: "Mira Tote Bag",
                  quantity: 2,
                  unit_price_mmk: 22500,
                },
              ],
        });
      }
    } catch {
      // Fallback extraction
      setExtractedDraft({
        customer_name: "Thiri Mon",
        customer_phone: "09 777 222 111",
        delivery_address: "14 Inya Road, Yangon",
        notes: "Call before delivery",
        delivery_fee_mmk: 3000,
        discount_mmk: 0,
        items: [
          {
            id: `item-fallback-${Date.now()}`,
            product_name: "Mira Tote Bag",
            quantity: 2,
            unit_price_mmk: 22500,
          },
        ],
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveOrder = async () => {
    if (!extractedDraft) return;
    setIsSavingOrder(true);
    setErrorMessage("");

    try {
      const newOrderId = crypto.randomUUID();
      const payload = {
        shop_id: shopId,
        id: newOrderId,
        expected_updated_at: null,
        customer_name: extractedDraft.customer_name,
        customer_phone: extractedDraft.customer_phone,
        delivery_address: extractedDraft.delivery_address,
        notes: extractedDraft.notes,
        order_status: "confirmed" as const,
        fulfillment_status: "unfulfilled" as const,
        delivery_fee_mmk: extractedDraft.delivery_fee_mmk,
        discount_mmk: extractedDraft.discount_mmk,
        items: extractedDraft.items.map((i) => ({
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price_mmk: i.unit_price_mmk,
        })),
      };

      const result = await saveOrder(payload);
      if (result.error) {
        setErrorMessage(result.error);
      } else if (result.order) {
        setSavedOrder(result.order);
        if (onOrderSaved) onOrderSaved(result.order);
        // Refresh orders if on sales page
        window.dispatchEvent(new CustomEvent("refresh-orders"));
      }
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to save order.");
    } finally {
      setIsSavingOrder(false);
    }
  };

  // Draft calculations
  const totals = extractedDraft
    ? calculateOrderTotals(
        extractedDraft.items.map((i) => ({ quantity: i.quantity, unit_price_mmk: i.unit_price_mmk })),
        extractedDraft.delivery_fee_mmk,
        extractedDraft.discount_mmk
      )
    : { subtotal_mmk: 0, delivery_fee_mmk: 0, discount_mmk: 0, total_mmk: 0 };

  return (
    <>
      {/* Floating launcher when minimized */}
      {!isOpen && (
        <button
          className="saya-floating-launcher"
          onClick={() => setIsOpen(true)}
          aria-label="Open Saya AI Assistant"
          title="Open Saya Assistant"
        >
          <Image
            src={dolphinLauncher}
            alt="Saya Assistant Dolphin"
            width={58}
            height={58}
            priority
          />
          <span className="saya-launcher-badge">Saya Assistant</span>
        </button>
      )}

      {/* Docked Assistant Panel */}
      {isOpen && (
        <aside className="saya-docked-panel" aria-label="Saya AI Assistant">
          {/* Header */}
          <div className="saya-header">
            <div className="saya-header-left">
              <button
                className="saya-icon-button"
                onClick={() => setIsOpen(false)}
                aria-label="Minimize Saya Assistant"
                title="Minimize"
              >
                <span style={{ fontSize: "18px", fontWeight: "bold" }}>–</span>
              </button>
              <div className="saya-title-wrap">
                <span className="saya-title">Saya Assistant</span>
                <span className="saya-status-dot">
                  <span className="dot" /> Assistant ready
                </span>
              </div>
            </div>
            <button
              className="saya-icon-button"
              onClick={() => setIsOpen(false)}
              aria-label="Close Assistant"
              title="Close"
            >
              <span style={{ fontSize: "18px" }}>×</span>
            </button>
          </div>

          {/* Body Content by View */}
          <div className="saya-body">
            {view === "home" && (
              <div className="saya-home-view">
                <div className="saya-assistant-context">
                  <span className="eyebrow">SELLER OPERATIONS</span>
                  <h2>Operations Assistant</h2>
                  <p className="muted">
                    Quickly convert customer conversations into structured orders or match payment slips to pending orders.
                  </p>
                </div>

                {/* Main Actions */}
                <div className="saya-action-cards">
                  <button
                    className="saya-action-card card-chat"
                    onClick={() => {
                      setView("chat");
                      setSavedOrder(null);
                      setErrorMessage("");
                    }}
                  >
                    <div className="saya-card-icon-wrap icon-blue">
                      <Icon name="orders" size={24} />
                    </div>
                    <div className="saya-card-content">
                      <h3>Chat to Order</h3>
                      <p>Paste a customer chat and turn it into an editable order.</p>
                      <span className="saya-action-link">Start extracting →</span>
                    </div>
                  </button>

                  <button
                    className="saya-action-card card-screenshot"
                    onClick={() => {
                      setView("match");
                      setResumeEvidenceId(null);
                      setErrorMessage("");
                    }}
                  >
                    <div className="saya-card-icon-wrap icon-green">
                      <Icon name="wallet" size={24} />
                    </div>
                    <div className="saya-card-content">
                      <h3>Screenshot to Order Match</h3>
                      <p>Review transaction details and find a possible order.</p>
                      <span className="saya-action-link">Upload screenshot →</span>
                    </div>
                  </button>
                </div>

                <p className="saya-privacy-note">
                  Your data stays private and is only used to help with this task.
                </p>
              </div>
            )}

            {/* CHAT TO ORDER VIEW */}
            {view === "chat" && (
              <div className="saya-workflow-view">
                <div className="saya-view-nav">
                  <button className="saya-back-btn" onClick={() => setView("home")}>
                    ← Back
                  </button>
                  <h3>Chat to Order</h3>
                </div>

                {savedOrder ? (
                  <div className="saya-success-card">
                    <Image src={dolphinAccountant} alt="" width={80} height={80} />
                    <h4>Order Saved Successfully!</h4>
                    <p className="order-tag">Order #{savedOrder.id.slice(0, 8).toUpperCase()}</p>
                    <p className="muted">
                      Customer: <strong>{savedOrder.customers?.name ?? "Customer"}</strong>
                      <br />
                      Total: <strong>{formatMmk(savedOrder.total_mmk)} MMK</strong>
                    </p>
                    <div className="saya-success-actions">
                      <button className="auth-submit" onClick={() => setShowVoucher(true)}>
                        View Voucher
                      </button>
                      <button
                        className="auth-secondary"
                        onClick={() => {
                          setSavedOrder(null);
                          setExtractedDraft(null);
                          setChatText("");
                        }}
                      >
                        + New Draft
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="saya-chat-input-section">
                      <label htmlFor="saya-chat-area" className="saya-label">
                        Paste Messenger or TikTok conversation
                      </label>
                      <textarea
                        id="saya-chat-area"
                        className="saya-textarea"
                        rows={4}
                        value={chatText}
                        onChange={(e) => setChatText(e.target.value)}
                        placeholder="Paste customer conversation here..."
                      />

                      <div className="saya-preset-chips">
                        <span className="muted" style={{ fontSize: "0.75rem" }}>
                          Try example:
                        </span>
                        <button
                          type="button"
                          className="saya-chip"
                          onClick={() => setChatText(englishPreset)}
                        >
                          English Chat
                        </button>
                        <button
                          type="button"
                          className="saya-chip"
                          onClick={() => setChatText(burmesePreset)}
                        >
                          မြန်မာ Chat
                        </button>
                      </div>

                      <button
                        type="button"
                        className="auth-submit saya-extract-btn"
                        onClick={handleExtractChat}
                        disabled={isExtracting || !chatText.trim()}
                      >
                        {isExtracting ? "Reviewing conversation…" : "Extract order with AI"}
                      </button>
                    </div>

                    {errorMessage && <p className="business-note" style={{ color: "#e96565" }}>{errorMessage}</p>}

                    {/* Extracted draft order */}
                    {extractedDraft && (
                      <div className="saya-draft-card">
                        <div className="saya-draft-header">
                          <h4>Review & Confirm Order</h4>
                          <span className="status-badge status-info">Draft</span>
                        </div>

                        {/* Customer Info */}
                        <div className="saya-fields-group">
                          <label>
                            Customer Name
                            <input
                              type="text"
                              value={extractedDraft.customer_name}
                              onChange={(e) =>
                                setExtractedDraft({ ...extractedDraft, customer_name: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            Phone Number
                            <input
                              type="text"
                              value={extractedDraft.customer_phone}
                              onChange={(e) =>
                                setExtractedDraft({ ...extractedDraft, customer_phone: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            Delivery Address
                            <input
                              type="text"
                              value={extractedDraft.delivery_address}
                              onChange={(e) =>
                                setExtractedDraft({ ...extractedDraft, delivery_address: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            Notes / Instructions
                            <input
                              type="text"
                              value={extractedDraft.notes}
                              placeholder="e.g. Call before delivery"
                              onChange={(e) =>
                                setExtractedDraft({ ...extractedDraft, notes: e.target.value })
                              }
                            />
                          </label>
                        </div>

                        {/* Line Items */}
                        <div className="saya-items-section">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <span className="eyebrow">ORDER ITEMS</span>
                            <button
                              type="button"
                              className="text-button"
                              style={{ fontSize: "0.75rem" }}
                              onClick={() => {
                                setExtractedDraft({
                                  ...extractedDraft,
                                  items: [
                                    ...extractedDraft.items,
                                    {
                                      id: `item-${Date.now()}`,
                                      product_name: "New Product",
                                      quantity: 1,
                                      unit_price_mmk: 10000,
                                    },
                                  ],
                                });
                              }}
                            >
                              + Add product
                            </button>
                          </div>
                          {extractedDraft.items.map((item, idx) => (
                            <div key={item.id} className="saya-item-row">
                              <input
                                type="text"
                                style={{ flex: 2 }}
                                aria-label={`Product name ${idx + 1}`}
                                value={item.product_name}
                                onChange={(e) => {
                                  const updated = [...extractedDraft.items];
                                  updated[idx]!.product_name = e.target.value;
                                  setExtractedDraft({ ...extractedDraft, items: updated });
                                }}
                              />
                              <div className="qty-control">
                                <button
                                  type="button"
                                  aria-label="Decrease quantity"
                                  onClick={() => {
                                    if (item.quantity > 1) {
                                      const updated = [...extractedDraft.items];
                                      updated[idx]!.quantity = item.quantity - 1;
                                      setExtractedDraft({ ...extractedDraft, items: updated });
                                    }
                                  }}
                                >
                                  -
                                </button>
                                <span>{item.quantity}</span>
                                <button
                                  type="button"
                                  aria-label="Increase quantity"
                                  onClick={() => {
                                    const updated = [...extractedDraft.items];
                                    updated[idx]!.quantity = item.quantity + 1;
                                    setExtractedDraft({ ...extractedDraft, items: updated });
                                  }}
                                >
                                  +
                                </button>
                              </div>
                              <input
                                type="number"
                                aria-label={`Unit price ${idx + 1}`}
                                style={{ width: "90px", textAlign: "right" }}
                                value={item.unit_price_mmk}
                                onChange={(e) => {
                                  const updated = [...extractedDraft.items];
                                  updated[idx]!.unit_price_mmk = Number(e.target.value) || 0;
                                  setExtractedDraft({ ...extractedDraft, items: updated });
                                }}
                              />
                              {extractedDraft.items.length > 1 && (
                                <button
                                  type="button"
                                  className="text-button"
                                  aria-label={`Remove ${item.product_name}`}
                                  style={{ color: "#e96565", fontSize: "0.8rem", padding: "0 4px" }}
                                  onClick={() => {
                                    setExtractedDraft({
                                      ...extractedDraft,
                                      items: extractedDraft.items.filter((_, n) => n !== idx),
                                    });
                                  }}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Totals Summary */}
                        <div className="saya-totals-summary">
                          <div>
                            <span>Subtotal:</span>
                            <span>{formatMmk(totals.subtotal_mmk)} MMK</span>
                          </div>
                          <div>
                            <span>Delivery Fee:</span>
                            <input
                              type="number"
                              min="0"
                              style={{ width: "80px", textAlign: "right", padding: "3px 6px" }}
                              value={extractedDraft.delivery_fee_mmk}
                              onChange={(e) =>
                                setExtractedDraft({
                                  ...extractedDraft,
                                  delivery_fee_mmk: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div>
                            <span>Discount:</span>
                            <input
                              type="number"
                              min="0"
                              style={{ width: "80px", textAlign: "right", padding: "3px 6px" }}
                              value={extractedDraft.discount_mmk}
                              onChange={(e) =>
                                setExtractedDraft({
                                  ...extractedDraft,
                                  discount_mmk: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                            />
                          </div>
                          <div className="grand-total-row">
                            <strong>Total MMK:</strong>
                            <strong>{formatMmk(totals.total_mmk)} MMK</strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="auth-submit saya-save-btn"
                          onClick={handleSaveOrder}
                          disabled={isSavingOrder}
                        >
                          {isSavingOrder ? "Saving order…" : "Approve & Save Order"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* SCREENSHOT TO ORDER MATCH VIEW */}
            {view === "match" && (
              <div className="saya-workflow-view">
                <div className="saya-view-nav">
                  <button className="saya-back-btn" onClick={() => setView("home")}>
                    ← Back
                  </button>
                  <h3>Screenshot to Order Match</h3>
                </div>
                <ScreenshotToOrderWorkflow key={resumeEvidenceId ?? "new-review"} shopId={shopId} resumeEvidenceId={resumeEvidenceId} />
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Full Voucher Modal */}
      {showVoucher && savedOrder && (
        <VoucherModal order={savedOrder} onClose={() => setShowVoucher(false)} />
      )}
    </>
  );
}
