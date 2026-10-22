"use client";

import { useEffect, useRef, useState } from "react";
import { Card, Icon } from "@ocean/ui";
import { calculateOrderTotals, fulfillmentStatusSchema, orderStatusSchema, saveOrderSchema, type OrderDetails, type SaveOrderInput } from "@ocean/contracts";
import { loadOrders, saveOrder, type OrdersResult } from "@/app/sales/actions";
import { useShellLanguage } from "./shell-language";
import { shellLabels } from "@/lib/shell-ui";

const money = (value: number) => `${value.toLocaleString("en-US")} MMK`;
const label = (value: string) => value.replaceAll("_", " ");
const date = (value: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Yangon" }).format(new Date(value));
function fieldLabel(path: string) {
  return path.replace(/^items\.(\d+)\./, (_, index: string) => `Product ${Number(index) + 1}: `).replaceAll("_", " ");
}
function validationMessage(path: string, fallback: string) {
  if (path === "customer_name") return "Enter the customer’s name (up to 160 characters).";
  if (path.endsWith("product_name")) return "Enter a product name (up to 200 characters).";
  if (path.endsWith("quantity")) return "Enter a whole quantity from 1 to 1,000,000.";
  if (path.endsWith("unit_price_mmk")) return "Enter a whole MMK price from 0 to 9,007,199,254.";
  if (path === "delivery_fee_mmk") return "Enter a non-negative whole MMK delivery fee within the supported range.";
  if (path === "discount_mmk") return "Enter a whole MMK discount no greater than subtotal plus delivery. Check that the total stays within the supported range.";
  if (path === "customer_phone") return "Enter a phone number when a delivery address is provided (up to 40 characters).";
  if (path === "delivery_address") return "Keep the delivery address within 500 characters.";
  if (path === "notes") return "Keep notes within 4,000 characters.";
  return fallback;
}

type OrderManagerProps = { shopId: string; initial: OrdersResult; initialQuery: string; initialOrderId?: string };

export function OrderManager(props: OrderManagerProps) {
  return <OrderManagerView key={`${props.shopId}:${props.initialQuery}:${props.initialOrderId ?? ""}`} {...props} />;
}

function OrderManagerView({ shopId, initial, initialQuery, initialOrderId }: OrderManagerProps) {
  const { language } = useShellLanguage();
  const labels = shellLabels(language);
  const [orders, setOrders] = useState(initial.orders ?? []);
  const [error, setError] = useState(initial.error);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [fulfillment, setFulfillment] = useState("");
  const [sort, setSort] = useState("newest");
  const [selected, setSelected] = useState<OrderDetails | "new" | null>(() => initial.orders?.find(order => order.id === initialOrderId) ?? null);
  const [notice, setNotice] = useState("");
  const refresh = async () => {
    setLoading(true);
    try {
      const result = await loadOrders(shopId);
      setError(result.error);
      if (result.orders) setOrders(result.orders);
    } catch { setError(language === "my" ? "အော်ဒါစာရင်း ရယူ၍ မရနိုင်ပါ။ ထပ်မံကြိုးစားပါ။" : "Orders could not be loaded. Please retry."); }
    finally { setLoading(false); }
  };
  const rows = orders.slice(0, 500).filter(order =>
    `${order.id} ${order.customers?.name ?? ""} ${order.customers?.phone ?? ""} ${order.order_items.map(i => i.product_name).join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
    (!status || order.order_status === status) && (!payment || order.payment_status === payment) && (!fulfillment || order.fulfillment_status === fulfillment)
  ).sort((a, b) => sort === "amount" ? b.total_mmk - a.total_mmk : sort === "oldest" ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at));
  return <>
    <div className="order-list-heading">
      <div>
        <h2>{labels.orders}</h2>
        <p className="muted">{language === "my" ? "ဆိုင်၏ အတည်ပြုပြီးနှင့် မူကြမ်း အော်ဒါစာရင်း · MMK" : "Your shop’s saved orders · MMK"}</p>
      </div>
      <button className="auth-submit" disabled={!!error || loading} onClick={() => { setNotice(""); setSelected("new"); }}>
        {labels.createOrder}
      </button>
    </div>
    <p role="status" className="order-notice">{notice}</p>
    <Card className="orders-card real-orders">
      <div className="table-toolbar">
        <label className="search-field">
          <Icon name="search"/>
          <span className="sr-only">{labels.searchOrders}</span>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={labels.searchOrders}/>
        </label>
        <label>
          <span>{labels.orderId}</span>
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">{labels.allOrderStatuses}</option>
            {orderStatusSchema.options.map(s => (
              <option key={s} value={s}>
                {language === "my" && s === "confirmed" ? "အတည်ပြုပြီး" : language === "my" && s === "draft" ? "မူကြမ်း" : label(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{labels.paymentStatus}</span>
          <select value={payment} onChange={e => setPayment(e.target.value)}>
            <option value="">{labels.allPayments}</option>
            {["unpaid", "partially_paid", "paid", "refunded"].map(s => (
              <option key={s} value={s}>
                {language === "my" && s === "paid" ? "ပေးချေပြီး" : language === "my" && s === "unpaid" ? "မပေးချေရသေး" : language === "my" && s === "partially_paid" ? "တစ်စိတ်တစ်ပိုင်း" : label(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{labels.fulfillmentStatus}</span>
          <select value={fulfillment} onChange={e => setFulfillment(e.target.value)}>
            <option value="">{labels.allFulfillment}</option>
            {fulfillmentStatusSchema.options.map(s => (
              <option key={s} value={s}>
                {language === "my" && s === "delivered" ? "ပို့ဆောင်ပြီး" : language === "my" && s === "shipped" ? "ပို့ဆောင်ဆဲ" : language === "my" && s === "processing" ? "စီစဉ်ဆဲ" : label(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{language === "my" ? "စီစဉ်ရန်" : "Sort by"}</span>
          <select value={sort} onChange={e => setSort(e.target.value)}>
            <option value="newest">{labels.newestFirst}</option>
            <option value="oldest">{labels.oldestFirst}</option>
            <option value="amount">{language === "my" ? "တန်ဖိုး အများဆုံး" : "Highest total"}</option>
          </select>
        </label>
        <button className="auth-secondary" disabled={loading} onClick={refresh}>
          {loading ? (language === "my" ? "ရယူနေသည်..." : "Loading…") : labels.reloadOrders}
        </button>
      </div>
      {loading ? (
        <div className="table-loading" role="status" aria-live="polite" aria-busy="true">
          <span className="sync-spinner" aria-hidden="true" />
          {language === "my" ? "ဆိုင်၏ အော်ဒါမှတ်တမ်းများကို ရယူနေပါသည်..." : "Loading your shop’s orders…"}
        </div>
      ) : error ? (
        <div className="table-empty" role="alert">
          <h3>{language === "my" ? "အော်ဒါများ ဖွင့်မရပါ" : "Orders unavailable"}</h3>
          <p>{error}</p>
          <button className="auth-secondary" onClick={refresh}>{labels.retry}</button>
        </div>
      ) : (
        <>
          <div className="table-scroll order-records">
            <table className="data-table">
              <caption className="sr-only">Saved orders. All amounts in MMK. Dates use Myanmar time. Order, payment and fulfillment are independent statuses.</caption>
              <thead>
                <tr>
                  <th scope="col">{labels.orderId}</th>
                  <th scope="col">{labels.customer}</th>
                  <th scope="col" aria-sort={sort === "amount" ? "none" : sort === "oldest" ? "ascending" : "descending"}>{labels.date}</th>
                  <th scope="col" className="amount-cell" aria-sort={sort === "amount" ? "descending" : "none"}>{labels.amount}</th>
                  <th scope="col">{labels.paymentStatus}</th>
                  <th scope="col">{labels.fulfillmentStatus}</th>
                  <th scope="col" className="amount-cell">{labels.action}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(order => {
                  const orderNum = order.id.startsWith("40000000-0000-4000-8000-00000000")
                    ? `SS-${order.id.slice(-4)}`
                    : order.id.slice(0, 8).toUpperCase();

                  const isPaid = order.payment_status === "paid";
                  const isDelivered = order.fulfillment_status === "delivered";
                  const isShipped = order.fulfillment_status === "shipped";
                  const isProcessing = order.fulfillment_status === "processing";

                  return (
                    <tr key={order.id}>
                      <td data-label={labels.orderId}>
                        <button className="order-open" aria-label={`Open order ${order.id}`} onClick={() => { setNotice(""); setSelected(order); }}>
                          <strong>#{orderNum}</strong>
                        </button>
                      </td>
                      <td data-label={labels.customer}>
                        <div className="customer-info-cell">
                          <span>{order.customers?.name ?? (language === "my" ? "ဝယ်သူအမည် မရှိပါ" : "Customer unavailable")}</span>
                          {order.customers?.phone && <small className="cell-phone">{order.customers.phone}</small>}
                          <small className="cell-products">{order.order_items.map(i => `${i.quantity}× ${i.product_name}`).join(", ")}</small>
                        </div>
                      </td>
                      <td data-label={labels.date}>{date(order.created_at)}</td>
                      <td data-label={labels.amount} className="amount-cell font-mono">
                        <strong>{money(order.total_mmk)}</strong>
                      </td>
                      <td data-label={labels.paymentStatus}>
                        <span className={`status-badge ${isPaid ? "status-success" : "status-warning"}`}>
                          {language === "my" && isPaid ? "ပေးချေပြီး" : language === "my" && order.payment_status === "unpaid" ? "မပေးချေရသေး" : label(order.payment_status)}
                        </span>
                      </td>
                      <td data-label={labels.fulfillmentStatus}>
                        <span className={`status-badge ${isDelivered ? "status-success" : isShipped ? "status-info" : isProcessing ? "status-neutral" : "status-warning"}`}>
                          {language === "my" && isDelivered ? "ပို့ဆောင်ပြီး" : language === "my" && isShipped ? "ပို့ဆောင်ဆဲ" : language === "my" && isProcessing ? "ပြင်ဆင်ဆဲ" : label(order.fulfillment_status)}
                        </span>
                      </td>
                      <td data-label={labels.action} className="amount-cell">
                        <button className="table-action-btn" onClick={() => { setNotice(""); setSelected(order); }} aria-label={`View or edit order ${order.id}`}>
                          {labels.viewEdit} →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <div className="table-empty">
              <Icon name="orders" size={30}/>
              <h3>{orders.length ? (language === "my" ? "ကိုက်ညီသော အော်ဒါမရှိပါ" : "No matching orders") : (language === "my" ? "ပထမဆုံး အော်ဒါဖွင့်ပါ" : "Your first order starts here")}</h3>
              <p>{orders.length ? (language === "my" ? "အခြားအမည် ရှာကြည့်ပါ သို့မဟုတ် စစ်ထုတ်မှုများကို ပယ်ဖျက်ပါ။" : "Try another search or clear the filters.") : (language === "my" ? "ဝယ်သူနှင့် ကုန်ပစ္စည်းများထည့်ပြီး သိမ်းဆည်းပါ။" : "Add your customer and products, review the total, then save.")}</p>
              {orders.length ? (
                <button className="text-button" onClick={() => { setQuery(""); setStatus(""); setPayment(""); setFulfillment(""); }}>
                  {language === "my" ? "စစ်ထုတ်မှုများ ပယ်ဖျက်ရန်" : "Clear filters"}
                </button>
              ) : (
                <button className="auth-secondary" onClick={() => setSelected("new")}>
                  {labels.createOrder}
                </button>
              )}
            </div>
          )}
          <p className="table-summary" role="status">
            {language === "my" ? `အော်ဒါ ${Math.min(orders.length, 500)} ခုအနက် ${rows.length} ခု ပြသနေပါသည်` : `Showing ${rows.length} of ${Math.min(orders.length, 500)} loaded orders`}
          </p>
        </>
      )}
    </Card>
    {selected && <OrderDrawer key={selected === "new" ? "new" : `${selected.id}:${selected.updated_at}`} shopId={shopId} savedNotice={notice} order={selected === "new" ? null : selected} close={() => setSelected(null)} saved={order => {
      setOrders(previous => [order, ...previous.filter(o => o.id !== order.id)]);
      setSelected(order); setNotice(language === "my" ? "အော်ဒါ သိမ်းဆည်းပြီးပါပြီ။" : "Order saved successfully.");
    }}/ >}
  </>;
}

export function OrderDrawer({ shopId, order, savedNotice, close, saved, readOnly = false }: { shopId: string; order: OrderDetails | null; savedNotice: string; close: () => void; saved: (order: OrderDetails) => void; readOnly?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(!order);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form] = useState(() => ({
    id: order?.id ?? crypto.randomUUID(), shop_id: shopId,
    expected_updated_at: order?.updated_at ?? null,
  }));
  const [fields, setFields] = useState({
    customer_name: order?.customers?.name ?? "", customer_phone: order?.customers?.phone ?? "",
    delivery_address: order?.delivery_address ?? "", notes: order?.notes ?? "",
    order_status: order?.order_status ?? "draft", fulfillment_status: order?.fulfillment_status ?? "unfulfilled",
    delivery_fee_mmk: String(order?.delivery_fee_mmk ?? 0), discount_mmk: String(order?.discount_mmk ?? 0),
  });
  const [items, setItems] = useState(() => order?.order_items.map(i => ({ key: i.id, product_name: i.product_name, quantity: String(i.quantity), unit_price_mmk: String(i.unit_price_mmk) })) ?? [{ key: crypto.randomUUID(), product_name: "", quantity: "1", unit_price_mmk: "" }]);
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = overflow; trigger?.focus(); };
  }, []);
  useEffect(() => { if (error) summary.current?.focus(); }, [error]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const number = (value: string) => value.trim() === "" ? NaN : Number(value);
  const input = () => ({ ...form, ...fields,
    customer_phone: fields.customer_phone.trim() || null, delivery_address: fields.delivery_address.trim() || null, notes: fields.notes.trim() || null,
    delivery_fee_mmk: number(fields.delivery_fee_mmk), discount_mmk: number(fields.discount_mmk),
    items: items.map(i => ({ product_name: i.product_name, quantity: number(i.quantity), unit_price_mmk: number(i.unit_price_mmk) })),
  });
  const validate = (only?: string) => {
    const result = saveOrderSchema.safeParse(input());
    const next: Record<string, string> = {};
    if (!result.success) for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (!only || path === only) next[path] = validationMessage(path, issue.message);
    }
    if (only) setErrors(previous => { const copy = { ...previous }; delete copy[only]; return { ...copy, ...next }; });
    else setErrors(next);
    return result;
  };
  let totals: { subtotal_mmk: number; total_mmk: number } | null = null;
  try {
    const parsed = saveOrderSchema.safeParse(input());
    if (parsed.success) totals = calculateOrderTotals(parsed.data.items, parsed.data.delivery_fee_mmk, parsed.data.discount_mmk);
  } catch { /* Incomplete forms display no invented total. */ }
  const requestClose = () => { if (pending) return; if (dirty) setDiscard(true); else close(); };
  const field = (key: keyof typeof fields, title: string, options?: { multiline?: boolean; numeric?: boolean; required?: boolean; max?: number; tel?: boolean }) => <label className="order-field" htmlFor={`order-${key}`}>{title}{options?.required ? " *" : ""}
    {options?.multiline ? <textarea id={`order-${key}`} value={fields[key]} maxLength={options.max} rows={3} onChange={e => { setFields({ ...fields, [key]: e.target.value }); setDirty(true); }} onBlur={() => validate(key)} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `error-${key}` : undefined}/> : <input id={`order-${key}`} type={options?.numeric ? "number" : options?.tel ? "tel" : "text"} min={options?.numeric ? 0 : undefined} step={options?.numeric ? 1 : undefined} required={options?.required} maxLength={options?.max} value={fields[key]} onChange={e => { setFields({ ...fields, [key]: e.target.value }); setDirty(true); }} onBlur={() => validate(key)} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `error-${key}` : undefined}/>}
    {errors[key] && <span className="order-field-error" id={`error-${key}`}>{errors[key]}</span>}
  </label>;
  const submit = async (data: SaveOrderInput) => {
    setPending(true); setError("");
    try {
      const result = await saveOrder(data);
      if (result.order) { setDirty(false); saved(result.order); }
      else setError(result.error ?? "Save failed. Please retry.");
    } catch { setError("Connection interrupted. Reload orders before retrying; the save may already have completed."); }
    finally { setPending(false); }
  };
  return <dialog ref={dialog} className="order-drawer" aria-labelledby="drawer-title" onCancel={e => { e.preventDefault(); requestClose(); }}>
    <div className="drawer-header"><div><p className="eyebrow">{order ? `ORDER #${order.id.slice(0, 8)}` : "NEW ORDER"}</p><h2 id="drawer-title">{order ? editing ? "Edit order" : "Order details" : "Create order"}</h2></div><button className="auth-secondary" type="button" onClick={requestClose} disabled={pending} aria-label="Close order details">Close</button></div>
    {discard && <div className="order-discard" role="alert"><p>Discard your unsaved changes?</p><button className="auth-secondary" onClick={close}>Discard changes</button><button className="auth-secondary" onClick={() => setDiscard(false)}>Keep editing</button></div>}
    {!editing && order ? <div className="drawer-content order-detail-view">
      {savedNotice && <p className="order-notice" role="status">{savedNotice}</p>}
      <div className="order-detail-status"><span className="status-badge status-info">Order: {label(order.order_status)}</span><span className="status-badge status-warning">Payment: {label(order.payment_status)}</span><span className="status-badge status-neutral">Fulfillment: {label(order.fulfillment_status)}</span></div>
      <h3>Customer</h3><p>{order.customers?.name ?? "Not provided"}</p><p>{order.customers?.phone ?? "Phone not provided"}</p><p>{order.delivery_address ?? "Delivery address not provided"}</p>
      <h3>Products</h3>{order.order_items.map(item => <div className="order-detail-line" key={item.id}><div><strong>{item.product_name}</strong><p>{item.quantity} × {money(item.unit_price_mmk)}</p></div><strong>{money(item.line_total_mmk)}</strong></div>)}
      <dl className="order-totals"><div><dt>Subtotal</dt><dd>{money(order.subtotal_mmk)}</dd></div><div><dt>Delivery</dt><dd>{money(order.delivery_fee_mmk)}</dd></div><div><dt>Discount</dt><dd>−{money(order.discount_mmk)}</dd></div><div><dt>Total</dt><dd>{money(order.total_mmk)}</dd></div></dl>
      <h3>Notes</h3><p>{order.notes ?? "No notes"}</p><p className="muted">Last saved {date(order.updated_at)} · Myanmar time</p>
      <p className="settings-note">Payment verification is a separate workflow. Saving an order never marks it paid.</p>
      {!readOnly && <><button className="auth-submit" disabled={order.payment_status !== "unpaid"} onClick={() => setEditing(true)}>Edit order</button>{order.payment_status !== "unpaid" && <p>Orders with payment records need payment adjustment review before editing.</p>}</>}
    </div> : <form noValidate onSubmit={e => { e.preventDefault(); const result = validate(); if (result.success) void submit(result.data); else requestAnimationFrame(() => summary.current?.focus()); }}>
      <div className="drawer-content">
        {(error || Object.keys(errors).length > 0) && <div ref={summary} tabIndex={-1} role="alert" className="order-error-summary"><h3>Check your order</h3>{error && <p>{error}</p>}<ul>{Object.entries(errors).map(([path, message]) => <li key={path}><a href={`#order-${path}`}>{fieldLabel(path)}: {message}</a></li>)}</ul></div>}
        <fieldset disabled={pending}><legend>Customer</legend><div className="order-field-grid">{field("customer_name", "Customer name", { required: true, max: 160 })}{field("customer_phone", "Phone", { tel: true, max: 40, required: !!fields.delivery_address.trim() })}</div>{field("delivery_address", "Delivery address", { multiline: true, max: 500 })}</fieldset>
        <fieldset disabled={pending}><legend>Products · whole MMK amounts</legend>{items.map((item, index) => <div className="order-item-editor" key={item.key}>
          <div className="order-item-grid">
            <label className="order-field" htmlFor={`order-items.${index}.product_name`}>Product name *
              <input id={`order-items.${index}.product_name`} type="text" maxLength={200} required value={item.product_name} aria-invalid={!!errors[`items.${index}.product_name`]} aria-describedby={errors[`items.${index}.product_name`] ? `error-items.${index}.product_name` : undefined} onBlur={() => validate(`items.${index}.product_name`)} onChange={e => { setItems(items.map((row, n) => n === index ? { ...row, product_name: e.target.value } : row)); setDirty(true); }}/>
              {errors[`items.${index}.product_name`] && <span className="order-field-error" id={`error-items.${index}.product_name`}>{errors[`items.${index}.product_name`]}</span>}
            </label>
            <div className="order-field">
              <label htmlFor={`order-items.${index}.quantity`}>Quantity *</label>
              <div className="stepper-wrap">
                <button type="button" className="stepper-btn" disabled={Number(item.quantity) <= 1} aria-label={`Decrease quantity for item ${index + 1}`} onClick={() => {
                  const val = Math.max(1, (Number(item.quantity) || 1) - 1);
                  setItems(items.map((row, n) => n === index ? { ...row, quantity: String(val) } : row));
                  setDirty(true);
                }}>−</button>
                <input id={`order-items.${index}.quantity`} type="number" min={1} max={1000000} step={1} required className="stepper-input" value={item.quantity} aria-invalid={!!errors[`items.${index}.quantity`]} aria-describedby={errors[`items.${index}.quantity`] ? `error-items.${index}.quantity` : undefined} onBlur={() => validate(`items.${index}.quantity`)} onChange={e => {
                  setItems(items.map((row, n) => n === index ? { ...row, quantity: e.target.value } : row));
                  setDirty(true);
                }}/>
                <button type="button" className="stepper-btn" aria-label={`Increase quantity for item ${index + 1}`} onClick={() => {
                  const val = (Number(item.quantity) || 0) + 1;
                  setItems(items.map((row, n) => n === index ? { ...row, quantity: String(val) } : row));
                  setDirty(true);
                }}>+</button>
              </div>
              {errors[`items.${index}.quantity`] && <span className="order-field-error" id={`error-items.${index}.quantity`}>{errors[`items.${index}.quantity`]}</span>}
            </div>
            <label className="order-field" htmlFor={`order-items.${index}.unit_price_mmk`}>Unit price (MMK) *
              <input id={`order-items.${index}.unit_price_mmk`} type="number" min={0} max={9007199254} step={1} required value={item.unit_price_mmk} aria-invalid={!!errors[`items.${index}.unit_price_mmk`]} aria-describedby={errors[`items.${index}.unit_price_mmk`] ? `error-items.${index}.unit_price_mmk` : undefined} onBlur={() => validate(`items.${index}.unit_price_mmk`)} onChange={e => { setItems(items.map((row, n) => n === index ? { ...row, unit_price_mmk: e.target.value } : row)); setDirty(true); }}/>
              {errors[`items.${index}.unit_price_mmk`] && <span className="order-field-error" id={`error-items.${index}.unit_price_mmk`}>{errors[`items.${index}.unit_price_mmk`]}</span>}
            </label>
          </div>
          <div className="order-item-footer">
            <span className="order-line-total">Line total: {Number.isSafeInteger(number(item.quantity) * number(item.unit_price_mmk)) && number(item.quantity) > 0 && number(item.unit_price_mmk) >= 0 ? money(number(item.quantity) * number(item.unit_price_mmk)) : "Enter quantity and price"}</span>
            <button type="button" className="text-button remove-item-btn" aria-label={`Remove product ${index + 1}`} disabled={items.length === 1} onClick={() => { setItems(items.filter((_, n) => n !== index)); setErrors({}); setDirty(true); }}>Remove</button>
          </div>
        </div>)}<button type="button" className="auth-secondary" disabled={items.length >= 100} onClick={() => { setItems([...items, { key: crypto.randomUUID(), product_name: "", quantity: "1", unit_price_mmk: "" }]); setDirty(true); }}>+ Add product</button></fieldset>
        <fieldset disabled={pending}><legend>Totals & details</legend><div className="order-field-grid">{field("delivery_fee_mmk", "Delivery fee (MMK)", { numeric: true, required: true })}{field("discount_mmk", "Discount (MMK)", { numeric: true, required: true })}
          {([['order_status', 'Order status', orderStatusSchema.options], ['fulfillment_status', 'Fulfillment status', fulfillmentStatusSchema.options]] as const).map(([key, title, options]) => <label key={key} className="order-field" htmlFor={`order-${key}`}>{title}<select id={`order-${key}`} value={fields[key]} onChange={e => { setFields({ ...fields, [key]: e.target.value }); setDirty(true); }}>{options.map(option => <option key={option} value={option}>{label(option)}</option>)}</select></label>)}
        </div>{field("notes", "Notes", { multiline: true, max: 4000 })}
        <dl className="order-totals"><div><dt>Subtotal</dt><dd>{totals ? money(totals.subtotal_mmk) : "—"}</dd></div><div><dt>Total</dt><dd>{totals ? money(totals.total_mmk) : "Complete valid fields"}</dd></div></dl>
        <p className="settings-note">Payment: {label(order?.payment_status ?? "unpaid")}. Order approval and fulfillment do not verify payment.</p></fieldset>
      </div><div className="drawer-footer"><button type="button" className="auth-secondary" disabled={pending} onClick={requestClose}>Cancel</button><button className="auth-submit" type="submit" disabled={pending}>{pending ? "Saving…" : order ? "Save changes" : "Reviewed · Save order"}</button></div>
    </form>}
  </dialog>;
}
