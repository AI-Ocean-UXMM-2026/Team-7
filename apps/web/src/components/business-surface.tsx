"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, Icon } from "@ocean/ui";
import {
  expenseBreakdown,
  financialTrend,
  myanmarDate,
  shiftDate,
  summarizeFinancials,
  totalExpenseAmount,
  validRange,
  type DateRange,
  type Expense,
  type ExpenseInput,
  type OrderDetails,
} from "@ocean/contracts";
import { Metrics } from "./metrics";
import { OrderDrawer } from "./order-manager";
import { ExpenseForm } from "./expense-form";
import { createLiveProvider } from "@/lib/business/live-provider";
import { createSampleProvider } from "@/lib/business/sample-provider";
import { getDashboardAttention, type DashboardAttentionItem } from "@/lib/business/attention";
import { formatMmk, type BusinessProvider, type BusinessSnapshot } from "@/lib/business/types";
import { useShellLanguage } from "./shell-language";
import { shellLabels, type ShellLanguage } from "@/lib/shell-ui";

import { OverviewRail } from "./overview-rail";

const TrendChart = dynamic(() => import("./business-charts").then((module) => module.TrendChart), {
  loading: () => <div className="business-chart chart-loading" role="status">Loading report chart…</div>,
});
const LastCostsBarChart = dynamic(
  () => import("./business-charts").then((module) => module.LastCostsBarChart),
  { loading: () => <div className="business-chart chart-loading" role="status">Loading costs chart…</div> }
);
const EfficiencyGauge = dynamic(
  () => import("./business-charts").then((module) => module.EfficiencyGauge),
  { loading: () => <div className="business-chart chart-loading" role="status">Loading efficiency…</div> }
);
const ExpenseBreakdownChart = dynamic(
  () => import("./business-charts").then((module) => module.ExpenseBreakdownChart),
  { loading: () => <div className="business-chart chart-loading" role="status">Loading expense chart…</div> }
);
const mmk = (amount: number | null) => (amount === null ? "Unavailable" : `${formatMmk(amount)} MMK`);

function monthRange(month: string): DateRange {
  const [year, number] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year ?? 0, number ?? 1, 0)).toISOString().slice(0, 10);
  return { from: `${month}-01`, to: last };
}

export function BusinessSurface({
  source = "live",
  shopId,
  today,
  finance = false,
  tab = "reports",
}: {
  source?: "sample" | "live";
  shopId?: string;
  today?: string;
  finance?: boolean;
  tab?: "expenses" | "reports";
}) {
  const provider = useMemo(
    () => source === "sample" ? createSampleProvider(today ?? myanmarDate(new Date().toISOString())) : createLiveProvider(shopId),
    [shopId, source, today]
  );
  const [result, setResult] = useState<{ data?: BusinessSnapshot; error?: string }>({});
  const [generation, setGeneration] = useState(0);
  const { language } = useShellLanguage();
  const labels = shellLabels(language);

  useEffect(() => {
    let active = true;
    provider
      .load()
      .then((data) => {
        if (active) setResult({ data });
      })
      .catch((error) => {
        if (active)
          setResult({
            error: error instanceof Error ? error.message : "Workspace unavailable. Retry loading.",
          });
      });
    return () => {
      active = false;
    };
  }, [provider, generation]);

  const reload = () => {
    setResult({});
    setGeneration((value) => value + 1);
  };

  const query = shopId ? `shop=${encodeURIComponent(shopId)}` : "";

  return (
    <div className="page-stack business-surface">


      {result.data?.source === "sample" && (
        <div className="sample-workspace-banner">
          <div>
            <strong>{language === "my" ? "နမူနာ လုပ်ငန်းခွင်:" : "Sample Workspace:"}</strong>{" "}
            {language === "my"
              ? "စမ်းသပ်အသုံးပြုရန် နမူနာဒေတာများကို ကြည့်ရှုနေပါသည်။ အမှန်တကယ် အော်ဒါနှင့် ငွေပေးချေမှုများကို မှတ်တမ်းမတင်ပါ။"
              : "You are viewing synthetic demonstration data. No real orders or verified payments are recorded here."}
          </div>
          <span className="status-badge status-warning">{language === "my" ? "နမူနာမုဒ်" : "Sample Mode"}</span>
        </div>
      )}

      {result.error ? (
        <Card>
          <div className="table-empty" role="alert">
            <h2>{language === "my" ? "လုပ်ငန်းခွင် ဖွင့်မရပါ" : "Workspace unavailable"}</h2>
            <p>{result.error}</p>
            <div className="business-actions">
              <button className="auth-secondary" onClick={reload}>
                {labels.retry}
              </button>
            </div>
          </div>
        </Card>
      ) : !result.data ? (
        <div className="business-loading" role="status" aria-live="polite" aria-busy="true">
          <span className="sync-spinner" aria-hidden="true" />
          {language === "my" ? "ဆိုင်၏ စာရင်းမှတ်တမ်းများကို ရယူနေပါသည်..." : "Loading your shop’s records…"}
        </div>
      ) : (
        <BusinessContent
          key={`${result.data.shopId}:${finance}:${tab}`}
          data={result.data}
          update={(data) => setResult({ data })}
          provider={provider}
          finance={finance}
          tab={tab}
          reload={reload}
        />
      )}
    </div>
  );
}

