import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading, Placeholder } from "@ocean/ui";
import { uuidSchema } from "@ocean/contracts";
import { SectionNav } from "@/components/section-nav";
import { OrderManager } from "@/components/order-manager";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { loadOrders } from "./actions";
import { signInHref } from "@/lib/auth";

export const metadata: Metadata = { title: "Sales Management" };
export const dynamic = "force-dynamic";

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; shop?: string; order?: string }> }) {
  const { tab, q, shop: requestedShop, order: initialOrderId } = await searchParams;
  const target = `/sales?${new URLSearchParams({ ...(tab ? { tab } : {}), ...(q ? { q } : {}), ...(requestedShop ? { shop: requestedShop } : {}), ...(initialOrderId ? { order: initialOrderId } : {}) })}`;
  if (!isSupabaseConfigured()) redirect(signInHref(target));
  const db = await createClient();
  const { data: auth } = await db.auth.getClaims();
  if (!auth?.claims?.sub) redirect(signInHref(target));
  const { data: memberships, error } = await db.from("shop_memberships").select("shop_id").eq("user_id", auth.claims.sub);
  if (error) return <Placeholder title="Shop access unavailable">Check your connection and <Link href="/workspace">open your workspace</Link> to retry.</Placeholder>;
  const shopId = requestedShop && uuidSchema.safeParse(requestedShop).success && memberships?.some(m => m.shop_id === requestedShop)
    ? requestedShop : memberships?.length === 1 ? memberships[0]?.shop_id : undefined;
  if (requestedShop && !memberships?.some(m => m.shop_id === requestedShop)) return <Placeholder title="Shop access unavailable">This account cannot access the requested shop. <Link href="/workspace">Open your authorized workspace</Link>.</Placeholder>;
  if (!shopId) redirect(`/workspace?${new URLSearchParams({ next: target })}`);
  const { data: shop } = await db.from("shops").select("name").eq("id", shopId).maybeSingle();
  const selected = tab === "vouchers" || tab === "payments" ? tab : "orders";
  const initial = selected === "orders" ? await loadOrders(shopId) : {};
  return <div className="page-stack">
    <PageHeading eyebrow={shop?.name ?? "Your shop"} title="Sales Management" description="Keep every order clear, from the first item to delivery." />
    <SectionNav label="Sales sections" selected={selected} items={[
      { key: "orders", label: "Orders", href: `/sales?shop=${shopId}` },
      { key: "vouchers", label: "Vouchers", href: `/sales?tab=vouchers&shop=${shopId}` },
      { key: "payments", label: "Payments", href: `/sales?tab=payments&shop=${shopId}` },
    ]}/>
    {selected === "orders" ? <OrderManager key={`${shopId}:${initialOrderId ?? ""}`} shopId={shopId} initial={initial} initialQuery={q ?? ""} initialOrderId={initialOrderId}/> : <Placeholder title={selected === "vouchers" ? "Vouchers" : "Payments"}>This workflow will be connected in a later milestone. Order saving never verifies a payment.</Placeholder>}
  </div>;
}
