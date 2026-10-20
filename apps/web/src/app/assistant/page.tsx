import Link from "next/link";
import { redirect } from "next/navigation";
import { uuidSchema } from "@ocean/contracts";
import { HostedAssistantPanel } from "./assistant-panel";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assistantDestination, assistantSignInHref } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ shop?: string }> }) {
  const { shop: requestedShop } = await searchParams;
  const safeRequestedShop = requestedShop && uuidSchema.safeParse(requestedShop).success ? requestedShop : undefined;
  const target = assistantDestination(`/assistant${safeRequestedShop ? `?shop=${safeRequestedShop}` : ""}`);
  if (!isSupabaseConfigured()) redirect(`${assistantSignInHref(target)}&auth=configuration`);

  const db = await createClient();
  const { data: auth } = await db.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (typeof userId !== "string") redirect(assistantSignInHref(target));

  const { data: memberships, error: membershipError } = await db
    .from("shop_memberships")
    .select("shop_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (membershipError) return <AssistantGate title="Shop access unavailable">Check the connection and <Link href="/workspace">open your workspace</Link> to retry.</AssistantGate>;
  if (!memberships?.length) return <AssistantGate title="Set up your shop first">Create or connect a shop in your private workspace before opening the hosted assistant. <Link href={`/workspace?next=${encodeURIComponent(target)}`}>Open workspace</Link>.</AssistantGate>;
  if (requestedShop && (!safeRequestedShop || !memberships.some(membership => membership.shop_id === safeRequestedShop))) {
    return <AssistantGate title="Shop access unavailable">This account cannot access the requested shop. <Link href="/workspace">Open your authorized workspace</Link>.</AssistantGate>;
  }

  const shopId = safeRequestedShop && memberships.some(membership => membership.shop_id === safeRequestedShop)
    ? safeRequestedShop
    : memberships.length === 1 ? memberships[0]?.shop_id : undefined;
  if (!shopId) {
    const { data: shops } = await db.from("shops").select("id, name, currency").in("id", memberships.map(membership => membership.shop_id));
    const shopsById = new Map((shops ?? []).map(shop => [shop.id, shop]));
    return <AssistantGate title="Choose your shop"><p>Select the authorized shop for this hosted assistant session.</p><ul className="hosted-shop-list">{memberships.map(membership => <li key={membership.shop_id}><Link href={`/assistant?shop=${membership.shop_id}`}><strong>{shopsById.get(membership.shop_id)?.name ?? "Open shop"}</strong><span>{shopsById.get(membership.shop_id)?.currency ?? "MMK"} · {membership.role}</span></Link></li>)}</ul></AssistantGate>;
  }

  const { data: shop } = await db.from("shops").select("name").eq("id", shopId).maybeSingle();
  return <HostedAssistantPanel shopId={shopId} shopName={shop?.name ?? "Your shop"} />;
}

function AssistantGate({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="hosted-assistant-gate"><section className="hosted-gate-card"><span className="eyebrow">PRIVATE HOSTED ASSISTANT</span><h1>{title}</h1><div className="hosted-gate-copy">{children}</div><Link className="hosted-secondary-button" href="/">Return to sample dashboard</Link></section></main>;
}
