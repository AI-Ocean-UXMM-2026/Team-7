import type { Metadata } from "next";
import { Card, PageHeading, Placeholder } from "@ocean/ui";
import { SectionNav } from "@/components/section-nav";
import { OrdersTable } from "@/components/orders-table";

export const metadata: Metadata = { title: "Sales Management" };
const sections = {
  orders: {
    title: "A home for every order",
    description:
      "Explore your sample orders. Your shop’s live records will appear once connected.",
  },
  vouchers: {
    title: "A clear record for every sale",
    description:
      "Your vouchers will be organized here. Creating, downloading, and sending vouchers isn’t connected in this sample workspace.",
  },
  payments: {
    title: "A clear view of your payments",
    description:
      "Payment recording isn’t connected. In the desktop assistant, explore a sample screenshot review. Always check trusted records before confirming received funds.",
  },
};

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { tab, q } = await searchParams;
  const selected = tab === "vouchers" || tab === "payments" ? tab : "orders";
  const content = sections[selected];
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="Sales workspace"
        title="Sales Management"
        description="A tidy place for your orders, vouchers, and payments."
      />
      <SectionNav
        label="Sales sections"
        selected={selected}
        items={[
          { key: "orders", label: "Orders", href: "/sales" },
          { key: "vouchers", label: "Vouchers", href: "/sales?tab=vouchers" },
          { key: "payments", label: "Payments", href: "/sales?tab=payments" },
        ]}
      />
      {selected === "orders" ? <Card className="orders-card"><OrdersTable key={q ?? ""} searchable initialQuery={q ?? ""}/></Card> : <Placeholder title={content.title}>{content.description}</Placeholder>}
    </div>
  );
}
