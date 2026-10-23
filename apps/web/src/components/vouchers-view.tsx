"use client";

import { useEffect, useState, useRef } from "react";
import { Card, Icon } from "@ocean/ui";
import { formatMmk } from "@/lib/business/types";
import type { OrderDetails } from "@ocean/contracts";
import { useShellLanguage } from "./shell-language";
import { shellLabels } from "@/lib/shell-ui";

const statusLabel = (value: string, isBurmese: boolean) => {
  if (isBurmese) {
    if (value === "paid") return "ပေးချေပြီး";
    if (value === "unpaid") return "မပေးချေရသေး";
    if (value === "partially_paid") return "တစ်စိတ်တစ်ပိုင်း";
    if (value === "refunded") return "ငွေပြန်အမ်းပြီး";
  }
  return value.split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
};

const paymentTone = (status: string) =>
  status === "paid" ? "status-success" : status === "refunded" ? "status-neutral" : "status-warning";

export function VouchersView({ orders }: { orders: OrderDetails[] }) {
  const [selectedOrder, setSelectedOrder] = useState<OrderDetails | null>(null);
  const { language } = useShellLanguage();
  const labels = shellLabels(language);
  const isBurmese = language === "my";

  const confirmedOrders = orders.filter((o) => o.order_status === "confirmed");

  return (
    <div className="page-stack">
      <div className="order-list-heading">
        <div>
          <h2>{labels.vouchers}</h2>
          <p className="muted">
            {isBurmese
              ? "အတည်ပြုပြီး အော်ဒါများအတွက် မြန်မာ့လုပ်ငန်းသုံး ဘောင်ချာများကို ကြည့်ရှုထုတ်ယူပါ"
              : "Preview the current saved order as a printable voucher."}
          </p>
        </div>
      </div>

      <Card className="orders-card real-orders">
        {!confirmedOrders.length ? (
          <div className="table-empty">
            <Icon name="orders" size={30} />
            <h3>{isBurmese ? "ဘောင်ချာထုတ်ရန် အတည်ပြုထားသော အော်ဒါမရှိပါ" : "No confirmed orders to preview"}</h3>
            <p>
              {isBurmese
                ? "အော်ဒါကို အတည်ပြုပြီးမှသာ ဘောင်ချာထုတ်ယူနိုင်ပါမည်။"
                : "Confirm an order before previewing its saved details as a voucher."}
            </p>
          </div>
        ) : (
          <div className="table-scroll order-records">
            <table className="data-table">
              <caption className="sr-only">Confirmed orders available for voucher preview.</caption>
              <thead>
                <tr>
                  <th scope="col">{labels.orderId}</th>
                  <th scope="col">{labels.customer}</th>
                  <th scope="col">{labels.date}</th>
                  <th scope="col" className="amount-cell">{labels.amount}</th>
                  <th scope="col">{labels.paymentStatus}</th>
                  <th scope="col" className="amount-cell">{labels.action}</th>
                </tr>
              </thead>
              <tbody>
                {confirmedOrders.map((order) => {
                  return (
                    <tr key={order.id}>
                      <td data-label={labels.orderId}>
                        <button
                          type="button"
                          className="table-action-btn"
                          onClick={() => setSelectedOrder(order)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--ocean-primary-strong)",
                            fontWeight: 700,
                            cursor: "pointer",
                            padding: 0,
                            fontFamily: "inherit",
                          }}
                          aria-label={`Open voucher for #${order.id.slice(0, 8).toUpperCase()}`}
                        >
                          #{order.id.slice(0, 8).toUpperCase()}
                        </button>
                      </td>
                      <td data-label={labels.customer}>
                        <span>{order.customers?.name ?? (isBurmese ? "ဝယ်သူအမည်မရှိ" : "Customer unavailable")}</span>
                        {order.customers?.phone && <small className="block muted">{order.customers.phone}</small>}
                      </td>
                      <td data-label={labels.date}>
                        {new Intl.DateTimeFormat(isBurmese ? "my-MM" : "en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Asia/Yangon",
                        }).format(new Date(order.created_at))}
                      </td>
                      <td data-label={labels.amount} className="amount-cell font-mono">
                        <strong>{formatMmk(order.total_mmk)} MMK</strong>
                      </td>
                      <td data-label={labels.paymentStatus}>
                        <span className={`status-badge ${paymentTone(order.payment_status)}`}>
                          {statusLabel(order.payment_status, isBurmese)}
                        </span>
                      </td>
                      <td data-label={labels.action} className="amount-cell">
                        <button
                          className="auth-secondary"
                          style={{ padding: "6px 14px", fontSize: "0.8rem", cursor: "pointer" }}
                          onClick={() => setSelectedOrder(order)}
                          aria-label={`Preview voucher for order ${order.id}`}
                        >
                          {isBurmese ? "ဘောင်ချာကြည့်ရန်" : "Preview"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedOrder && (
        <VoucherModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          isBurmese={isBurmese}
        />
      )}
    </div>
  );
}

export function VoucherModal({
  order,
  onClose,
  isBurmese = false,
}: {
  order: OrderDetails;
  onClose: () => void;
  isBurmese?: boolean;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const orderLabel = `#${order.id.slice(0, 8).toUpperCase()}`;

  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "Tab" && modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (!focusable.length) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      trigger?.focus();
    };
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="voucher-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voucher-preview-title"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="voucher-modal-box"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="voucher-modal-header no-print">
          <h3 id="voucher-preview-title">
            {isBurmese ? `အရောင်းပြေစာ · အော်ဒါ ${orderLabel}` : `Voucher preview · Order ${orderLabel}`}
          </h3>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {order.payment_status === "unpaid" && (
              <button
                type="button"
                className="auth-secondary"
                style={{ fontWeight: 600, color: "var(--ocean-primary-strong, #0284c7)" }}
                onClick={() => {
                  onClose();
                  window.dispatchEvent(
                    new CustomEvent("open-saya-assistant", {
                      detail: { view: "match", orderId: order.id, shopId: order.shop_id },
                    })
                  );

                }}
              >
                {isBurmese ? "စလစ်စစ်ဆေးမည် →" : "Verify Slip →"}
              </button>
            )}
            <button type="button" className="auth-submit voucher-print-btn" onClick={handlePrint}>
              {isBurmese ? "ပရင့်ထုတ်ရန် / PDF သိမ်းရန်" : "Print / Save PDF"}
            </button>
            <button ref={closeRef} type="button" className="auth-secondary" onClick={onClose}>
              {isBurmese ? "ပိတ်ရန်" : "Close"}
            </button>
          </div>
        </div>

      <div className="voucher-sheet" ref={printRef}>
        <div className="voucher-header">
          <div className="voucher-brand">
            <div>
              <h2>{isBurmese ? "အရောင်းပြေစာ / ဘောင်ချာ" : "Order voucher"}</h2>
              <p className="muted">
                {isBurmese ? "အတည်ပြုပြီး အော်ဒါမှတ်တမ်းမှ ထုတ်ယူထားသော ပြေစာ" : "Prepared from saved order details."}
              </p>
            </div>
          </div>
          <div className="voucher-meta">
            <p><strong>{isBurmese ? "အော်ဒါ:" : "Order:"}</strong> {orderLabel}</p>
            <p>
              <strong>{isBurmese ? "ရက်စွဲ:" : "Date:"}</strong>{" "}
              {new Intl.DateTimeFormat(isBurmese ? "my-MM" : "en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Yangon",
              }).format(new Date(order.created_at))}
            </p>
            <p>
              <strong>{isBurmese ? "အခြေအနေ:" : "Status:"}</strong>{" "}
              <span className={`status-badge ${paymentTone(order.payment_status)}`}>
                {statusLabel(order.payment_status, isBurmese)}
              </span>
            </p>
          </div>
        </div>

        <hr className="voucher-divider" />

        <div className="voucher-customer">
          <div>
            <p className="eyebrow">{isBurmese ? "ဝယ်သူ အချက်အလက်" : "CUSTOMER DETAILS"}</p>
            <h4>{order.customers?.name ?? (isBurmese ? "ဝယ်သူအမည် မှတ်တမ်းမရှိပါ" : "Customer name not recorded")}</h4>
            <p>{order.customers?.phone ?? (isBurmese ? "ဖုန်းနံပါတ် မရှိပါ" : "No phone recorded")}</p>
          </div>
          {order.delivery_address && (
            <div style={{ maxWidth: "260px" }}>
              <p className="eyebrow">{isBurmese ? "ပို့ဆောင်ရမည့် လိပ်စာ" : "DELIVERY ADDRESS"}</p>
              <p>{order.delivery_address}</p>
            </div>
          )}
        </div>

        <table className="voucher-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>{isBurmese ? "ကုန်ပစ္စည်း အမည်" : "Item & Description"}</th>
              <th style={{ textAlign: "center" }}>{isBurmese ? "အရေအတွက်" : "Qty"}</th>
              <th style={{ textAlign: "right" }}>{isBurmese ? "နှုန်း (MMK)" : "Price (MMK)"}</th>
              <th style={{ textAlign: "right" }}>{isBurmese ? "ကျသင့်ငွေ (MMK)" : "Total (MMK)"}</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items.map((item) => (
              <tr key={item.id}>
                <td>{item.product_name}</td>
                <td style={{ textAlign: "center" }}>{item.quantity}</td>
                <td style={{ textAlign: "right" }} className="font-mono">{formatMmk(item.unit_price_mmk)}</td>
                <td style={{ textAlign: "right" }} className="font-mono">{formatMmk(item.line_total_mmk)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="voucher-totals">
          <div className="voucher-totals-rows">
            <div className="voucher-totals-row">
              <span>{isBurmese ? "ကျသင့်ငွေ ပေါင်း:" : "Subtotal:"}</span>
              <span className="font-mono">{formatMmk(order.subtotal_mmk)} MMK</span>
            </div>
            {order.delivery_fee_mmk > 0 && (
              <div className="voucher-totals-row">
                <span>{isBurmese ? "ပို့ဆောင်ခ:" : "Delivery Fee:"}</span>
                <span className="font-mono">+{formatMmk(order.delivery_fee_mmk)} MMK</span>
              </div>
            )}
            {order.discount_mmk > 0 && (
              <div className="voucher-totals-row discount">
                <span>{isBurmese ? "လျှော့စျေး:" : "Discount:"}</span>
                <span className="font-mono">-{formatMmk(order.discount_mmk)} MMK</span>
              </div>
            )}
            <div className="voucher-totals-row grand-total">
              <strong>{isBurmese ? "ကျသင့်ငွေ စုစုပေါင်း:" : "Grand Total:"}</strong>
              <strong className="font-mono">{formatMmk(order.total_mmk)} MMK</strong>
            </div>
          </div>
        </div>

        {order.notes && (
          <div className="voucher-notes">
            <p className="eyebrow">{isBurmese ? "မှတ်ချက်" : "NOTES"}</p>
            <p>{order.notes}</p>
          </div>
        )}

        <div className="voucher-footer">
          <p>{isBurmese ? "ဝယ်ယူအားပေးမှုအတွက် အထူးကျေးဇူးတင်ရှိပါသည်!" : "Thank you for your order!"}</p>
          <small className="muted">
            တူတူတွက်မယ် · {isBurmese ? "အရောင်းနှင့် ငွေစာရင်း အထောက်အကူပြု လက်ထောက်" : "Business Assistant for Myanmar Sellers"}
          </small>
        </div>
      </div>
    </div>
  </div>
);
}

