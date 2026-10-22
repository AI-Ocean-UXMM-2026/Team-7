import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeading } from "@ocean/ui";
import { myanmarDate } from "@ocean/contracts";
import { BusinessSurface } from "@/components/business-surface";
import { getCurrentSession, getAuthorizedShopSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Finance Management" };
export const dynamic = "force-dynamic";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; shop?: string }>;
}) {
  const { tab, shop } = await searchParams;
  const session = await getCurrentSession();
  if (!session) {
    redirect(`/login?next=/finance`);
  }

  const authSession = await getAuthorizedShopSession(shop);
  if (!authSession) {
    redirect("/workspace");
  }

  const shopId = authSession.shop.id;

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow={authSession.shop.name}
        title="Finance Management"
        description="Understand what you sold, received, spent, and earned."
      />
      <BusinessSurface
        key={`${shopId}:${tab ?? "reports"}`}
        source={authSession.shop.is_sample ? "sample" : "live"}
        shopId={shopId}
        today={myanmarDate(new Date().toISOString())}
        finance
        tab={tab === "expenses" ? "expenses" : "reports"}
      />
    </div>
  );
}
