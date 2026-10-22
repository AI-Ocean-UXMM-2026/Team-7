import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { uuidSchema } from "@ocean/contracts";
import { getCurrentSession, verifyShopMembership } from "@/lib/auth/session";
import { SignOutButton } from "../sign-out-button";

export const dynamic = "force-dynamic";

export default async function ShopWorkspacePage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = await params;
  const parsedId = uuidSchema.safeParse(shopId);
  if (!parsedId.success) notFound();

  const session = await getCurrentSession();
  if (!session) {
    redirect(`/login?next=/workspace/${parsedId.data}`);
  }

  const membership = verifyShopMembership(session.userId, parsedId.data);
  if (!membership.authorized || !membership.shop) {
    notFound();
  }

  const shop = membership.shop;

  return (
    <main className="auth-page workspace-page">
      <section className="auth-card workspace-card" aria-labelledby="shop-title">
        <div className="workspace-actions">
          <Link className="auth-back" href="/workspace">
            All my shops
          </Link>
          <SignOutButton />
        </div>
        <p className="eyebrow">SHOP WORKSPACE · {shop.currency}</p>
        <h1 id="shop-title">{shop.name}</h1>
        <div className="workspace-message">
          <strong>Your shop workspace is active.</strong>
          <p>
            Manage your shop’s orders with customer details, product lines, and separate order, payment, and fulfillment statuses.
          </p>
          <Link href={`/sales?shop=${parsedId.data}`}>Open Sales Management</Link>
        </div>
        <Link className="auth-back" href="/">
          Return to Dashboard
        </Link>
      </section>
    </main>
  );
}
