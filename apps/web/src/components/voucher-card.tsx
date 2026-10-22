import { useRef } from "react";
import { formatMmk } from "@/lib/business/types";

export interface VoucherOrder {
  id: string;
  shop_id?: string;
  created_at?: string;
  order_status?: string;
  payment_status?: string;
  fulfillment_status?: string;
  subtotal_mmk: number;
  delivery_fee_mmk: number;
  discount_mmk: number;
  total_mmk: number;
  delivery_address?: string | null;
  notes?: string | null;
  customers?: {
    name?: string | null;
    phone?: string | null;
  } | null;
  order_items: Array<{
    id?: string;
    product_name: string;
    quantity: number;
    unit_price_mmk: number;
    line_total_mmk?: number;
  }>;
}

export function exportVoucherAsPng(
  order: VoucherOrder,
  shopName: string = "တူတူတွက်မယ်",
  isBurmese: boolean = false,
) {
  const canvas = document.createElement("canvas");
  const scale = 2; // high resolution for crisp rendering
  const width = 640;
  const padding = 32;
  const itemHeight = 32;
  const baseHeight = 460;
  const height = baseHeight + (order.order_items.length * itemHeight);

  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Top header bar (Blue brand gradient)
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, "#0066cc");
  gradient.addColorStop(1, "#004ea3");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, 88);

  // Header texts
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
  ctx.fillText(shopName, padding, 38);

  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#e0edff";
  ctx.fillText(isBurmese ? "အရောင်းပြေစာ" : "SALES VOUCHER", padding, 62);

  // Order # & Date badge in header
  ctx.textAlign = "right";
  ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`#${order.id.slice(0, 8).toUpperCase()}`, width - padding, 38);

  ctx.font = "11px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#e0edff";
  const dateStr = order.created_at
    ? new Date(order.created_at).toLocaleDateString("en-GB")
    : new Date().toLocaleDateString("en-GB");
  ctx.fillText(dateStr, width - padding, 62);
  ctx.textAlign = "left";

  let y = 115;

  // Customer box
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(padding, y, width - padding * 2, 85, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#64748b";
  ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
  ctx.fillText(isBurmese ? "ဝယ်သူအချက်အလက်" : "CUSTOMER DETAILS", padding + 16, y + 22);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
  ctx.fillText(order.customers?.name || (isBurmese ? "ဝယ်သူ" : "Customer"), padding + 16, y + 44);

  ctx.fillStyle = "#334155";
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  const phoneText = order.customers?.phone
    ? `📞 ${order.customers.phone}`
    : (isBurmese ? "ဖုန်းနံပါတ် မရှိပါ" : "No phone provided");
  ctx.fillText(phoneText, padding + 16, y + 66);

  if (order.delivery_address) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#475569";
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.fillText(`📍 ${order.delivery_address.slice(0, 36)}`, width - padding - 16, y + 54);
    ctx.textAlign = "left";
  }

  y += 108;

  // Items table header
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(padding, y, width - padding * 2, 30);
  ctx.fillStyle = "#475569";
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.fillText(isBurmese ? "ပစ္စည်းအမည်" : "ITEM", padding + 12, y + 19);
  ctx.fillText(isBurmese ? "အရေအတွက်" : "QTY", width - padding - 220, y + 19);
  ctx.fillText(isBurmese ? "နှုန်း (ကျပ်)" : "PRICE (MMK)", width - padding - 130, y + 19);
  ctx.textAlign = "right";
  ctx.fillText(isBurmese ? "သင့်ငွေ (ကျပ်)" : "TOTAL (MMK)", width - padding - 12, y + 19);
  ctx.textAlign = "left";

  y += 30;

  // Items table rows
  order.order_items.forEach((item, idx) => {
    if (idx % 2 === 1) {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(padding, y, width - padding * 2, itemHeight);
    }
    ctx.fillStyle = "#1e293b";
    ctx.font = "13px system-ui, -apple-system, sans-serif";
    ctx.fillText(item.product_name.slice(0, 32), padding + 12, y + 20);

    ctx.fillStyle = "#334155";
    ctx.fillText(String(item.quantity), width - padding - 215, y + 20);
    ctx.fillText(item.unit_price_mmk.toLocaleString("en-US"), width - padding - 130, y + 20);

    ctx.textAlign = "right";
    const lineTotal = item.line_total_mmk ?? (item.quantity * item.unit_price_mmk);
    ctx.fillText(lineTotal.toLocaleString("en-US"), width - padding - 12, y + 20);
    ctx.textAlign = "left";

    // bottom border
    ctx.strokeStyle = "#edf2f7";
    ctx.beginPath();
    ctx.moveTo(padding, y + itemHeight);
    ctx.lineTo(width - padding, y + itemHeight);
    ctx.stroke();

    y += itemHeight;
  });

  y += 16;

  // Totals
  const totalsX = width - padding - 240;
  const valuesX = width - padding - 12;

  ctx.fillStyle = "#475569";
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.fillText(isBurmese ? "စုစုပေါင်း:" : "Subtotal:", totalsX, y);
  ctx.textAlign = "right";
  ctx.fillText(`${order.subtotal_mmk.toLocaleString("en-US")} MMK`, valuesX, y);
  ctx.textAlign = "left";
  y += 20;

  if (order.delivery_fee_mmk > 0) {
    ctx.fillText(isBurmese ? "ပို့ဆောင်ခ:" : "Delivery Fee:", totalsX, y);
    ctx.textAlign = "right";
    ctx.fillText(`+${order.delivery_fee_mmk.toLocaleString("en-US")} MMK`, valuesX, y);
    ctx.textAlign = "left";
    y += 20;
  }

  if (order.discount_mmk > 0) {
    ctx.fillStyle = "#dc2626";
    ctx.fillText(isBurmese ? "လျှော့ဈေး:" : "Discount:", totalsX, y);
    ctx.textAlign = "right";
    ctx.fillText(`-${order.discount_mmk.toLocaleString("en-US")} MMK`, valuesX, y);
    ctx.textAlign = "left";
    ctx.fillStyle = "#475569";
    y += 20;
  }

  // Grand Total highlight box
  y += 6;
  ctx.fillStyle = "#eff6ff";
  ctx.strokeStyle = "#bfdbfe";
  ctx.beginPath();
  ctx.roundRect(totalsX - 10, y, (width - padding) - (totalsX - 10), 38, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#1e40af";
  ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
  ctx.fillText(isBurmese ? "ကျသင့်ငွေ စုစုပေါင်း:" : "Grand Total:", totalsX, y + 24);
  ctx.textAlign = "right";
  ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${order.total_mmk.toLocaleString("en-US")} MMK`, valuesX, y + 24);
  ctx.textAlign = "left";

  y += 56;

  // Footer note
  ctx.fillStyle = "#64748b";
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    isBurmese ? "အားပေးမှုကို အထူးပင် ကျေးဇူးတင်ရှိပါသည်" : "Thank you for shopping with us!",
    width / 2,
    y,
  );

  // Convert to image and download
  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.download = `Voucher-${order.id.slice(0, 8).toUpperCase()}.png`;
  link.href = dataUrl;
  link.click();
}

export function VoucherCard({
  order,
  shopName = "တူတူတွက်မယ်",
  sourceText = "",
  onEdit,
  isEditing = false,
  onSaveToShop,
  isSavingToShop = false,
  isSavedToShop = false,
  onClose,
  children,
}: {
  order: VoucherOrder;
  shopName?: string;
  sourceText?: string;
  onEdit?: () => void;
  isEditing?: boolean;
  onSaveToShop?: () => void;
  isSavingToShop?: boolean;
  isSavedToShop?: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  // Single language detection according to customer sentences
  const isBurmese = /[\u1000-\u109F]/u.test(
    `${sourceText} ${order.customers?.name || ""} ${order.delivery_address || ""} ${order.order_items.map((i) => i.product_name).join(" ")}`,
  );

  const handlePrint = () => {
    window.print();
  };

  const handleSavePng = () => {
    exportVoucherAsPng(order, shopName, isBurmese);
  };

  const orderLabel = `#${order.id.slice(0, 8).toUpperCase()}`;
  const formattedDate = order.created_at
    ? new Date(order.created_at).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : new Date().toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      });

  return (
    <div className="voucher-container">
      {/* Clean Voucher Taskbar: Voucher No: Edit, Save, Print (UI UX icons only, no text, no emojis) */}
      <div className="voucher-toolbar no-print">
        <div className="voucher-toolbar-title">
          <span>Voucher No: <strong>{orderLabel}</strong></span>
        </div>
        <div className="voucher-toolbar-actions">
          {onEdit && (
            <button
              type="button"
              className={`voucher-action-btn edit-btn ${isEditing ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              title={isEditing ? "Close edit" : "Edit"}
              aria-label="Edit"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="voucher-action-btn save-btn"
            onClick={handleSavePng}
            title="Save as PNG"
            aria-label="Save as PNG"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          </button>
          <button
            type="button"
            className="voucher-action-btn print-btn"
            onClick={handlePrint}
            title="Print"
            aria-label="Print"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
          </button>
          {onClose && (
            <button
              type="button"
              className="voucher-action-btn close-btn"
              onClick={onClose}
              title="Close"
              aria-label="Close"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Top children slot for Edit Drawer and Append Actions */}
      {children}

      {/* Printable / Viewable Single Language Voucher Sheet */}
      <div className="voucher-sheet" ref={printRef}>
        <div className="voucher-header">
          <div className="voucher-brand">
            <div>
              <h2>{shopName}</h2>
              <p className="voucher-subtitle">
                {isBurmese ? "အရောင်းပြေစာ" : "Sales Voucher"}
              </p>
            </div>
          </div>
          <div className="voucher-meta">
            <p>
              <strong>{isBurmese ? "အော်ဒါ:" : "Order:"}</strong> {orderLabel}
            </p>
            <p>
              <strong>{isBurmese ? "ရက်စွဲ:" : "Date:"}</strong> {formattedDate}
            </p>
            <p>
              <strong>{isBurmese ? "အခြေအနေ:" : "Status:"}</strong>{" "}
              <span className="voucher-status-tag">
                {isBurmese ? "အတည်ပြုပြီး" : (order.order_status || "confirmed").toUpperCase()}
              </span>
            </p>
          </div>
        </div>

        <hr className="voucher-divider" />

        <div className="voucher-customer">
          <div>
            <p className="voucher-section-label">
              {isBurmese ? "ဝယ်သူအချက်အလက်" : "CUSTOMER DETAILS"}
            </p>
            <h4>{order.customers?.name || (isBurmese ? "ဝယ်သူ" : "Customer")}</h4>
            <p className="voucher-phone">
              {order.customers?.phone || (isBurmese ? "ဖုန်းနံပါတ် မရှိပါ" : "No phone provided")}
            </p>
          </div>
          {(order.delivery_address || order.notes) && (
            <div style={{ textAlign: "right", maxWidth: "55%" }}>
              {order.delivery_address && (
                <p>
                  <strong>{isBurmese ? "လိပ်စာ:" : "Delivery:"}</strong> {order.delivery_address}
                </p>
              )}
              {order.notes && (
                <p className="voucher-notes">
                  <strong>{isBurmese ? "မှတ်ချက်:" : "Note:"}</strong> {order.notes}
                </p>
              )}
            </div>
          )}
        </div>

        <table className="voucher-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>{isBurmese ? "ပစ္စည်းအမည်" : "Item"}</th>
              <th style={{ textAlign: "center", width: "65px" }}>{isBurmese ? "အရေအတွက်" : "Qty"}</th>
              <th style={{ textAlign: "right", width: "105px" }}>{isBurmese ? "နှုန်း" : "Unit Price"}</th>
              <th style={{ textAlign: "right", width: "115px" }}>{isBurmese ? "သင့်ငွေ" : "Amount"}</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items.map((item, idx) => {
              const lineTotal =
                item.line_total_mmk ?? item.quantity * item.unit_price_mmk;
              return (
                <tr key={item.id ?? idx}>
                  <td>{item.product_name}</td>
                  <td style={{ textAlign: "center" }}>{item.quantity}</td>
                  <td style={{ textAlign: "right" }}>
                    {formatMmk(item.unit_price_mmk)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {formatMmk(lineTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <hr className="voucher-divider" />

        <div className="voucher-totals">
          <div className="voucher-totals-row">
            <span>{isBurmese ? "စုစုပေါင်း:" : "Subtotal:"}</span>
            <span>{formatMmk(order.subtotal_mmk)}</span>
          </div>
          {order.delivery_fee_mmk > 0 && (
            <div className="voucher-totals-row">
              <span>{isBurmese ? "ပို့ဆောင်ခ:" : "Delivery Fee:"}</span>
              <span>+{formatMmk(order.delivery_fee_mmk)}</span>
            </div>
          )}
          {order.discount_mmk > 0 && (
            <div className="voucher-totals-row discount">
              <span>{isBurmese ? "လျှော့ဈေး:" : "Discount:"}</span>
              <span>-{formatMmk(order.discount_mmk)}</span>
            </div>
          )}
          <div className="voucher-totals-row total">
            <strong>{isBurmese ? "ကျသင့်ငွေ စုစုပေါင်း:" : "Grand Total:"}</strong>
            <strong>{formatMmk(order.total_mmk)}</strong>
          </div>
        </div>

        <div className="voucher-footer">
          <p>
            {isBurmese
              ? "အားပေးမှုကို အထူးပင် ကျေးဇူးတင်ရှိပါသည်"
              : "Thank you for shopping with us!"}
          </p>
        </div>
      </div>

      {/* Save to shop button if not yet saved */}
      {onSaveToShop && (
        <div className="voucher-bottom-actions no-print">
          <button
            type="button"
            className="primary-button save-to-shop-btn"
            disabled={isSavedToShop || isSavingToShop}
            onClick={onSaveToShop}
          >
            {isSavingToShop
              ? (isBurmese ? "အော်ဒါသိမ်းဆည်းနေပါသည်…" : "Saving order to workspace…")
              : isSavedToShop
              ? (isBurmese ? "✓ အော်ဒါသိမ်းဆည်းပြီးပါပြီ" : "✓ Order Saved to Shop")
              : (isBurmese ? "✓ ဆိုင်အကောင့်ထဲသို့ အော်ဒါသိမ်းမည်" : "✓ Save Order to Shop")}
          </button>
        </div>
      )}
    </div>
  );
}
