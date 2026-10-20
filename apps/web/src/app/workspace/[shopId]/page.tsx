import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { uuidSchema } from "@ocean/contracts";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "../sign-out-button";

export const dynamic = "force-dynamic";

export default async function ShopWorkspacePage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  if (!isSupabaseConfigured()) redirect("/login");
  const { shopId } = await params;
  const parsedId = uuidSchema.safeParse(shopId);
  if (!parsedId.success) notFound();

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== "string") redirect("/login");

  const { data: shop, error } = await supabase
    .from("shops")
    .select("id, name, currency")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (error || !shop) notFound();

  return (
    <main className="auth-page workspace-page">
      <section className="auth-card workspace-card" aria-labelledby="shop-title">
        <div className="workspace-actions">
          <Link className="auth-back" href="/workspace">All my shops</Link>
          <SignOutButton />
        </div>
        <p className="eyebrow">PRIVATE SHOP WORKSPACE · {shop.currency}</p>
        <h1 id="shop-title">{shop.name}</h1>
        <div className="workspace-message">
          <strong>Your shop workspace is established.</strong>
          <p>Manage your shop’s orders with customer details, product lines, and separate order, payment, and fulfillment statuses.</p>
          <Link href={`/sales?shop=${parsedId.data}`}>Open Sales Management</Link>
        </div>
        <Link className="auth-back" href="/">Return to sample dashboard</Link>
      </section>
    </main>
  );
}
