"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { financialTrend } from "@ocean/contracts";
import { formatMmk } from "@/lib/business/types";

type Trend = ReturnType<typeof financialTrend>;
const shortMmk = (value: number) => `${Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;
export function TrendChart({ rows, finance = false }: { rows: Trend; finance?: boolean }) {
  const hasData = rows.some(row => row.recordedSales !== 0 || row.confirmedPayments || row.operatingExpenses);
  if (!hasData) return <div className="chart-empty"><h3>No activity in this period</h3><p>Choose another date range or add an expense.</p></div>;
  return <>
    <p className="chart-summary">Amounts in MMK. Sales include confirmed orders after discounts and delivery fees; received money is a separate series.</p>
    <div className="business-chart" role="img" aria-label={finance ? "Financial trend in MMK. Exact amounts are in the accessible data table below." : "Recorded sales trend in MMK. Exact amounts are in the data table below."}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 8 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--ocean-border)"/>
          <XAxis dataKey="date" tickFormatter={date => String(date).slice(5)} minTickGap={30} tick={{ fill: "var(--ocean-muted)", fontSize: 12 }}/>
          <YAxis width={60} tickFormatter={shortMmk} tick={{ fill: "var(--ocean-muted)", fontSize: 12 }}/>
          <Tooltip formatter={value => `${formatMmk(Number(value))} MMK`} labelFormatter={date => `From ${date}`} contentStyle={{ borderRadius: 12, borderColor: "var(--ocean-border)" }}/>
          <Legend/>
          <Line type="linear" dataKey="recordedSales" name="Recorded sales" stroke="var(--ocean-primary-strong)" strokeWidth={3} dot={rows.length <= 7 ? { r: 3 } : false} isAnimationActive={false}/>
          {finance && <Line type="linear" dataKey="confirmedPayments" name="Confirmed receipts" stroke="var(--ocean-success-text)" strokeDasharray="7 4" strokeWidth={2} dot={rows.length <= 7 ? { r: 3 } : false} connectNulls={false} isAnimationActive={false}/>}
          {finance && <Line type="linear" dataKey="estimatedProfit" name="Estimated profit" stroke="var(--ocean-warning-text)" strokeDasharray="2 4" strokeWidth={2} dot={rows.length <= 7 ? { r: 3 } : false} connectNulls={false} isAnimationActive={false}/>}
        </LineChart>
      </ResponsiveContainer>
    </div>
    <details className="chart-data"><summary>View exact chart data</summary><div className="table-scroll" tabIndex={0} role="region" aria-label="Financial trend data"><table className="data-table"><caption className="sr-only">Chart amounts in MMK. Unavailable values are not zero.</caption><thead><tr><th scope="col">Period</th><th scope="col">Recorded sales</th><th scope="col">Confirmed receipts</th><th scope="col">Estimated profit</th></tr></thead><tbody>{rows.map(row => <tr key={row.date}><th scope="row">{row.date}{row.to !== row.date ? ` – ${row.to}` : ""}</th><td>{formatMmk(row.recordedSales)}</td><td>{formatMmk(row.confirmedPayments)}</td><td>{formatMmk(row.estimatedProfit)}</td></tr>)}</tbody></table></div></details>
  </>;
}
export function ExpenseBreakdownChart({ rows }: { rows: { category: string; amount_mmk: number }[] }) {
  if (!rows.length) return <div className="chart-empty"><h3>No expenses in this period</h3><p>Expenses will appear here after you add them.</p></div>;
  return <>
    <div className="business-chart expense-bars" role="img" aria-label="Expenses by category in MMK. Exact values follow the chart.">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={rows} layout="vertical" margin={{ left: 0, right: 20, top: 8, bottom: 8 }} accessibilityLayer>
        <CartesianGrid horizontal={false} stroke="var(--ocean-border)"/><XAxis type="number" tickFormatter={shortMmk} tick={{ fontSize: 12 }}/><YAxis type="category" dataKey="category" width={98} tick={{ fontSize: 12, fill: "var(--ocean-text)" }}/><Tooltip formatter={value => `${formatMmk(Number(value))} MMK`}/><Bar dataKey="amount_mmk" name="Expenses (MMK)" fill="var(--ocean-primary-strong)" radius={[0, 5, 5, 0]} isAnimationActive={false}/>
      </BarChart></ResponsiveContainer>
    </div><ul className="breakdown-values">{rows.map(row => <li key={row.category}><span>{row.category}</span><strong>{formatMmk(row.amount_mmk)} MMK</strong></li>)}</ul>
  </>;
}
