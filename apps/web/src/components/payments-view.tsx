"use client";

import { useState } from "react";
import { Card, Icon } from "@ocean/ui";
import { formatMmk } from "@/lib/business/types";
import type { OrderDetails, ScreenshotExtraction } from "@ocean/contracts";
import { useShellLanguage } from "./shell-language";
import { shellLabels } from "@/lib/shell-ui";

export interface PaymentItem {
  id: string;
  order_id: string;
  amount_mmk: number;
  payment_method: string;
  reference_number: string | null;
  verified_at: string;
  created_at: string;
  customer_name?: string | null;
  order_total?: number;
  evidence_id?: string | null;
}

export interface PaymentEvidenceItem {
  id: string;
  shop_id?: string;
  order_id: string | null;
  status: "pending_review" | "rejected" | "verified";
  seller_reviewed: ScreenshotExtraction | null;
  payment_id: string | null;
  verified_at: string | null;
  amount_mmk: number | null;
  provider: string | null;
  reference_number: string | null;
  order_total_mmk: number | null;
  customer_name: string | null;
}

export function PaymentsView({
  payments,
  orders,
  evidenceReviews = [],
  shopId,
  currentShopName,
  otherShops = [],
}: {
  payments: PaymentItem[];
  orders: OrderDetails[];
  evidenceReviews?: PaymentEvidenceItem[];
  shopId?: string;
  currentShopName?: string;
  otherShops?: Array<{ shop_id: string; name: string }>;
}) {
  const [filterMethod, setFilterMethod] = useState("");
  const [query, setQuery] = useState("");
  const { language } = useShellLanguage();
  const labels = shellLabels(language);
  const isBurmese = language === "my";

  const orderMap = new Map(orders.map((o) => [o.id, o]));

  const filtered = payments.filter((p) => {
    const order = orderMap.get(p.order_id);
    const text = `${p.reference_number ?? ""} ${p.payment_method} ${p.customer_name ?? order?.customers?.name ?? ""} ${p.order_id}`.toLowerCase();
    const matchQuery = !query || text.includes(query.toLowerCase());
    const matchMethod = !filterMethod || p.payment_method === filterMethod;
    return matchQuery && matchMethod;
  });

  const totalReceived = payments.reduce((sum, p) => sum + p.amount_mmk, 0);

  return (
    <div className="page-stack">
      <div className="order-list-heading">
        <div>
          <h2>{labels.payments}</h2>
          <p className="muted">
            {isBurmese
              ? "ဆိုင်ရှင်ကိုယ်တိုင် စစ်ဆေးအတည်ပြုပြီးသော မိုဘိုင်းလ်ဘဏ်နှင့် ငွေလွှဲမှတ်တမ်းများ"
              : "Confirmed seller-verified payments recorded in your shop"}
          </p>
        </div>
      </div>

      <div className="metrics-grid">
        <Card className="metric metric-sales">
          <div className="metric-header-row">
            <span className="metric-icon">
              <Icon name="wallet" />
            </span>
            <span className="metric-pill">
              {isBurmese ? "စုစုပေါင်း" : "Total"}
            </span>
          </div>
          <h2>{isBurmese ? "စုစုပေါင်း လက်ခံရရှိငွေ" : "Total Receipts"}</h2>
          <p className="metric-value font-mono">
            {formatMmk(totalReceived)} <span>MMK</span>
          </p>
          <p className="metric-note">
            {payments.length} {isBurmese ? "ကြိမ် အတည်ပြုပြီး" : "verified transactions"}
          </p>
        </Card>

        <Card className="metric metric-payments">
          <div className="metric-header-row">
            <span className="metric-icon">
              <Icon name="arrow" />
            </span>
            <span className="metric-pill">
              KPay / Wave
            </span>
          </div>
          <h2>{isBurmese ? "ဒစ်ဂျစ်တယ် မိုဘိုင်းလ်ဘဏ်" : "Digital Payments"}</h2>
          <p className="metric-value font-mono">
            {formatMmk(
              payments
                .filter((p) => ["KBZPay", "WavePay", "CB Pay", "AYA Pay"].includes(p.payment_method))
                .reduce((sum, p) => sum + p.amount_mmk, 0)
            )}{" "}
            <span>MMK</span>
          </p>
          <p className="metric-note">
            {isBurmese ? "KBZPay၊ WavePay နှင့် မိုဘိုင်းလ်ပိုက်ဆံအိတ်များ" : "KPay, WavePay & digital wallets"}
          </p>
        </Card>

        <Card className="metric metric-profit">
          <div className="metric-header-row">
            <span className="metric-icon">
              <Icon name="orders" />
            </span>
            <span className="metric-pill">
              COD
            </span>
          </div>
          <h2>{isBurmese ? "အိမ်ရောက်ငွေချေ (COD)" : "Cash on Delivery"}</h2>
          <p className="metric-value font-mono">
            {formatMmk(
              payments
                .filter((p) => p.payment_method.toLowerCase().includes("cash") || p.payment_method === "COD")
                .reduce((sum, p) => sum + p.amount_mmk, 0)
            )}{" "}
            <span>MMK</span>
          </p>
          <p className="metric-note">
            {isBurmese ? "ပို့ဆောင်ရေးမှ ကောက်ခံရရှိငွေ" : "Settled courier collections"}
          </p>
        </Card>
      </div>

      <Card className="orders-card real-orders">
        <div className="order-list-heading">
          <div>
            <h2>{isBurmese ? "ငွေလွှဲစလစ် စစ်ဆေးမှု မှတ်တမ်း" : "Payment Evidence Reviews"}</h2>
            <p className="muted">
              {isBurmese
                ? "ဝယ်သူပေးပို့သော ငွေလွှဲစလစ်များကို ဆိုင်ရှင်ကိုယ်တိုင် စစ်ဆေးအတည်ပြုရန် နေရာဖြစ်ပါသည်။"
                : "Evidence is separate from payments until you verify funds against a trusted record."}
            </p>
          </div>
        </div>
        {!evidenceReviews.length ? (
          <div className="table-empty">
            <Icon name="wallet" size={30} />
            <h3>{isBurmese ? "စစ်ဆေးရန် စလစ်မရှိပါ" : "No saved evidence reviews"}</h3>
            <p>
              {isBurmese
                ? "တင်ထားသော စလစ်များကို ဆိုင်ရှင်အတည်မပြုမချင်း သီးခြားထားရှိပါသည်။"
                : "Uploaded screenshots stay separate from the payment ledger until a seller decision is recorded."}
            </p>
            {otherShops.length > 0 && (
              <div style={{ marginTop: "1rem", padding: "0.85rem 1.25rem", background: "var(--surface-muted, #f8fafc)", borderRadius: "8px", border: "1px solid var(--border-subtle, #e2e8f0)", maxWidth: "520px" }}>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-muted, #64748b)", lineHeight: 1.5 }}>
                  {isBurmese ? (
                    <>လက်ရှိဆိုင်ခွဲ: <strong>{currentShopName || "ဤဆိုင်"}</strong> တွင် စလစ်မှတ်တမ်းမရှိသေးပါ။ အခြားဆိုင်ခွဲသို့ ပြောင်းလဲကြည့်ရှုလိုပါက-</>
                  ) : (
                    <>You are viewing <strong>{currentShopName || "this shop"}</strong>. If you saved reviews from the floating assistant in another workspace, click below to view them:</>
                  )}
                </p>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.6rem", justifyContent: "center" }}>
                  {otherShops.map((other) => (
                    <a
                      key={other.shop_id}
                      href={`/sales?tab=payments&shop=${other.shop_id}`}
                      className="btn-secondary"
                      style={{ fontSize: "0.8125rem", padding: "0.35rem 0.85rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                    >
                      <span>{other.name}</span>
                      <span>→</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="hosted-candidate-list" aria-label="Payment evidence review records">
            {evidenceReviews.map((evidence) => {
              const signals = [
                evidence.amount_mmk === null ? (isBurmese ? "ပမာဏ လိုအပ်နေသည်" : "Amount missing") : null,
                !evidence.provider ? (isBurmese ? "ဘဏ်/ပိုက်ဆံအိတ် လိုအပ်နေသည်" : "Provider missing") : null,
                !evidence.reference_number ? (isBurmese ? "လုပ်ငန်းစဥ်နံပါတ် လိုအပ်နေသည်" : "Reference missing") : null,
                evidence.amount_mmk !== null && evidence.order_total_mmk !== null && evidence.amount_mmk !== evidence.order_total_mmk ? (isBurmese ? "အော်ဒါတန်ဖိုးနှင့် ကွာခြားနေသည်" : "Amount differs from order total") : null,
                !evidence.order_id ? (isBurmese ? "အော်ဒါ မရွေးချယ်ရသေးပါ" : "No order selected") : null,
              ].filter((signal): signal is string => signal !== null);

              return (
                <article className="hosted-candidate" key={evidence.id}>
                  <span className="hosted-candidate-top">
                    <strong>{evidence.customer_name ?? (isBurmese ? "အော်ဒါမချိတ်ဆက်ရသေးသော စလစ်" : "Evidence without an order")}</strong>
                    <span className={`status-badge ${evidence.status === "verified" ? "status-success" : evidence.status === "rejected" ? "status-warning" : "status-neutral"}`}>
                      {isBurmese && evidence.status === "pending_review"
                        ? "စစ်ဆေးဆဲ"
                        : isBurmese && evidence.status === "rejected"
                        ? "ပယ်ချထားသော စလစ်"
                        : isBurmese && evidence.status === "verified"
                        ? "အတည်ပြုပြီး ငွေပေးချေမှု"
                        : evidence.status === "pending_review"
                        ? "Pending review"
                        : evidence.status === "rejected"
                        ? "Rejected evidence"
                        : "Verified with payment"}
                    </span>
                  </span>
                  <span>{evidence.amount_mmk === null ? (isBurmese ? "ပမာဏမသိရ" : "Amount missing") : `${formatMmk(evidence.amount_mmk)} MMK`} · {evidence.provider ?? "Provider"} · Ref {evidence.reference_number ?? "missing"}</span>
                  <span>{evidence.order_id ? `Order #${evidence.order_id.slice(0, 8).toUpperCase()} · ${evidence.order_total_mmk === null ? "" : `${formatMmk(evidence.order_total_mmk)} MMK total`}` : (isBurmese ? "အော်ဒါမချိတ်ဆက်ရသေးပါ" : "No order linked")}</span>
                  <small>{signals.length ? `${isBurmese ? "စစ်ဆေးရန် အချက်များ:" : "Review signals:"} ${signals.join("; ")}` : (isBurmese ? "စလစ်အချက်အလက် ကိုက်ညီပါသည်။ ဘဏ်အကောင့်ထဲ ငွေဝင်မဝင် စစ်ဆေးပြီး အတည်ပြုပါ။" : "No mismatch signal was found in the saved fields. A trusted bank or merchant record is still required.")}</small>
                  {evidence.status === "pending_review" && (
                    <button
                      className="hosted-secondary-button"
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent("open-saya-assistant", { detail: { view: "match", evidenceId: evidence.id, shopId: evidence.shop_id || shopId, orderId: evidence.order_id ?? undefined } }))}

                    >
                      {!evidence.order_id
                        ? (isBurmese ? "အော်ဒါချိတ်ဆက်ပြီး စစ်ဆေးရန်" : "Attach order & review")
                        : (isBurmese ? "စလစ်အား ဆက်လက်စစ်ဆေးရန်" : "Continue evidence review")}
                    </button>
                  )}
                  {evidence.status === "verified" && evidence.payment_id && (
                    <small>{isBurmese ? "ချိတ်ဆက်ပြီး ငွေပေးချေမှု" : "Linked payment"} #{evidence.payment_id.slice(0, 8).toUpperCase()}</small>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="orders-card real-orders">
        <div className="table-toolbar">
          <label className="search-field">
            <Icon name="search" />
            <span className="sr-only">{labels.search}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isBurmese ? "လုပ်ငန်းစဉ်နံပါတ်၊ ဝယ်သူအမည် သို့မဟုတ် ငွေပေးချေနည်းလမ်း ရှာရန်..." : "Search reference, customer or method"}
            />
          </label>
          <label>
            <span>{labels.paymentStatus}</span>
            <select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)}>
              <option value="">{isBurmese ? "ငွေပေးချေနည်းလမ်း အားလုံး" : "All payment methods"}</option>
              <option value="KBZPay">KBZPay</option>
              <option value="WavePay">WavePay</option>
              <option value="CB Pay">CB Pay</option>
              <option value="AYA Pay">AYA Pay</option>
              <option value="Cash">{isBurmese ? "အိမ်ရောက်ငွေချေ (Cash / COD)" : "Cash / COD"}</option>
            </select>
          </label>
        </div>

        {!filtered.length ? (
          <div className="table-empty">
            <Icon name="wallet" size={30} />
            <h3>{isBurmese ? "ငွေပေးချေမှု မှတ်တမ်း မတွေ့ပါ" : "No payment records found"}</h3>
            <p>{isBurmese ? "ဆိုင်ရှင်ကိုယ်တိုင် ငွေရရှိကြောင်း အတည်ပြုပြီးပါက ဤနေရာတွင် ပေါ်လာပါမည်။" : "Payments appear here only after a seller verifies funds against a trusted record."}</p>
          </div>
        ) : (
          <div className="table-scroll order-records">
            <table className="data-table">
              <caption className="sr-only">Confirmed payments ledger.</caption>
              <thead>
                <tr>
                  <th scope="col">{isBurmese ? "လုပ်ငန်းစဉ်နံပါတ် (Ref)" : "Transaction / Ref"}</th>
                  <th scope="col">{isBurmese ? "အော်ဒါနှင့် ဝယ်သူ" : "Order & Customer"}</th>
                  <th scope="col">{isBurmese ? "နည်းလမ်း" : "Method"}</th>
                  <th scope="col">{isBurmese ? "အတည်ပြုရက်စွဲ" : "Date Verified"}</th>
                  <th scope="col" className="amount-cell">{labels.amount}</th>
                  <th scope="col">{isBurmese ? "အခြေအနေ" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const order = orderMap.get(p.order_id);
                  const custName = p.customer_name ?? order?.customers?.name ?? (isBurmese ? "ဝယ်သူ" : "Customer");
                  return (
                    <tr key={p.id}>
                      <td data-label="Transaction / Ref">
                        <strong>{p.reference_number || `TXN-${p.id.slice(0, 8).toUpperCase()}`}</strong>
                      </td>
                      <td data-label="Order & Customer">
                        <span>#{p.order_id.slice(0, 8).toUpperCase()} · {custName}</span>
                      </td>
                      <td data-label="Method">
                        <span className="status-badge status-neutral">{p.payment_method}</span>
                      </td>
                      <td data-label="Date Verified">
                        {new Intl.DateTimeFormat(isBurmese ? "my-MM" : "en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Asia/Yangon",
                        }).format(new Date(p.verified_at || p.created_at))}
                      </td>
                      <td data-label="Amount" className="amount-cell font-mono">
                        <strong className="text-success">
                          +{formatMmk(p.amount_mmk)} MMK
                        </strong>
                      </td>
                      <td data-label="Status">
                        {p.payment_method.toLowerCase().includes("sample") || p.reference_number?.startsWith("SAMPLE-") ? (
                          <span className="status-badge status-warning">
                            {isBurmese ? "နမူနာ မှတ်တမ်း" : "Simulated Sample Record"}
                          </span>
                        ) : (
                          <>
                            <span className="status-badge status-success">
                              {isBurmese ? "အတည်ပြုပြီး" : "Verified payment"}
                            </span>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
