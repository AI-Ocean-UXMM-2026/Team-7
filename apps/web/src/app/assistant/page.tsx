import { redirect } from "next/navigation";
import { HostedAssistantPanel } from "./assistant-panel";
import { getAuthorizedShopSession } from "@/lib/auth/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Assistant" };

export const dynamic = "force-dynamic";

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; view?: string }>;
}) {
  const { shop: requestedShop, view } = await searchParams;
  const authorized = await getAuthorizedShopSession(requestedShop);
  if (!authorized) {
    const next = new URLSearchParams();
    if (requestedShop) next.set("shop", requestedShop);
    if (view === "match") next.set("view", "match");
    redirect(`/assistant/login?next=${encodeURIComponent(`/assistant${next.size ? `?${next.toString()}` : ""}`)}`);
  }

  return <HostedAssistantPanel shopId={authorized.shop.id} shopName={authorized.shop.name} initialView={view === "match" ? "match" : "home"} />;
}
