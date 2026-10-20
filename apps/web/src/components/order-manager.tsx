"use client";

import { useEffect, useRef, useState } from "react";
import { Card, Icon } from "@ocean/ui";
import { calculateOrderTotals, fulfillmentStatusSchema, orderStatusSchema, saveOrderSchema, type OrderDetails, type SaveOrderInput } from "@ocean/contracts";
import { loadOrders, saveOrder, type OrdersResult } from "@/app/sales/actions";

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

export function OrderManager({ shopId, initial, initialQuery, initialOrderId }: { shopId: string; initial: OrdersResult; initialQuery: string; initialOrderId?: string }) {
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
    } catch { setError("Orders could not be loaded. Please retry."); }
    finally { setLoading(false); }
  };
  const rows = orders.slice(0, 500).filter(order =>
    `${order.id} ${order.customers?.name ?? ""} ${order.customers?.phone ?? ""} ${order.order_items.map(i => i.product_name).join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
    (!status || order.order_status === status) && (!payment || order.payment_status === payment) && (!fulfillment || order.fulfillment_status === fulfillment)
  ).sort((a, b) => sort === "amount" ? b.total_mmk - a.total_mmk : sort === "oldest" ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at));
  return <>
    <div className="order-list-heading"><div><h2>Orders</h2><p className="muted">Your shop’s saved orders · MMK</p></div><button className="auth-submit" disabled={!!error || loading} onClick={() => { setNotice(""); setSelected("new"); }}>+ Create order</button></div>
    <p role="status" className="order-notice">{notice}</p>
    <Card className="orders-card real-orders">
      <div className="table-toolbar">
        <label className="search-field"><Icon name="search"/><span className="sr-only">Search orders</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search order ID, customer or product"/></label>
        <label>Order status<select value={status} onChange={e => setStatus(e.target.value)}><option value="">All order statuses</option>{orderStatusSchema.options.map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label>
        <label>Payment<select value={payment} onChange={e => setPayment(e.target.value)}><option value="">All payments</option>{["unpaid", "partially_paid", "paid", "refunded"].map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label>
        <label>Fulfillment<select value={fulfillment} onChange={e => setFulfillment(e.target.value)}><option value="">All fulfillment</option>{fulfillmentStatusSchema.options.map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label>
        <label>Sort by<select value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="amount">Highest total</option></select></label>
        <button className="auth-secondary" disabled={loading} onClick={refresh}>{loading ? "Loading…" : "Reload orders"}</button>
      </div>
      {loading ? <div className="table-empty" role="status" aria-busy="true"><div className="skeleton skeleton-heading"/><p>Loading your shop’s orders…</p></div> : error ? <div className="table-empty" role="alert"><h3>Orders unavailable</h3><p>{error}</p><button className="auth-secondary" onClick={refresh}>Retry loading</button></div> : <>
        <div className="table-scroll order-records"><table className="data-table"><caption className="sr-only">Saved orders. All amounts in MMK. Dates use Myanmar time. Order, payment and fulfillment are independent statuses.</caption>
          <thead><tr><th scope="col">Order / customer</th><th scope="col" aria-sort={sort === "amount" ? "none" : sort === "oldest" ? "ascending" : "descending"}>Created · Myanmar time</th><th scope="col" className="amount-cell" aria-sort={sort === "amount" ? "descending" : "none"}>Total (MMK)</th><th scope="col">Order</th><th scope="col">Payment</th><th scope="col">Fulfillment</th></tr></thead>
          <tbody>{rows.map(order => <tr key={order.id}><td data-label="Order / customer"><button className="order-open" aria-label={`Open order ${order.id} for ${order.customers?.name ?? "unknown customer"}`} onClick={() => { setNotice(""); setSelected(order); }}><strong>#{order.id.slice(0, 8)}</strong><span>{order.customers?.name ?? "Customer unavailable"}</span><small>{order.order_items.map(i => `${i.quantity} × ${i.product_name}`).join(", ")}</small></button></td><td data-label="Created">{date(order.created_at)}</td><td data-label="Total" className="amount-cell">{money(order.total_mmk)}</td><td data-label="Order status"><span className={`status-badge ${order.order_status === "confirmed" ? "status-info" : "status-neutral"}`}>{label(order.order_status)}</span></td><td data-label="Payment"><span className={`status-badge ${order.payment_status === "unpaid" ? "status-warning" : "status-neutral"}`}>{label(order.payment_status)}</span></td><td data-label="Fulfillment"><span className="status-badge status-neutral">{label(order.fulfillment_status)}</span></td></tr>)}</tbody>
        </table></div>
        {!rows.length && <div className="table-empty"><Icon name="orders" size={30}/><h3>{orders.length ? "No matching orders" : "Your first order starts here"}</h3><p>{orders.length ? "Try another search or clear the filters." : "Add your customer and products, review the total, then save."}</p>{orders.length ? <button className="text-button" onClick={() => { setQuery(""); setStatus(""); setPayment(""); setFulfillment(""); }}>Clear filters</button> : <button className="auth-secondary" onClick={() => setSelected("new")}>Create your first order</button>}</div>}
        <p className="table-summary" role="status">Showing {rows.length} of {Math.min(orders.length, 500)} loaded orders{orders.length > 500 ? ". Only the latest 500 orders are shown; search and filters apply to these orders." : ""}</p>
      </>}
    </Card>
    {selected && <OrderDrawer key={selected === "new" ? "new" : `${selected.id}:${selected.updated_at}`} shopId={shopId} savedNotice={notice} order={selected === "new" ? null : selected} close={() => setSelected(null)} saved={order => {
      setOrders(previous => [order, ...previous.filter(o => o.id !== order.id)]);
      setSelected(order); setNotice("Order saved and read back from Supabase.");
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
          {([['product_name', 'Product name'], ['quantity', 'Quantity'], ['unit_price_mmk', 'Unit price (MMK)']] as const).map(([key, title]) => {
            const path = `items.${index}.${key}`;
            return <label key={key} className="order-field" htmlFor={`order-${path}`}>{title} *<input id={`order-${path}`} type={key === "product_name" ? "text" : "number"} min={key === "quantity" ? 1 : 0} max={key === "quantity" ? 1000000 : key === "unit_price_mmk" ? 9007199254 : undefined} step={key === "product_name" ? undefined : 1} maxLength={key === "product_name" ? 200 : undefined} required value={item[key]} aria-invalid={!!errors[path]} aria-describedby={errors[path] ? `error-${path}` : undefined} onBlur={() => validate(path)} onChange={e => { setItems(items.map((row, n) => n === index ? { ...row, [key]: e.target.value } : row)); setDirty(true); }}/>{errors[path] && <span className="order-field-error" id={`error-${path}`}>{errors[path]}</span>}</label>;
          })}
          <p className="order-line-total">Line total: {Number.isSafeInteger(number(item.quantity) * number(item.unit_price_mmk)) && number(item.quantity) > 0 && number(item.unit_price_mmk) >= 0 ? money(number(item.quantity) * number(item.unit_price_mmk)) : "Enter quantity and price"}</p>
          <button type="button" className="text-button" aria-label={`Remove product ${index + 1}`} disabled={items.length === 1} onClick={() => { setItems(items.filter((_, n) => n !== index)); setErrors({}); setDirty(true); }}>Remove</button>
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
