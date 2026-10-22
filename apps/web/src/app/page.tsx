import { redirect } from "next/navigation";
import { myanmarDate } from "@ocean/contracts";
import { BusinessSurface } from "@/components/business-surface";
import { DashboardBanner } from "@/components/dashboard-banner";
import { DashboardScrollExperience } from "@/components/dashboard-scroll-experience";
import { getCurrentSession, getAuthorizedShopSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const { shop } = await searchParams;
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?next=/");
  }

  const authShop = await getAuthorizedShopSession(shop);
  if (!authShop) {
    redirect("/workspace");
  }

  const shopId = authShop.shop.id;

  return (
    <div className="page-stack dashboard-anchor-canvas">
      <DashboardScrollExperience />
      <DashboardBanner userName={authShop.user.displayName || "Seller"} shopId={shopId} />
      <BusinessSurface
        key={shopId}
        source={authShop.shop.is_sample ? "sample" : "live"}
        shopId={shopId}
        today={myanmarDate(new Date().toISOString())}
      />
    </div>
  );
}
