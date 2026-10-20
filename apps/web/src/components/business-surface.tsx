"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, Icon } from "@ocean/ui";
import { expenseBreakdown, financialTrend, myanmarDate, shiftDate, summarizeFinancials, totalExpenseAmount, validRange, type DateRange, type Expense, type ExpenseInput, type OrderDetails } from "@ocean/contracts";
import { Metrics } from "./metrics";
import { OrderDrawer } from "./order-manager";
import { ExpenseForm } from "./expense-form";
import { createSampleProvider, resetSampleExpenses } from "@/lib/business/sample-provider";
import { createLiveProvider } from "@/lib/business/live-provider";
import { getDashboardAttention, type DashboardAttentionItem } from "@/lib/business/attention";
import { formatMmk, type BusinessProvider, type BusinessSnapshot } from "@/lib/business/types";

const TrendChart = dynamic(() => import("./business-charts").then(module => module.TrendChart), { loading: () => <div className="business-chart skeleton" role="status" aria-label="Loading chart"/> });
const ExpenseBreakdownChart = dynamic(() => import("./business-charts").then(module => module.ExpenseBreakdownChart), { loading: () => <div className="business-chart skeleton" role="status" aria-label="Loading expense chart"/> });
const mmk = (amount: number | null) => amount === null ? "Unavailable" : `${formatMmk(amount)} MMK`;
function monthRange(month: string): DateRange {
  const [year, number] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year ?? 0, number ?? 1, 0)).toISOString().slice(0, 10);
  return { from: `${month}-01`, to: last };
}
export function BusinessSurface({ source, shopId, today, finance = false, tab = "reports" }: { source: "sample" | "live"; shopId?: string; today: string; finance?: boolean; tab?: "expenses" | "reports" }) {
  const provider = useMemo(() => source === "sample" ? createSampleProvider(today) : createLiveProvider(shopId), [source, shopId, today]);
  const [result, setResult] = useState<{ data?: BusinessSnapshot; error?: string }>({});
  const [generation, setGeneration] = useState(0);
  const [reset, setReset] = useState(false);
  useEffect(() => {
    let active = true;
    provider.load().then(data => { if (active) setResult({ data }); }).catch(error => { if (active) setResult({ error: error instanceof Error ? error.message : "Workspace unavailable. Retry loading." }); });
    return () => { active = false; };
  }, [provider, generation]);
  const reload = () => { setResult({}); setGeneration(value => value + 1); };
  const query = `source=${source}${shopId ? `&shop=${encodeURIComponent(shopId)}` : ""}`;
  const liveTarget = `${finance ? "/finance" : "/"}?source=live${shopId ? `&shop=${encodeURIComponent(shopId)}` : ""}${finance ? `&tab=${tab}` : ""}`;
  const workspaceLink = `/workspace?${new URLSearchParams({ next: liveTarget })}`;
  return <div className="page-stack business-surface">
    <div className="business-mode"><div><span className={`badge ${source === "sample" ? "status-info" : "status-success"}`}>{source === "sample" ? "Sample workspace" : "Live shop records"}</span><p>{source === "sample" ? "Synthetic records · expense changes stay in this browser tab" : "Authenticated shop data · unavailable metrics stay marked"}</p></div>
      <div className="business-actions"><Link href={source === "sample" ? workspaceLink : `${finance ? "/finance" : "/"}?source=sample`}>{source === "sample" ? "Use my live shop" : "Explore sample data"}</Link><Link href={finance ? `/?${query}` : `/finance?${query}`}>{finance ? "Dashboard" : "Finance"}</Link><button className="auth-secondary" onClick={reload}>Reload</button>{source === "sample" && <button className="auth-secondary" onClick={() => setReset(true)}>Reset sample expenses</button>}</div>
    </div>
    {reset && <div className="workspace-message" role="alert"><p>Reset all expense changes in this sample tab? Live records are unaffected.</p><div className="business-actions"><button className="auth-secondary" onClick={() => { try { resetSampleExpenses(); setReset(false); reload(); } catch { setResult({ error: "Browser storage is unavailable. Enable session storage and reload." }); } }}>Reset sample changes</button><button className="auth-secondary" onClick={() => setReset(false)}>Keep changes</button></div></div>}
    {finance && <nav className="section-nav" aria-label="Finance sections"><Link href={`/finance?tab=expenses&${query}`} className={tab === "expenses" ? "active" : ""} aria-current={tab === "expenses" ? "page" : undefined}>Expenses</Link><Link href={`/finance?tab=reports&${query}`} className={tab === "reports" ? "active" : ""} aria-current={tab === "reports" ? "page" : undefined}>Reports</Link></nav>}
    {result.error ? <Card><div className="table-empty" role="alert"><h2>Workspace unavailable</h2><p>{result.error}</p><div className="business-actions"><button className="auth-secondary" onClick={reload}>Retry loading</button><Link href={workspaceLink}>Open My shop / sign in</Link></div><p>No sample records are substituted for a failed live request.</p></div></Card> : !result.data ? <div role="status" aria-busy="true" className="page-stack"><p>Loading {source === "sample" ? "sample" : "your shop’s"} records…</p><div className="metrics-grid">{[0, 1, 2, 3].map(index => <div className="card skeleton skeleton-metric" key={index}/>)}</div><div className="card skeleton skeleton-content"/></div> : <BusinessContent key={`${source}:${result.data.shopId}:${finance}:${tab}`} data={result.data} update={data => setResult({ data })} provider={provider} finance={finance} tab={tab}/>}
  </div>;
}
function RangeFilter({ range, setRange, today }: { range: DateRange; setRange: (value: DateRange) => void; today: string }) {
  return <div className="business-filters" role="group" aria-label="Report date range">
    <div className="range-presets">{[["Today", today], ["7 days", shiftDate(today, -6)], ["30 days", shiftDate(today, -29)], ["This month", `${today.slice(0, 7)}-01`]].map(([title, from]) => <button key={title} className="auth-secondary" aria-pressed={range.from === from && range.to === today} onClick={() => setRange({ from: from!, to: today })}>{title}</button>)}</div>
    <label>From<input type="date" value={range.from} onChange={event => setRange({ ...range, from: event.target.value })}/></label><label>To<input type="date" value={range.to} onChange={event => setRange({ ...range, to: event.target.value })}/></label>
    <p>Dates use Myanmar time.</p>
  </div>;
}
function BusinessContent({ data, update, provider, finance, tab }: { data: BusinessSnapshot; update: (data: BusinessSnapshot) => void; provider: BusinessProvider; finance: boolean; tab: "expenses" | "reports" }) {
  const [range, setRange] = useState<DateRange>(() => ({ from: finance ? `${data.today.slice(0, 7)}-01` : shiftDate(data.today, -6), to: data.today }));
  const [month, setMonth] = useState(data.today.slice(0, 7));
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [notice, setNotice] = useState("");
  const valid = validRange(range);
  let problem = "";
  let calculated: { summary: ReturnType<typeof summarizeFinancials>; daily: ReturnType<typeof summarizeFinancials>; monthly: ReturnType<typeof summarizeFinancials>; trend: ReturnType<typeof financialTrend>; breakdown: ReturnType<typeof expenseBreakdown> } | null = null;
  if (valid) {
    try { calculated = { summary: summarizeFinancials(data, range), daily: summarizeFinancials(data, { from: data.today, to: data.today }), monthly: summarizeFinancials(data, monthRange(month)), trend: financialTrend(data, range), breakdown: expenseBreakdown(data.expenses, range) }; }
    catch { problem = "These totals cannot be calculated safely. Check date selection and the source records before relying on this report."; }
  }
  const save = async (input: ExpenseInput, id?: string) => {
    const expense = await provider.saveExpense(input, id);
    update({ ...data, expenses: [expense, ...data.expenses.filter(row => row.id !== expense.id)] });
    setNotice(data.source === "sample" ? "Sample expense saved in this tab only. Supabase was not used." : "Expense saved and read back from your shop database.");
  };
  const expenses = data.expenses.filter(expense => expense.expense_date >= range.from && expense.expense_date <= range.to && (!category || expense.category === category)).sort((a, b) => b.expense_date.localeCompare(a.expense_date));
  const orders = data.orders.filter(row => { const date = myanmarDate(row.created_at); return date >= range.from && date <= range.to; }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const categories = Array.from(new Set(data.expenses.map(expense => expense.category))).sort();
  const attention = getDashboardAttention(data, orders);
  return <>
    <div className="business-heading"><div><h2>{finance ? "Business performance" : "Your business at a glance"}</h2><p className="muted">{data.shopName} · {data.source === "sample" ? "Sample" : "Live"} · Today {data.today}</p></div>{finance && <button className="auth-submit" onClick={() => { setEditing("new"); setNotice(""); }}>+ Add {data.source === "sample" ? "sample " : ""}expense</button>}</div>
    <RangeFilter range={range} setRange={setRange} today={data.today}/>
    {notice && <p className="business-success" role="status">{notice}</p>}
    {data.limitations.map(text => <p className="business-note" key={text}>{text}</p>)}
    {!valid ? <div className="workspace-message" role="alert">Choose valid start and end dates, in order, covering at most 367 days.</div> : problem || !calculated ? <div className="workspace-message" role="alert">{problem}</div> : <>
      <p className="period-caption" role="status">Selected period: {range.from} – {range.to}. {finance ? "Charts and detailed reports follow these dates; the monthly summary has its own selector." : "Today’s Sales always shows today; other KPIs follow the selected period."}</p>
      <Metrics items={finance ? [
        { label: "Recorded sales", value: formatMmk(calculated.summary.recordedSales), note: "Confirmed orders · before refunds", icon: "arrow" },
        { label: "Confirmed payments", value: formatMmk(calculated.summary.confirmedPayments), note: "Explicit confirmed receipts in period", icon: "wallet", currency: calculated.summary.confirmedPayments !== null },
        { label: "Operating expenses", value: formatMmk(calculated.summary.operatingExpenses), note: "Excludes inventory purchases", icon: "finance" },
        { label: "Estimated profit", value: formatMmk(calculated.summary.estimatedProfit), note: calculated.summary.estimatedProfit === null ? "Product costs or refund adjustments unavailable" : "Sales − order costs − operating expenses", icon: "orders", currency: calculated.summary.estimatedProfit !== null },
      ] : [
        { label: "Today’s Sales", value: formatMmk(calculated.daily.recordedSales), note: "Confirmed today · before refunds", icon: "arrow" },
        { label: "Payments Received", value: formatMmk(calculated.summary.confirmedPayments), note: "Confirmed receipts · selected period", icon: "wallet", currency: calculated.summary.confirmedPayments !== null },
        { label: "Estimated Profit", value: formatMmk(calculated.summary.estimatedProfit), note: calculated.summary.estimatedProfit === null ? "Cannot estimate without known costs / refunds" : "After known costs · selected period", icon: "finance", currency: calculated.summary.estimatedProfit !== null },
        { label: "Total Orders", value: String(calculated.summary.totalOrders), note: "All statuses · selected period", icon: "orders", currency: false },
      ]}/>
      <div className="insights-grid"><Card><div className="card-heading"><div><h2>{finance ? "Sales, Receipts & Profit" : "Sales Overview"}</h2><p className="muted">{range.from} – {range.to}</p></div></div><TrendChart rows={calculated.trend} finance={finance}/></Card>{finance ? <Card><div className="card-heading"><h2>Expense Breakdown</h2></div><ExpenseBreakdownChart rows={calculated.breakdown}/></Card> : <DashboardAttention data={data} items={attention} openOrder={(id) => setOrder(orders.find(order => order.id === id) ?? null)}/>}</div>
      {finance ? <>
        <Card><div className="card-heading"><h2>Monthly Financial Summary</h2><label className="month-picker">Month<input type="month" value={month} min="2000-01" max="9999-12" onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value)) setMonth(event.target.value); }}/></label></div><dl className="monthly-summary financial-summary"><div><dt>Recorded sales</dt><dd>{mmk(calculated.monthly.recordedSales)}</dd></div><div><dt>Confirmed receipts</dt><dd>{mmk(calculated.monthly.confirmedPayments)}</dd></div><div><dt>Order product costs</dt><dd>{mmk(calculated.monthly.productCosts)}</dd></div><div><dt>Operating expenses</dt><dd>{mmk(calculated.monthly.operatingExpenses)}</dd></div><div><dt>Inventory purchases (spending)</dt><dd>{mmk(calculated.monthly.productPurchases)}</dd></div><div><dt>Estimated profit</dt><dd>{mmk(calculated.monthly.estimatedProfit)}</dd></div></dl><p className="business-note">This calendar-month summary uses its own month selector, independent of the report dates above.</p></Card>
        {tab === "expenses" ? <Card><div className="card-heading"><div><h2>Expense Ledger</h2><p className="muted">Click an expense to edit its details.</p></div><label className="category-picker">Category<select value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label></div>
          {!expenses.length ? <div className="table-empty"><h3>No expenses match these filters</h3><p>Choose another period or add an expense.</p><button className="auth-secondary" onClick={() => setEditing("new")}>Add expense</button></div> : <div className="table-scroll" tabIndex={0} role="region" aria-label="Expense ledger"><table className="data-table business-table"><caption className="sr-only">Expense amounts in MMK; choose an expense description to edit.</caption><thead><tr><th scope="col">Expense</th><th scope="col">Category</th><th scope="col">Date</th><th scope="col" className="amount-cell">Amount (MMK)</th></tr></thead><tbody>{expenses.map(expense => <tr key={expense.id}><td><button className="order-open" onClick={() => setEditing(expense)}>{expense.description}</button></td><td>{expense.category}</td><td>{expense.expense_date}</td><td className="amount-cell">{formatMmk(expense.amount_mmk)}</td></tr>)}</tbody></table></div>}
          <p className="table-summary">{expenses.length} expenses · {mmk(totalExpenseAmount(expenses))} spending in this filtered view</p>
        </Card> : <ReportTable data={data} range={range} orders={orders} expenses={expenses}/>}
       </> : <Card><div className="card-heading"><h2>Recent Orders</h2><Link className="text-link" href={data.source === "live" ? `/sales?shop=${data.shopId}` : "/sales"}>{data.source === "live" ? "All shop orders →" : "Use live order management →"}</Link></div>
        {!orders.length ? <div className="table-empty"><h3>No orders in this period</h3><p>Choose another period to explore your records.</p></div> : <div className="table-scroll" tabIndex={0} role="region" aria-label="Recent orders"><table className="data-table business-table"><caption className="sr-only">Recent orders. Payment and fulfillment statuses remain separate.</caption><thead><tr><th scope="col">Order / customer</th><th scope="col">Date</th><th scope="col">Order</th><th scope="col">Payment</th><th scope="col">Fulfillment</th><th scope="col" className="amount-cell">Total (MMK)</th></tr></thead><tbody>{orders.slice(0, 8).map(row => <tr key={row.id}><td>{data.source === "live" ? <Link className="order-open" href={`/sales?shop=${data.shopId}&order=${row.id}`}>#{row.id.slice(-6)} · {row.customers?.name ?? "Customer unavailable"}</Link> : <button className="order-open" onClick={() => setOrder(row)}>#{row.id.slice(-6)} · {row.customers?.name}</button>}</td><td>{myanmarDate(row.created_at)}</td><td><span className="status-badge status-info">{row.order_status}</span></td><td><span className="status-badge status-neutral">{row.payment_status.replaceAll("_", " ")}</span></td><td>{row.fulfillment_status}</td><td className="amount-cell">{formatMmk(row.total_mmk)}</td></tr>)}</tbody></table></div>}
      </Card>}
      <details className="calculation-notes"><summary>How these financial totals are calculated</summary><p>Recorded sales include confirmed order totals after discounts, including charged delivery fees. Draft and cancelled orders are excluded. They are before refund adjustments. Confirmed receipts use the payment ledger’s receipt dates; unpaid orders and pending records do not count as money received. Profit deducts known costs for those confirmed orders and operating expenses dated in the period. Inventory purchases are separate spending, not deducted a second time. Unknown product costs or refunded orders make profit unavailable. Profit is not cash received.</p></details>
    </>}
    {editing && <ExpenseForm expense={editing === "new" ? null : editing} today={data.today} source={data.source} save={save} close={() => setEditing(null)}/>}
    {order && <OrderDrawer order={order} shopId={data.shopId} readOnly savedNotice="Sample order · view only · not connected to Supabase" close={() => setOrder(null)} saved={() => {}}/>}
  </>;
}
function DashboardAttention({ data, items, openOrder }: { data: BusinessSnapshot; items: DashboardAttentionItem[]; openOrder: (id: string) => void }) {
  return <Card>
    <div className="card-heading"><div><h2>Needs attention</h2><p className="muted">Small next steps from this period</p></div>{items.length > 0 && <span className="badge status-warning">Review needed</span>}</div>
    {!items.length ? <div className="attention-empty"><h3>Nothing urgent in this period</h3><p>No drafts, open payments, or unfulfilled confirmed orders were found.</p></div> : <ul className="attention-list">{items.map(item => <li key={item.id}>
      <span className="attention-icon" aria-hidden="true"><Icon name={item.icon}/></span>
      <div className="attention-copy"><strong>{item.title}</strong><p>{item.detail}</p></div>
      {item.orderId && (data.source === "live" ? <Link className="attention-action" href={`/sales?shop=${data.shopId}&order=${item.orderId}`} aria-label={`Review ${item.title}`}>Review</Link> : <button className="attention-action" onClick={() => openOrder(item.orderId!)} aria-label={`View ${item.title}`}>View</button>)}
    </li>)}</ul>}
  </Card>;
}
function ReportTable({ data, range, orders, expenses }: { data: BusinessSnapshot; range: DateRange; orders: OrderDetails[]; expenses: Expense[] }) {
  const rows = [
    ...orders.filter(order => order.order_status === "confirmed").map(order => ({ id: `order-${order.id}`, description: `Order #${order.id.slice(-6)}`, type: "Recorded sale", date: myanmarDate(order.created_at), status: "Confirmed order", amount: order.total_mmk })),
    ...(data.payments ?? []).filter(payment => payment.status === "confirmed" && payment.received_on >= range.from && payment.received_on <= range.to).map(payment => ({ id: payment.id, description: `Receipt for #${payment.order_id.slice(-6)}`, type: "Payment received", date: payment.received_on, status: "Confirmed receipt", amount: payment.amount_mmk })),
    ...expenses.map(expense => ({ id: expense.id, description: expense.description, type: expense.category === "Product costs" ? "Inventory purchase" : "Operating expense", date: expense.expense_date, status: "Recorded expense", amount: -expense.amount_mmk })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return <Card><div className="card-heading"><div><h2>Detailed Financial Report</h2><p className="muted">Sales, receipts, and spending are separate record types—not amounts to add together.</p></div></div>{!rows.length ? <div className="table-empty"><h3>No records in this period</h3><p>Adjust the date filters to see more activity.</p></div> : <div className="table-scroll" tabIndex={0} role="region" aria-label="Detailed financial report"><table className="data-table business-table"><caption className="sr-only">MMK financial records, separated by type to avoid counting sales and receipts as the same metric.</caption><thead><tr><th scope="col">Record</th><th scope="col">Type</th><th scope="col">Date</th><th scope="col">Status</th><th scope="col" className="amount-cell">Amount (MMK)</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.description}</td><td>{row.type}</td><td>{row.date}</td><td>{row.status}</td><td className="amount-cell">{formatMmk(row.amount)}</td></tr>)}</tbody></table></div>}</Card>;
}
