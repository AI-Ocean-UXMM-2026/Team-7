import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeading } from "@ocean/ui";
import { SectionNav } from "@/components/section-nav";
import { OrderManager } from "@/components/order-manager";
import { VouchersView } from "@/components/vouchers-view";
import { PaymentsView } from "@/components/payments-view";
import { getPaymentEvidenceReviews, getPayments } from "@/lib/db";
import { getCurrentSession, getAuthorizedShopSession, getUserAuthorizedShops } from "@/lib/auth/session";
import { loadOrders } from "./actions";

export const metadata: Metadata = { title: "Sales Management" };
export const dynamic = "force-dynamic";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; shop?: string; order?: string }>;
}) {
  const { tab, q, shop: requestedShop, order: initialOrderId } = await searchParams;

  const session = await getCurrentSession();
  if (!session) {
    redirect(`/login?next=/sales`);
  }

  const authSession = await getAuthorizedShopSession(requestedShop);
  if (!authSession) {
    redirect("/workspace");
  }

  const shopId = authSession.shop.id;
  const shop = authSession.shop;
  const allShops = getUserAuthorizedShops(session.userId);
  const otherShops = allShops.filter((s) => s.shop_id !== shopId);

  const selected = tab === "vouchers" || tab === "payments" ? tab : "orders";
  const initial = await loadOrders(shopId);
  const orders = initial.orders ?? [];
  const payments = selected === "payments" ? JSON.parse(JSON.stringify(getPayments(shopId, session.userId))) : [];
  const evidenceReviews = selected === "payments" ? JSON.parse(JSON.stringify(getPaymentEvidenceReviews(shopId, session.userId))) : [];

  return (
    <div className="page-stack">
      {shop.is_sample && (
        <div className="sample-workspace-banner">
          <div>
            <strong>Sample Workspace:</strong> Viewing synthetic demonstration orders.
          </div>
          <span className="status-badge status-warning">Sample Mode</span>
        </div>
      )}
      <PageHeading
        eyebrow={shop.name}
        title="Sales Management"
        description="Manage orders, vouchers, and payment reviews in one place."
      />
      <SectionNav
        label="Sales sections"
        selected={selected}
        items={[
          { key: "orders", label: "Orders", href: `/sales?shop=${shopId}` },
          { key: "vouchers", label: "Vouchers", href: `/sales?tab=vouchers&shop=${shopId}` },
          { key: "payments", label: "Payments", href: `/sales?tab=payments&shop=${shopId}` },
        ]}
      />
      {selected === "orders" ? (
        <OrderManager
          key={`${shopId}:${initialOrderId ?? ""}`}
          shopId={shopId}
          initial={initial}
          initialQuery={q ?? ""}
          initialOrderId={initialOrderId}
        />
      ) : selected === "vouchers" ? (
        <VouchersView orders={orders} />
      ) : (
        <PaymentsView
          payments={payments}
          orders={orders}
          evidenceReviews={evidenceReviews}
          currentShopName={shop.name}
          otherShops={otherShops.map((s) => ({ shop_id: s.shop_id, name: s.shop_name }))}
        />
      )}
    </div>
  );
}
