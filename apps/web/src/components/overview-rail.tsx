"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Icon } from "@ocean/ui";
import { formatMmk, type BusinessSnapshot } from "@/lib/business/types";
import type { DashboardAttentionItem } from "@/lib/business/attention";
import type { Expense, OrderDetails, summarizeFinancials, financialTrend } from "@ocean/contracts";
import type { ShellLanguage } from "@/lib/shell-ui";

const TrendChart = dynamic(() => import("./business-charts").then((module) => module.TrendChart), {
  loading: () => <div className="business-chart chart-loading" role="status">Loading chart…</div>,
});

type Summary = ReturnType<typeof summarizeFinancials>;
type Trend = ReturnType<typeof financialTrend>;

export function OverviewRail({
  data,
  summary,
  trend,
  orders,
  expenses,
  attention,
  openOrder,
  language,
}: {
  data: BusinessSnapshot;
  summary: Summary;
  trend: Trend;
  orders: OrderDetails[];
  expenses: Expense[];
  attention: DashboardAttentionItem[];
  openOrder: (id: string) => void;
  language: ShellLanguage;
}) {
  const profit = summary.estimatedProfit;
  const sales = summary.recordedSales;
  const margin = profit !== null && sales > 0 ? Math.round((profit / sales) * 100) : profit !== null && profit > 0 ? 100 : 0;
  const initials = data.shopName.slice(0, 2).toUpperCase();

  // Combine latest activities
  const recentOrders = orders.slice(0, 3);
  const recentExpenses = expenses.slice(0, 2);

  return (
    <aside className="overview-rail" aria-label="Shop profile and recent activities">
      {/* 1. Shop Owner Profile Card (Reduced Size) */}
      <div className="rail-profile-card compact">
        <div className="rail-profile-avatar compact" aria-hidden="true">
          <span>{initials}</span>
        </div>
        <div className="rail-profile-copy">
          <strong className="rail-profile-name" title={data.shopName}>
            {data.shopName}
          </strong>
          <span className="rail-profile-role">
            {language === "my" ? "ဆိုင်ပိုင်ရှင် · ဘဏ္ဍာရေး" : "Shop Owner · Analytics"}
          </span>
        </div>
        <div className="rail-profile-actions">
          <Link
            href={`/settings${data.shopId ? `?shop=${data.shopId}` : ""}`}
            className="rail-icon-btn"
            title="Shop Settings"
            aria-label="Settings"
          >
            <Icon name="settings" size={15} />
          </Link>
        </div>
      </div>

      {/* 2. Total Profit Card (Reduced Size, No Sparkline Points, Label + MMK Amount + Beside %) */}
      <div className="rail-profit-card compact">
        <span className="rail-profit-label">
          {language === "my" ? "စုစုပေါင်း အမြတ်ငွေ" : "Total Profit"}
        </span>
        <div className="rail-profit-inline">
          <strong className="rail-profit-value">
            {profit === null ? "Unavailable" : `${formatMmk(profit)}`}
            {profit !== null && <small> MMK</small>}
          </strong>
          <span className="rail-profit-pill">
            {margin > 0 ? `+${margin}%` : `${margin}%`}
          </span>
        </div>
      </div>

      {/* 3. Recent Activities Feed (Reduced Size) */}
      <div className="rail-activities-card compact">
        <div className="rail-activities-heading">
          <h3>{language === "my" ? "လတ်တလော လှုပ်ရှားမှုများ" : "Recent activities"}</h3>
        </div>

        {/* Needs attention section if items exist */}
        {attention.length > 0 && (
          <div className="activity-group">
            <span className="activity-group-label">
              {language === "my" ? "စစ်ဆေးရန် လိုအပ်ချက်" : "NEEDS ATTENTION"}
            </span>
            <ul className="activity-items">
              {attention.slice(0, 2).map((item) => (
                <li key={item.id} className="activity-row attention-highlight">
                  <span className="activity-badge badge-warning" aria-hidden="true">
                    !
                  </span>
                  <div className="activity-copy">
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                  {item.orderId && (
                    <button
                      type="button"
                      className="activity-action-btn"
                      onClick={() => openOrder(item.orderId!)}
                    >
                      {language === "my" ? "စစ်ဆေး" : "Review"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Transactions list */}
        <div className="activity-group">
          <span className="activity-group-label">
            {language === "my" ? "ယနေ့ အရောင်းမှတ်တမ်း" : "RECENT ORDERS & PAYMENTS"}
          </span>
          <ul className="activity-items">
            {recentOrders.length === 0 && recentExpenses.length === 0 ? (
              <li className="activity-empty">
                <p className="muted">
                  {language === "my" ? "မှတ်တမ်း မရှိသေးပါ" : "No recent transactions"}
                </p>
              </li>
            ) : (
              <>
                {recentOrders.map((ord) => {
                  const isPaid = ord.payment_status === "paid";
                  return (
                    <li key={ord.id} className="activity-row">
                      <span
                        className={`activity-badge ${isPaid ? "badge-success" : "badge-info"}`}
                        aria-hidden="true"
                      >
                        {isPaid ? "↗" : "↘"}
                      </span>
                      <div className="activity-copy">
                        <strong title={ord.customers?.name ?? "Customer"}>
                          {ord.customers?.name ?? "Customer"}
                        </strong>
                        <p>#{ord.id.slice(0, 6).toUpperCase()} · {ord.payment_status}</p>
                      </div>
                      <span className={`activity-amount ${isPaid ? "text-success" : "text-info"}`}>
                        +{formatMmk(ord.total_mmk)}
                      </span>
                    </li>
                  );
                })}

                {recentExpenses.map((exp) => (
                  <li key={exp.id} className="activity-row">
                    <span className="activity-badge badge-danger" aria-hidden="true">
                      ↗
                    </span>
                    <div className="activity-copy">
                      <strong title={exp.description}>{exp.description}</strong>
                      <p>{exp.category}</p>
                    </div>
                    <span className="activity-amount text-danger">
                      -{formatMmk(exp.amount_mmk)}
                    </span>
                  </li>
                ))}
              </>
            )}
          </ul>
        </div>
      </div>

      {/* 4. Sales Overview in Smaller Size Under Recent Activities on Right Rail */}
      <div className="rail-sales-overview-card">
        <div className="card-heading">
          <div>
            <h3>{language === "my" ? "အရောင်း ခြုံငုံသုံးသပ်ချက်" : "Sales Overview"}</h3>
            <p className="muted">{language === "my" ? "ကာလအတွင်း နေ့စဉ်ရောင်းအား" : "Daily sales trend"}</p>
          </div>
          <span className="chart-type-pill">MMK · Daily</span>
        </div>
        <div className="rail-trend-chart-wrap">
          <TrendChart rows={trend} finance={false} compact={true} />
        </div>
      </div>
    </aside>
  );
}
