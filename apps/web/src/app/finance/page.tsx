import type { Metadata } from "next";
import { Card, PageHeading } from "@ocean/ui";
import { SectionNav } from "@/components/section-nav";
import { Metrics } from "@/components/metrics";
import { CashFlowChart, ExpenseChart } from "@/components/sample-charts";
import { sampleExpenses } from "@/lib/sample-data";

export const metadata: Metadata = { title: "Finance Management" };

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const selected = tab === "expenses" ? "expenses" : "reports";
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="Financial clarity"
        title="Finance Management"
        description="Understand what you sold, received, spent, and earned."
      />
      <SectionNav
        label="Finance sections"
        selected={selected}
        items={[
          { key: "expenses", label: "Expenses", href: "/finance?tab=expenses" },
          { key: "reports", label: "Reports", href: "/finance" },
        ]}
      />
      {selected === "expenses" ? (
        <Card><div className="card-heading"><div><h2>Business expenses</h2><p className="muted">A sample ledger of the everyday costs of selling</p></div><span className="badge">Sample entries</span></div><div className="table-scroll" role="region" aria-label="Sample expenses" tabIndex={0}><table className="data-table"><thead><tr><th scope="col">Expense</th><th scope="col">Category</th><th scope="col">Date</th><th scope="col" className="amount-cell">Amount</th></tr></thead><tbody>{sampleExpenses.map(expense=><tr key={expense.name}><td><strong>{expense.name}</strong></td><td><span className="status-badge status-info">{expense.category}</span></td><td className="muted">{expense.date}</td><td className="amount-cell"><strong>{expense.amount}</strong><small> MMK</small></td></tr>)}</tbody></table></div><p className="table-summary">Sample figures only. Expense recording and export aren’t connected.</p></Card>
      ) : (
        <>
          <div>
            <h2 className="section-title">Business performance</h2>
            <p className="muted text-sm">
              Illustrative month · Sample figures, not live financial results
            </p>
          </div>
          <Metrics
            items={[
              {
                label: "Recorded sales",
                value: "8,420,000",
                note: "Orders recorded · paid and unpaid",
                icon: "arrow",
              },
              {
                label: "Confirmed payments",
                value: "6,870,000",
                note: "Received in the sample ledger",
                icon: "wallet",
              },
              {
                label: "Business expenses",
                value: "2,145,000",
                note: "Includes 1,420,000 product costs",
                icon: "finance",
              },
              {
                label: "Outstanding",
                value: "1,550,000",
                note: "18 sample orders awaiting payment",
                icon: "orders",
              },
            ]}
          />
          <div className="insights-grid">
            <Card>
              <div className="card-heading">
                <div>
                  <h2>Profit &amp; Cash Flow</h2>
                  <p className="muted">
                    Sales, confirmed money received, and estimated profit
                  </p>
                </div>
              </div>
              <CashFlowChart/>
            </Card>
            <Card>
              <div className="card-heading">
                <div>
                  <h2>Expense Breakdown</h2>
                  <p className="muted">
                    Where your sample shop’s money went
                  </p>
                </div>
              </div>
              <ExpenseChart/>
            </Card>
          </div>
          <Card>
            <div className="card-heading">
              <div>
                <h2>Recent Transactions</h2>
                <p className="muted">
                  A glimpse of your sample ledger
                </p>
              </div>
            </div>
            <div className="table-scroll" role="region" aria-label="Sample transactions" tabIndex={0}><table className="data-table"><thead><tr><th scope="col">Transaction</th><th scope="col">Type</th><th scope="col">Date</th><th scope="col">Status</th><th scope="col" className="amount-cell">Amount</th></tr></thead><tbody><tr><td><strong>Order #SS-1048 · Thiri Mon</strong></td><td>Sale</td><td className="muted">Today, 10:32 AM</td><td><span className="status-badge status-warning">Payment needs review</span></td><td className="amount-cell"><strong>45,000</strong><small> MMK</small></td></tr><tr><td><strong>Packaging supplies</strong></td><td>Expense</td><td className="muted">Today, 8:20 AM</td><td><span className="status-badge status-info">Recorded</span></td><td className="amount-cell"><strong>−18,500</strong><small> MMK</small></td></tr></tbody></table></div>
          </Card>
        </>
      )}
    </div>
  );
}