function RangeFilter({
  range,
  setRange,
  today,
  reload,
  onAddExpense,
}: {
  range: DateRange;
  setRange: (value: DateRange) => void;
  today: string;
  reload?: () => void;
  onAddExpense?: () => void;
}) {
  const { language } = useShellLanguage();
  const labels = shellLabels(language);

  return (
    <div className="business-filters" role="group" aria-label="Report date range">
      <div className="range-presets">
        {[
          [labels.presetToday, today],
          [labels.preset7Days, shiftDate(today, -6)],
          [labels.preset30Days, shiftDate(today, -29)],
          [labels.presetThisMonth, `${today.slice(0, 7)}-01`],
        ].map(([title, from]) => (
          <button
            key={title}
            className={`auth-secondary ${range.from === from && range.to === today ? "active-preset" : ""}`}
            aria-pressed={range.from === from && range.to === today}
            onClick={() => setRange({ from: from!, to: today })}
          >
            {title}
          </button>
        ))}
      </div>
      <div className="range-date-inputs">
        <label>
          <span>{labels.from}</span>
          <input
            type="date"
            value={range.from}
            onChange={(event) => setRange({ ...range, from: event.target.value })}
          />
        </label>
        <label>
          <span>{labels.to}</span>
          <input
            type="date"
            value={range.to}
            onChange={(event) => setRange({ ...range, to: event.target.value })}
          />
        </label>
      </div>
      <div className="filter-actions-group">
        {reload && (
          <button
            type="button"
            className="live-sync-btn"
            onClick={reload}
            title={language === "my" ? "အချက်အလက် အသစ်ရယူရန်" : "Refresh this workspace’s data"}
          >
            <span className="refresh-indicator" aria-hidden="true">↻</span>
            <span>{labels.syncLive}</span>
          </button>
        )}
        {onAddExpense && (
          <button
            type="button"
            className="auth-submit add-expense-pill-btn"
            onClick={onAddExpense}
          >
            {labels.addExpense}
          </button>
        )}
      </div>
    </div>
  );
}

