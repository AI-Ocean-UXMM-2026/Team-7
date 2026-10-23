"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { financialTrend, summarizeFinancials } from "@ocean/contracts";
import { formatMmk } from "@/lib/business/types";
import type { ShellLanguage } from "@/lib/shell-ui";

type Trend = ReturnType<typeof financialTrend>;
type Summary = ReturnType<typeof summarizeFinancials>;

const shortMmk = (value: number) =>
  `${Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;

export function TrendChart({
  rows,
  finance = false,
  compact = false,
  language = "en",
}: {
  rows: Trend;
  finance?: boolean;
  compact?: boolean;
  language?: ShellLanguage;
}) {
  const hasData = rows.some((row) => row.recordedSales !== 0 || row.confirmedPayments || row.operatingExpenses);
  if (!hasData) {
    return (
      <div className="chart-empty compact-chart-empty">
        <div className="empty-sparkle-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
          </svg>
        </div>
        <h3>{language === "my" ? "ဤကာလတွင် လှုပ်ရှားမှု မရှိပါ" : "No activity in this period"}</h3>
        <p>{language === "my" ? "ရက်စွဲပြောင်းပါ သို့မဟုတ် စရိတ်ထည့်ပါ" : "Choose another date range or add an expense."}</p>
      </div>
    );
  }

  return (
    <>
      {finance && (
        <div className="trend-legend-bar" aria-label="Line indicators">
          <span className="trend-legend-pill">
            <span className="legend-sample solid-blue" />
            <span className="legend-label">{language === "my" ? "အရောင်း" : "Sales"}</span>
          </span>
          <span className="trend-legend-pill">
            <span className="legend-sample dashed-green" />
            <span className="legend-label">{language === "my" ? "ရရှိငွေ" : "Receipts"}</span>
          </span>
          <span className="trend-legend-pill">
            <span className="legend-sample dotted-amber" />
            <span className="legend-label">{language === "my" ? "အမြတ်" : "Profit"}</span>
          </span>
        </div>
      )}
      {!compact && (
        <p className="chart-summary">
          Amounts in MMK. Sales include confirmed orders; received money is a separate verified series.
        </p>
      )}
      <div
        className="business-chart trend-chart-container"
        role="img"
        aria-label={
          finance
            ? "Financial trend in MMK. Exact amounts are in the accessible data table below."
            : "Recorded sales trend in MMK. Exact amounts are in the data table below."
        }
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={rows} margin={{ top: 16, right: 20, left: 10, bottom: 8 }} accessibilityLayer>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3478f6" stopOpacity={0.28} />
                <stop offset="90%" stopColor="#3478f6" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e8edf6" strokeDasharray="4 4" />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => String(date).slice(5)}
              minTickGap={24}
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={56}
              tickFormatter={shortMmk}
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value, name) => {
                const label =
                  name === "recordedSales" || name === "Sales"
                    ? (language === "my" ? "အရောင်း (Sales)" : "Sales")
                    : name === "confirmedPayments" || name === "Receipts"
                    ? (language === "my" ? "ရရှိငွေ (Receipts)" : "Receipts")
                    : (language === "my" ? "အမြတ် (Profit)" : "Profit");
                return [`${formatMmk(Number(value))} MMK`, label];
              }}
              labelFormatter={(date) => `Date: ${date}`}
              contentStyle={{
                borderRadius: 12,
                borderColor: "#e2e8f0",
                boxShadow: "0 8px 20px rgba(23, 44, 120, 0.08)",
                fontSize: 11,
                fontWeight: 600,
                padding: "8px 12px",
              }}
            />
            <Area
              type="monotone"
              dataKey="recordedSales"
              name="Sales"
              stroke="#3478f6"
              strokeWidth={3}
              fill="url(#salesGradient)"
              dot={rows.length <= 8 ? { r: 3.5, fill: "#ffffff", stroke: "#3478f6", strokeWidth: 2 } : false}
              activeDot={{ r: 5, fill: "#3478f6" }}
              isAnimationActive={false}
            />
            {finance && (
              <Line
                type="monotone"
                dataKey="confirmedPayments"
                name="Receipts"
                stroke="#16a574"
                strokeDasharray="6 4"
                strokeWidth={2}
                dot={rows.length <= 8 ? { r: 3, fill: "#16a574" } : false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
            {finance && (
              <Line
                type="monotone"
                dataKey="estimatedProfit"
                name="Profit"
                stroke="#f2ae40"
                strokeDasharray="3 3"
                strokeWidth={2}
                dot={rows.length <= 8 ? { r: 3, fill: "#f2ae40" } : false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {!compact && (
        <details className="chart-data">
          <summary>View exact chart data</summary>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Financial trend data">
            <table className="data-table">
              <caption className="sr-only">Chart amounts in MMK. Unavailable values are not zero.</caption>
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col">Recorded sales</th>
                  <th scope="col">Confirmed receipts</th>
                  <th scope="col">Estimated profit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.date}>
                    <th scope="row">
                      {row.date}
                      {row.to !== row.date ? ` – ${row.to}` : ""}
                    </th>
                    <td>{formatMmk(row.recordedSales)}</td>
                    <td>{formatMmk(row.confirmedPayments)}</td>
                    <td>{formatMmk(row.estimatedProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </>
  );
}

export function LastCostsBarChart({ rows }: { rows: Trend }) {
  const hasData = rows.some((row) => row.recordedSales !== 0 || row.operatingExpenses !== 0);
  if (!hasData) {
    return (
      <div className="chart-empty">
        <h3>No activity</h3>
        <p>No sales or expense activity in this period.</p>
      </div>
    );
  }

  return (
    <div className="last-costs-chart-wrap" role="img" aria-label="Sales and expenses comparison chart">
      <div className="business-chart last-costs-chart">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={rows} margin={{ top: 16, right: 16, left: 6, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke="#eef2f8" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => String(date).slice(5)}
              minTickGap={20}
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={56}
              tickFormatter={shortMmk}
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => [`${formatMmk(Number(value))} MMK`, ""]}
              contentStyle={{
                borderRadius: 12,
                borderColor: "#e2e8f0",
                fontSize: 12,
                boxShadow: "0 8px 20px rgba(23,44,120,0.06)",
              }}
            />
            <Bar
              dataKey="recordedSales"
              name="Arrival (Sales)"
              fill="#3478f6"
              radius={[4, 4, 0, 0]}
              maxBarSize={12}
              isAnimationActive={false}
            />
            <Bar
              dataKey="operatingExpenses"
              name="Spending"
              fill="#cbd5e1"
              radius={[4, 4, 0, 0]}
              maxBarSize={12}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-legend-inline">
        <span className="legend-chip arrival">
          <span className="legend-dot" style={{ background: "#3478f6" }} />
          Arrival
        </span>
        <span className="legend-chip spending">
          <span className="legend-dot" style={{ background: "#cbd5e1" }} />
          Spending
        </span>
      </div>
    </div>
  );
}

export function EfficiencyGauge({
  summary,
  language,
}: {
  summary: Summary;
  language: ShellLanguage;
}) {
  const sales = summary.recordedSales;
  const profit = summary.estimatedProfit;
  const marginPercent =
    profit !== null && sales > 0 ? Math.round((profit / sales) * 100) : profit !== null && profit > 0 ? 100 : 0;
  const clamped = Math.max(0, Math.min(100, marginPercent));

  // Circular gauge parameters
  const radius = 52;
  const strokeWidth = 9;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * clamped) / 100;

  return (
    <div className="efficiency-gauge-wrap" role="region" aria-label="Profit efficiency gauge">
      <div className="efficiency-ring-container">
        <svg className="efficiency-svg" viewBox="0 0 140 140" aria-hidden="true">
          <circle
            className="ring-bg"
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="#eef2f9"
            strokeWidth={strokeWidth}
          />
          <circle
            className="ring-progress"
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="url(#efficiencyGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
          />
          <defs>
            <linearGradient id="efficiencyGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3478f6" />
              <stop offset="100%" stopColor="#245dd0" />
            </linearGradient>
          </defs>
        </svg>
        <div className="efficiency-center-copy">
          <strong className="efficiency-amount">
            {profit === null ? "—" : `${formatMmk(profit)}`}
          </strong>
          <span className="efficiency-badge">
            {clamped > 0 ? `+${clamped}%` : `${clamped}%`}
          </span>
        </div>
      </div>
      <div className="chart-legend-inline">
        <span className="legend-chip earned">
          <span className="legend-dot" style={{ background: "#3478f6" }} />
          {language === "my" ? "ဝင်ငွေ" : "Earned"}
        </span>
        <span className="legend-chip spend">
          <span className="legend-dot" style={{ background: "#cbd5e1" }} />
          {language === "my" ? "အသုံးစရိတ်" : "Spend"}
        </span>
      </div>
    </div>
  );
}

export function MiniProfitSparkline({ trend }: { trend: Trend }) {
  const data = trend.map((t, idx) => ({ idx, val: t.recordedSales }));
  return (
    <div className="mini-sparkline-container" aria-hidden="true">
      <ResponsiveContainer width="100%" height={44}>
        <LineChart data={data} margin={{ top: 4, right: 6, left: 6, bottom: 4 }}>
          <Line
            type="monotone"
            dataKey="val"
            stroke="#ec4899"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExpenseBreakdownChart({
  rows,
  compact = false,
  language = "en",
}: {
  rows: { category: string; amount_mmk: number }[];
  compact?: boolean;
  language?: ShellLanguage;
}) {
  if (!rows.length) {
    return (
      <div className="chart-empty compact-chart-empty">
        <div className="empty-sparkle-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
        </div>
        <h3>{language === "my" ? "ဤကာလတွင် အသုံးစရိတ် မရှိပါ" : "No expenses in this period"}</h3>
        <p>{language === "my" ? "စရိတ်ထည့်သွင်းပြီးပါက ဤနေရာတွင် ပြသပါမည်။" : "Expenses will appear here after you add them."}</p>
      </div>
    );
  }
  return (
    <>
      <div
        className="business-chart expense-bars"
        role="img"
        aria-label="Expenses by category in MMK. Exact values follow the chart."
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={rows} layout="vertical" margin={{ left: -10, right: 38, top: 4, bottom: 4 }} accessibilityLayer>
            <CartesianGrid horizontal={false} stroke="#e8edf6" strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={shortMmk} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} />
            <YAxis
              type="category"
              dataKey="category"
              width={90}
              tick={{ fontSize: 10, fill: "#183153" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip formatter={(value) => [`${formatMmk(Number(value))} MMK`, language === "my" ? "စရိတ်" : "Expenses"]} />
            <Bar
              dataKey="amount_mmk"
              name="Expenses"
              fill="#3478f6"
              radius={[0, 5, 5, 0]}
              maxBarSize={14}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="amount_mmk"
                position="right"
                formatter={(val: unknown) => shortMmk(Number(val))}
                style={{ fontSize: 10, fill: "#475569", fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!compact && (
        <ul className="breakdown-values">
          {rows.map((row) => (
            <li key={row.category}>
              <span>{row.category}</span>
              <strong>{formatMmk(row.amount_mmk)} MMK</strong>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
