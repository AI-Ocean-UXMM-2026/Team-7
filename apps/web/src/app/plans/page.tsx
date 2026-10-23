import type { Metadata } from "next";
import { getAuthorizedShopSession } from "@/lib/auth/session";
import { PlansView } from "@/components/plans-view";

export const metadata: Metadata = {
  title: "Subscription Plans · တူတူတွက်မယ်",
  description: "Freemium SaaS plans for Myanmar Facebook and TikTok sellers. Upgrade to Pro or Team with KBZPay.",
};

export const dynamic = "force-dynamic";

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const { shop } = await searchParams;
  const authSession = await getAuthorizedShopSession(shop);

  const shopName = authSession?.shop?.name || "တူတူတွက်မယ် Shop";
  const shopId = authSession?.shop?.id || shop || undefined;

  return (
    <div className="page-stack">
      <PlansView shopId={shopId} shopName={shopName} />
    </div>
  );
}