function BusinessContent({
  data,
  update,
  provider,
  finance,
  tab,
  reload,
}: {
  data: BusinessSnapshot;
  update: (data: BusinessSnapshot) => void;
  provider: BusinessProvider;
  finance: boolean;
  tab: "expenses" | "reports";
  reload: () => void;
}) {
  const { language } = useShellLanguage();
  const labels = shellLabels(language);

  const [range, setRange] = useState<DateRange>(() => ({
    from: finance ? `${data.today.slice(0, 7)}-01` : shiftDate(data.today, -6),
    to: data.today,
  }));
  const [month, setMonth] = useState(data.today.slice(0, 7));
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [notice, setNotice] = useState("");
  const [financeView, setFinanceView] = useState<"transactions" | "ledger">(tab === "expenses" ? "ledger" : "transactions");
  const valid = validRange(range);
  let problem = "";
  let calculated: {
    summary: ReturnType<typeof summarizeFinancials>;
    daily: ReturnType<typeof summarizeFinancials>;
    monthly: ReturnType<typeof summarizeFinancials>;
    trend: ReturnType<typeof financialTrend>;
    breakdown: ReturnType<typeof expenseBreakdown>;
  } | null = null;

  if (valid) {
    try {
      calculated = {
        summary: summarizeFinancials(data, range),
        daily: summarizeFinancials(data, { from: data.today, to: data.today }),
        monthly: summarizeFinancials(data, monthRange(month)),
        trend: financialTrend(data, range),
        breakdown: expenseBreakdown(data.expenses, range),
      };
    } catch {
      problem =
        language === "my"
          ? "စာရင်းပေါင်းချုပ် တွက်ချက်၍ မရသေးပါ။ ရက်စွဲနှင့် မူရင်းမှတ်တမ်းများကို စစ်ဆေးပါ။"
          : "These totals could not be calculated safely. Check the date selection and source records.";
    }
  }

  const save = async (input: ExpenseInput, id?: string) => {
    const expense = await provider.saveExpense(input, id);
    update({
      ...data,
      expenses: [expense, ...data.expenses.filter((row) => row.id !== expense.id)],
    });
    setNotice(language === "my" ? "အသုံးစရိတ် သိမ်းဆည်းပြီးပါပြီ။" : "Expense saved successfully.");
  };

  const expenses = data.expenses
    .filter(
      (expense) =>
        expense.expense_date >= range.from &&
        expense.expense_date <= range.to &&
        (!category || expense.category === category)
    )
    .sort((a, b) => b.expense_date.localeCompare(a.expense_date));

  const orders = data.orders
    .filter((row) => {
      const date = myanmarDate(row.created_at);
      return date >= range.from && date <= range.to;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const categories = Array.from(new Set(data.expenses.map((expense) => expense.category))).sort();
  const attention = getDashboardAttention(data, orders);

    const exportCsv = () => {
    const rows = [
      ["Type", "Description", "Date", "Amount (MMK)"],
      ...orders.filter((ord) => ord.order_status === "confirmed").map((order) => ["Order", `#${order.id.slice(0, 8).toUpperCase()} · ${order.customers?.name ?? "Customer"}`, myanmarDate(order.created_at), String(order.total_mmk)]),
      ...expenses.map((expense) => ["Expense", `${expense.description} (${expense.category})`, expense.expense_date, String(-expense.amount_mmk)]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tu-tu-twat-finance-${range.from}-to-${range.to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <RangeFilter
        range={range}
        setRange={setRange}
        today={data.today}
        reload={reload}
        onAddExpense={
          finance
            ? () => {
                setEditing("new");
                setNotice("");
              }
            : undefined
        }
      />

      {notice && (
        <p className="business-success" role="status">
          {notice}
        </p>
      )}

      {!valid ? (
        <div className="workspace-message" role="alert">
          {language === "my"
            ? "မှန်ကန်သော အစ/အဆုံး ရက်စွဲများကို ရွေးချယ်ပါ။ (အများဆုံး ၃၆၇ ရက်အထိ)"
            : "Choose valid start and end dates covering at most 367 days."}
        </div>
      ) : problem || !calculated ? (
        <div className="workspace-message" role="alert">
          {problem}
        </div>
      ) : (
        <>
          {!finance ? (
            <div className="overview-container">
              <div className="overview-main-col">
                {/* 1. KPI Metrics under date bar in same size, text style and single-line */}
                <Metrics
                  items={[
                    {
                      label: labels.todaySales,
                      value: formatMmk(calculated.daily.recordedSales),
                      note: labels.confirmedToday,
                      icon: "arrow",
                      pill: "Today",
                    },
                    {
                      label: labels.paymentsReceived,
                      value: formatMmk(calculated.summary.confirmedPayments),
                      note: labels.confirmedInPeriod,
                      icon: "wallet",
                      currency: calculated.summary.confirmedPayments !== null,
                      pill: "Verified",
                    },
                    {
                      label: labels.estimatedProfit,
                      value: formatMmk(calculated.summary.estimatedProfit),
                      note: labels.netProfitAfterExpenses,
                      icon: "finance",
                      currency: calculated.summary.estimatedProfit !== null,
                      pill: "Margin",
                    },
                    {
                      label: labels.totalOrders,
                      value: String(calculated.summary.totalOrders),
                      note: labels.ordersInPeriod,
                      icon: "orders",
                      currency: false,
                      pill: "Volume",
                    },
                  ]}
                />

                {/* 2. Sales & Costs, Efficiency under those fours with a bit smaller size */}
                <div className="overview-middle-row compact-row">
                  <Card className="chart-card overview-chart-card compact-chart-card">
                    <div className="card-heading">
                      <div>
                        <h2>{language === "my" ? "အရောင်းနှင့် အသုံးစရိတ်" : "Sales & Costs"}</h2>
                        <p className="muted">
                          {language === "my" ? "ဝင်ငွေနှင့် ထွက်ငွေ နှိုင်းယှဉ်ချက်" : "Arrival vs Spending"}
                        </p>
                      </div>
                    </div>
                    <LastCostsBarChart rows={calculated.trend} />
                  </Card>

                  <Card className="chart-card overview-chart-card compact-chart-card">
                    <div className="card-heading">
                      <div>
                        <h2>{language === "my" ? "အမြတ်အစွန်း စွမ်းဆောင်ရည်" : "Efficiency"}</h2>
                        <p className="muted">
                          {language === "my" ? "အသားတင် အမြတ် ရာခိုင်နှုန်း" : "Net Margin"}
                        </p>
                      </div>
                    </div>
                    <EfficiencyGauge summary={calculated.summary} language={language} />
                  </Card>
                </div>

                {/* 3. Recent orders under them */}
                <Card className="overview-orders-card">
                  <div className="card-heading">
                    <div>
                      <h2>{language === "my" ? "လတ်တလော အော်ဒါများ" : "Recent Orders"}</h2>
                      <p className="muted">
                        {language === "my" ? "ယခုကာလအတွင်း ရောင်းချထားသော အော်ဒါမှတ်တမ်းများ" : "Orders captured in this period"}
                      </p>
                    </div>
                    <Link className="text-link" href={`/sales?shop=${data.shopId}`}>
                      {language === "my" ? "အော်ဒါအားလုံး ကြည့်ရန် →" : "View all orders →"}
                    </Link>
                  </div>
                  {!orders.length ? (
                    <div className="table-empty">
                      <h3>{language === "my" ? "ဤကာလတွင် အော်ဒါမရှိပါ" : "No orders in this period"}</h3>
                      <p>
                        {language === "my" ? "အော်ဒါအသစ် ဖွင့်လိုက်သည်နှင့် ဤနေရာတွင် ပေါ်လာပါမည်။" : "Orders will appear here once captured or created."}
                      </p>
                    </div>
                  ) : (
                    <div className="table-scroll" tabIndex={0} role="region" aria-label="Recent orders">
                      <table className="data-table business-table">
                        <caption className="sr-only">
                          Recent orders with separate order and payment statuses.
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">{labels.customer}</th>
                            <th scope="col">{labels.date}</th>
                            <th scope="col">{labels.orders}</th>
                            <th scope="col">{labels.paymentStatus}</th>
                            <th scope="col">{labels.fulfillmentStatus}</th>
                            <th scope="col" className="amount-cell">
                              {labels.amount} (MMK)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.slice(0, 6).map((row) => {
                            const orderNum = row.id.startsWith("40000000-0000-4000-8000-00000000")
                              ? `SS-${row.id.slice(-4)}`
                              : row.id.slice(0, 8).toUpperCase();
                            return (
                              <tr key={row.id}>
                                <td>
                                  <button className="order-open" onClick={() => setOrder(row)}>
                                    <strong>#{orderNum}</strong> · {row.customers?.name ?? (language === "my" ? "အမည်မသိ ဝယ်သူ" : "Customer")}
                                  </button>
                                </td>
                                <td>{myanmarDate(row.created_at)}</td>
                                <td>
                                  <span className="status-badge status-info">
                                    {language === "my" && row.order_status === "confirmed"
                                      ? "အတည်ပြုပြီး"
                                      : language === "my" && row.order_status === "draft"
                                      ? "မူကြမ်း"
                                      : row.order_status}
                                  </span>
                                </td>
                                <td>
                                  <span
                                    className={`status-badge ${
                                      row.payment_status === "paid" ? "status-success" : "status-warning"
                                    }`}
                                  >
                                    {language === "my" && row.payment_status === "paid"
                                      ? "ပေးချေပြီး"
                                      : language === "my" && row.payment_status === "unpaid"
                                      ? "မပေးချေရသေး"
                                      : row.payment_status.replaceAll("_", " ")}
                                  </span>
                                </td>
                                <td>
                                  <span className="status-badge status-neutral">
                                    {language === "my" && row.fulfillment_status === "delivered"
                                      ? "ပို့ဆောင်ပြီး"
                                      : language === "my" && row.fulfillment_status === "shipped"
                                      ? "ပို့ဆောင်ဆဲ"
                                      : language === "my" && row.fulfillment_status === "processing"
                                      ? "စီစဉ်ဆဲ"
                                      : row.fulfillment_status}
                                  </span>
                                </td>
                                <td className="amount-cell font-mono">
                                  <strong>{formatMmk(row.total_mmk)}</strong>
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

              {/* Right Rail Column */}
              <OverviewRail
                data={data}
                summary={calculated.summary}
                trend={calculated.trend}
                orders={orders}
                expenses={expenses}
                attention={attention}
                openOrder={(id) => setOrder(orders.find((ord) => ord.id === id) ?? null)}
                language={language}
              />
            </div>
          ) : (
            <div className="finance-layout page-stack">
              <Metrics
                items={[
                  {
                    label: labels.recordedSales,
                    value: formatMmk(calculated.summary.recordedSales),
                    note: labels.confirmedInPeriod,
                    icon: "arrow",
                    pill: "Sales",
                  },
                  {
                    label: labels.confirmedPayments,
                    value: formatMmk(calculated.summary.confirmedPayments),
                    note: language === "my" ? "စစ်ဆေးအတည်ပြုပြီး ရရှိငွေ" : "Verified receipts in period",
                    icon: "wallet",
                    currency: calculated.summary.confirmedPayments !== null,
                    pill: "Receipts",
                  },
                  {
                    label: labels.operatingExpenses,
                    value: formatMmk(calculated.summary.operatingExpenses),
                    note: labels.packagingDeliveryMarketing,
                    icon: "finance",
                    pill: "Outflow",
                  },
                  {
                    label: labels.estimatedProfit,
                    value: formatMmk(calculated.summary.estimatedProfit),
                    note: labels.salesMinusCosts,
                    icon: "orders",
                    currency: calculated.summary.estimatedProfit !== null,
                    pill: "Net",
                  },
                ]}
              />

              {/* Same length & reduced size: Sales, Receipts & profit Trend and Expense Breakdown */}
              <div className="insights-grid finance-charts-equal">
                <Card className="chart-card finance-chart-equal">
                  <div className="card-heading">
                    <div>
                      <h2>{language === "my" ? "အရောင်း၊ ရရှိငွေနှင့် အမြတ် လားရာ" : "Sales, Receipts & Profit Trend"}</h2>
                      <p className="muted">
                        {range.from} – {range.to}
                      </p>
                    </div>
                  </div>
                  <TrendChart rows={calculated.trend} finance={true} compact={true} language={language} />
                </Card>

                <Card className="chart-card finance-chart-equal">
                  <div className="card-heading">
                    <div>
                      <h2>{labels.expenseBreakdown}</h2>
                      <p className="muted">
                        {language === "my" ? "အမျိုးအစားအလိုက် စရိတ်ခွဲခြမ်းမှု" : "Spending by category"}
                      </p>
                    </div>
                  </div>
                  <ExpenseBreakdownChart rows={calculated.breakdown} compact={true} language={language} />
                </Card>
              </div>

              {/* Monthly financial summary and detailed financial transactions in same row side to side */}
              <div className="finance-details-grid">
                <Card className="monthly-summary-card">
                  <div className="card-heading">
                    <div>
                      <h2>{labels.monthlyFinancialSummary}</h2>
                      <p className="muted">{language === "my" ? "လအလိုက် ဘဏ္ဍာရေး အနှစ်ချုပ်" : "Monthly financial summary"}</p>
                    </div>
                    <label className="month-picker">
                      <span className="sr-only">{labels.month}</span>
                      <input
                        type="month"
                        value={month}
                        min="2000-01"
                        max="9999-12"
                        onChange={(event) => {
                          if (/^\d{4}-\d{2}$/.test(event.target.value)) setMonth(event.target.value);
                        }}
                      />
                    </label>
                  </div>
                  <dl className="monthly-summary financial-summary">
                    <div>
                      <dt>{language === "my" ? "မှတ်တမ်းတင်ပြီး အရောင်း" : "Recorded sales"}</dt>
                      <dd>{mmk(calculated.monthly.recordedSales)}</dd>
                    </div>
                    <div>
                      <dt>{language === "my" ? "အတည်ပြုပြီး ရရှိငွေ" : "Confirmed receipts"}</dt>
                      <dd>{mmk(calculated.monthly.confirmedPayments)}</dd>
                    </div>
                    <div>
                      <dt>{language === "my" ? "ကုန်ပစ္စည်း ဝယ်ရင်းစရိတ်" : "Order product costs"}</dt>
                      <dd>{mmk(calculated.monthly.productCosts)}</dd>
                    </div>
                    <div>
                      <dt>{language === "my" ? "လုပ်ငန်းလည်ပတ်စရိတ်" : "Operating expenses"}</dt>
                      <dd>{mmk(calculated.monthly.operatingExpenses)}</dd>
                    </div>
                    <div>
                      <dt>{language === "my" ? "ကုန်ပစ္စည်း ဝယ်ယူမှု" : "Inventory purchases"}</dt>
                      <dd>{mmk(calculated.monthly.productPurchases)}</dd>
                    </div>
                    <div>
                      <dt>{language === "my" ? "ခန့်မှန်း အသားတင်အမြတ်" : "Estimated profit"}</dt>
                      <dd className="profit-highlight">{mmk(calculated.monthly.estimatedProfit)}</dd>
                    </div>
                  </dl>
                </Card>

                {/* Only differ expense ledger and detailed financial transactions */}
                <Card className="finance-table-card">
                  <div className="card-heading">
                    <div className="finance-view-toggle" role="tablist" aria-label="Transaction table view">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={financeView === "transactions"}
                        className={`finance-tab-pill ${financeView === "transactions" ? "active" : ""}`}
                        onClick={() => setFinanceView("transactions")}
                      >
                        {language === "my" ? "ငွေစာရင်း အသေးစိတ်" : "Detailed Transactions"}
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={financeView === "ledger"}
                        className={`finance-tab-pill ${financeView === "ledger" ? "active" : ""}`}
                        onClick={() => setFinanceView("ledger")}
                      >
                        {language === "my" ? "အသုံးစရိတ် စာရင်း" : "Expense Ledger"}
                      </button>
                    </div>

                    {financeView === "transactions" ? (
                      <button type="button" className="auth-secondary export-btn-sm" onClick={exportCsv}>
                        {language === "my" ? "CSV ထုတ်ယူ" : "Export CSV"}
                      </button>
                    ) : (
                      <label className="category-picker-sm">
                        <span className="sr-only">{labels.category}</span>
                        <select value={category} onChange={(event) => setCategory(event.target.value)}>
                          <option value="">{labels.allCategories}</option>
                          {categories.map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>

                  {financeView === "transactions" ? (
                    <div className="table-scroll" tabIndex={0} role="region" aria-label="Transaction reports">
                      <table className="data-table business-table compact-table">
                        <caption className="sr-only">Orders and expenses in period.</caption>
                        <thead>
                          <tr>
                            <th scope="col">{language === "my" ? "အမျိုးအစား" : "Type"}</th>
                            <th scope="col">{language === "my" ? "အကြောင်းအရာ" : "Description"}</th>
                            <th scope="col">{language === "my" ? "ရက်စွဲ" : "Date"}</th>
                            <th scope="col" className="amount-cell">
                              {language === "my" ? "ပမာဏ" : "Amount"} (MMK)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.filter((ord) => ord.order_status === "confirmed").map((o) => (
                            <tr key={o.id}>
                              <td>
                                <span className="status-badge status-info">{language === "my" ? "အရောင်း" : "Order"}</span>
                              </td>
                              <td>
                                #{o.id.slice(0, 8).toUpperCase()} · {o.customers?.name ?? (language === "my" ? "ဝယ်သူ" : "Customer")}
                              </td>
                              <td>{myanmarDate(o.created_at)}</td>
                              <td className="amount-cell font-mono text-success">
                                <strong>+{formatMmk(o.total_mmk)}</strong>
                              </td>
                            </tr>
                          ))}
                          {expenses.map((e) => (
                            <tr key={e.id}>
                              <td>
                                <span className="status-badge status-warning">{language === "my" ? "စရိတ်" : "Expense"}</span>
                              </td>
                              <td>
                                {e.description} ({e.category})
                              </td>
                              <td>{e.expense_date}</td>
                              <td className="amount-cell font-mono text-danger">
                                <strong>-{formatMmk(e.amount_mmk)}</strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <>
                      {!expenses.length ? (
                        <div className="table-empty compact-empty">
                          <h3>{language === "my" ? "ဤကာလတွင် အသုံးစရိတ်မရှိပါ" : "No expenses match these filters"}</h3>
                          <p>{language === "my" ? "အသုံးစရိတ်အသစ်ထည့်ပါ သို့မဟုတ် ရက်စွဲကို ပြန်ညှိပါ။" : "Add your first expense or clear the date filters."}</p>
                          <button className="auth-secondary" onClick={() => setEditing("new")}>
                            {labels.addExpense}
                          </button>
                        </div>
                      ) : (
                        <div className="table-scroll" tabIndex={0} role="region" aria-label="Expense ledger">
                          <table className="data-table business-table compact-table">
                            <caption className="sr-only">
                              Expense amounts in MMK; choose an expense description to edit.
                            </caption>
                            <thead>
                              <tr>
                                <th scope="col">{language === "my" ? "အကြောင်းအရာ" : "Description"}</th>
                                <th scope="col">{labels.category}</th>
                                <th scope="col">{labels.date}</th>
                                <th scope="col" className="amount-cell">
                                  {labels.amount} (MMK)
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {expenses.map((expense) => {
                                const catLower = expense.category.toLowerCase();
                                const catTagClass = catLower.includes("pack")
                                  ? "tag-packaging"
                                  : catLower.includes("deliv")
                                  ? "tag-delivery"
                                  : catLower.includes("market")
                                  ? "tag-marketing"
                                  : catLower.includes("cost") || catLower.includes("product")
                                  ? "tag-cost"
                                  : "tag-general";

                                return (
                                  <tr key={expense.id}>
                                    <td>
                                      <button
                                        className="expense-edit-link"
                                        onClick={() => setEditing(expense)}
                                        title="Edit expense details"
                                      >
                                        <strong>{expense.description}</strong>
                                        {expense.notes && <span className="expense-notes-preview">{expense.notes}</span>}
                                      </button>
                                    </td>
                                    <td>
                                      <span className={`category-tag ${catTagClass}`}>{expense.category}</span>
                                    </td>
                                    <td>{expense.expense_date}</td>
                                    <td className="amount-cell font-mono">
                                      <strong>{formatMmk(expense.amount_mmk)}</strong>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <p className="table-summary compact-summary">
                        {expenses.length} {language === "my" ? "ခု · စုစုပေါင်း အသုံးစရိတ်" : "expenses ·"}{" "}
                        {mmk(totalExpenseAmount(expenses))}
                      </p>
                    </>
                  )}
                </Card>
              </div>
            </div>
          )}

          <details className="calculation-notes">
            <summary>
              {language === "my" ? "ဤဘဏ္ဍာရေး စာရင်းများကို တွက်ချက်ပုံ ရှင်းလင်းချက်" : "How these financial totals are calculated"}
            </summary>
            <p>
              {language === "my"
                ? "အရောင်းစာရင်းတွင် အတည်ပြုပြီး အော်ဒါများ၏ လျှော့စျေးနှင့် ပို့ဆောင်ခ တွက်ချက်ပြီး တန်ဖိုးများ ပါဝင်ပါသည်။ ရရှိငွေတွင် အတည်ပြုပြီး ငွေလွှဲပြေစာများသာ ပါဝင်ပြီး၊ အမြတ်ငွေတွင် ကုန်ပစ္စည်းဝယ်ရင်းစရိတ်နှင့် လည်ပတ်စရိတ်များကို နုတ်ယူတွက်ချက်ထားပါသည်။"
                : "Recorded sales include confirmed order totals after discounts and delivery fees. Confirmed receipts track actual verified payments in the period. Estimated profit deducts product costs and operating expenses from recorded sales."}
            </p>
          </details>
        </>
      )}

      {editing && (
        <ExpenseForm
          expense={editing === "new" ? null : editing}
          today={data.today}
          source={data.source}
          save={save}
          close={() => setEditing(null)}
        />
      )}

      {order && (
        <OrderDrawer
          order={order}
          shopId={data.shopId}
          savedNotice=""
          close={() => setOrder(null)}
          saved={(savedOrd) => {
            update({
              ...data,
              orders: [savedOrd, ...data.orders.filter((o) => o.id !== savedOrd.id)],
            });
            setOrder(savedOrd);
          }}
        />
      )}
    </>
  );
}

function DashboardAttention({
  items,
  openOrder,
  language,
}: {
  data?: BusinessSnapshot;
  items: DashboardAttentionItem[];
  openOrder: (id: string) => void;
  language: ShellLanguage;
}) {
  const labels = shellLabels(language);
  return (
    <Card className="attention-card">
      <div className="card-heading">
        <div>
          <h2>{labels.needsAttention}</h2>
          <p className="muted">{language === "my" ? "ချက်ချင်း စစ်ဆေးရန် လိုအပ်သော အချက်များ" : "Action items from this period"}</p>
        </div>
        {items.length > 0 && (
          <span className="badge status-warning">
            {language === "my" ? "စစ်ဆေးရန်ရှိ" : "Review needed"}
          </span>
        )}
      </div>
      {!items.length ? (
        <div className="attention-empty">
          <h3>{labels.noAttention}</h3>
          <p>
            {language === "my"
              ? "စစ်ဆေးရန် အော်ဒါမူကြမ်း သို့မဟုတ် စလစ်မရှိပါ။ အားလုံး အဆင်ပြေနေပါသည်။"
              : "No drafts, unpaid orders, or unfulfilled confirmed orders require immediate review."}
          </p>
        </div>
      ) : (
        <ul className="attention-list">
          {items.map((item) => (
            <li key={item.id}>
              <span className="attention-icon" aria-hidden="true">
                <Icon name={item.icon} />
              </span>
              <div className="attention-copy">
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
              {item.orderId && (
                <button
                  className="attention-action"
                  onClick={() => openOrder(item.orderId!)}
                  aria-label={`View ${item.title}`}
                >
                  {language === "my" ? "စစ်ဆေးရန်" : "Review"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ReportTable({
  range,
  orders,
  expenses,
  language,
}: {
  data?: BusinessSnapshot;
  range: DateRange;
  orders: OrderDetails[];
  expenses: Expense[];
  language: string;
}) {
  const exportCsv = () => {
    const rows = [
      ["Type", "Description", "Date", "Amount (MMK)"],
      ...orders.map((order) => ["Order", `#${order.id.slice(0, 8).toUpperCase()} · ${order.customers?.name ?? "Customer"}`, myanmarDate(order.created_at), String(order.total_mmk)]),
      ...expenses.map((expense) => ["Expense", `${expense.description} (${expense.category})`, expense.expense_date, String(-expense.amount_mmk)]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tu-tu-twat-finance-${range.from}-to-${range.to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Card>
      <div className="card-heading">
        <div>
          <h2>{language === "my" ? "ဘဏ္ဍာရေး ငွေစာရင်း အသေးစိတ်" : "Detailed Financial Transactions"}</h2>
          <p className="muted">
            {range.from} – {range.to}
          </p>
        </div>
        <button type="button" className="auth-secondary" onClick={exportCsv}>
          {language === "my" ? "CSV ထုတ်ယူရန်" : "Export CSV"}
        </button>
      </div>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Transaction reports">
        <table className="data-table business-table">
          <caption className="sr-only">Orders and expenses in period.</caption>
          <thead>
            <tr>
              <th scope="col">{language === "my" ? "အမျိုးအစား" : "Type"}</th>
              <th scope="col">{language === "my" ? "အကြောင်းအရာ" : "Description"}</th>
              <th scope="col">{language === "my" ? "ရက်စွဲ" : "Date"}</th>
              <th scope="col" className="amount-cell">
                {language === "my" ? "ပမာဏ" : "Amount"} (MMK)
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <span className="status-badge status-info">{language === "my" ? "အော်ဒါအရောင်း" : "Order"}</span>
                </td>
                <td>
                  #{o.id.slice(0, 8).toUpperCase()} · {o.customers?.name ?? (language === "my" ? "ဝယ်သူ" : "Customer")}
                </td>
                <td>{myanmarDate(o.created_at)}</td>
                <td className="amount-cell font-mono text-success">
                  <strong>+{formatMmk(o.total_mmk)}</strong>
                </td>
              </tr>
            ))}
            {expenses.map((e) => (
              <tr key={e.id}>
                <td>
                  <span className="status-badge status-warning">{language === "my" ? "အသုံးစရိတ်" : "Expense"}</span>
                </td>
                <td>
                  {e.description} ({e.category})
                </td>
                <td>{e.expense_date}</td>
                <td className="amount-cell font-mono text-danger">
                  <strong>-{formatMmk(e.amount_mmk)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
