import Image from "next/image";
import Link from "next/link";
import { Card } from "@ocean/ui";
import { Metrics } from "@/components/metrics";
import { OrdersTable } from "@/components/orders-table";
import { SalesChart } from "@/components/sample-charts";
import dolphin from "../../../../assets/dolphin/dolphin-accountant.png";

export default function DashboardPage() {
  return (
    <div className="page-stack">
      <section className="welcome-banner" aria-labelledby="dashboard-heading">
        <div className="welcome-copy">
          <p className="eyebrow">Your business at a glance</p>
          <h1 id="dashboard-heading">Good morning, May Thu!</h1>
          <p>
            Your shop is making waves today.
            <br />
            Here’s a little clarity for the day ahead.
          </p>
          <Link href="/sales" className="banner-link">
            Explore your workspace <span aria-hidden="true">→</span>
          </Link>
        </div>
        <Image
          className="welcome-dolphin"
          src={dolphin}
          alt="Blue dolphin accountant wearing glasses, holding a calculator and financial clipboard"
          priority
          sizes="(max-width: 600px) 130px, 230px"
        />
      </section>
      <Metrics
        items={[
          {
            label: "Today’s Sales",
            value: "486,500",
            note: "Recorded sales today",
            icon: "arrow",
          },
          {
            label: "Payments Received",
            value: "354,000",
            note: "Received in the sample ledger",
            icon: "wallet",
          },
          {
            label: "Estimated Profit",
            value: "128,400",
            note: "After costs · not cash received",
            icon: "finance",
          },
          {
            label: "Total Orders",
            value: "14",
            note: "3 new orders today",
            icon: "orders",
            currency: false,
          },
        ]}
      />
      <div className="insights-grid">
        <Card>
          <div className="card-heading">
            <div>
              <h2>Sales Overview</h2>
              <p className="muted">
                Recorded sales performance over time
              </p>
            </div>
            <span className="badge">Sample week</span>
          </div>
          <div className="chart-total"><span>Recorded sales</span><strong>3,016,500 <small>MMK</small></strong><p>Illustrative weekly performance</p></div>
          <SalesChart/>
        </Card>
        <Card>
          <div className="card-heading">
            <div>
              <h2>Recent Activity</h2>
              <p className="muted">A little momentum for your day</p>
            </div>
          </div>
          <ul className="activity-list">
            <li><span className="activity-mark status-info" aria-hidden="true">↗</span><div><strong>Order ready for review</strong><p>#SS-1048 · Thiri Mon · 45,000 MMK</p></div><small>2m</small></li>
            <li><span className="activity-mark status-warning" aria-hidden="true">!</span><div><strong>Payment needs review</strong><p>Sample screenshot for #SS-1048</p></div><small>5m</small></li>
            <li><span className="activity-mark status-success" aria-hidden="true">✓</span><div><strong>Order shipped</strong><p>#SS-1046 · Aye Thandar</p></div><small>1h</small></li>
            <li><span className="activity-mark status-neutral" aria-hidden="true">−</span><div><strong>Expense recorded</strong><p>Packaging · 18,500 MMK</p></div><small>2h</small></li>
          </ul>
          <Link href="/sales" className="text-link activity-link">Explore sample orders <span aria-hidden="true">→</span></Link>
        </Card>
      </div>
      <Card>
        <div className="card-heading">
          <div>
            <h2>Recent Orders</h2>
            <p className="muted">The latest orders in your sample shop</p>
          </div>
          <Link href="/sales" className="text-link">
            View orders <span aria-hidden="true">→</span>
          </Link>
        </div>
        <OrdersTable/>
      </Card>
    </div>
  );
}
