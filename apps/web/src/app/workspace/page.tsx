import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession, getUserAuthorizedShops } from "@/lib/auth/session";
import { ShopSetupForm } from "./shop-setup-form";
import { SignOutButton } from "./sign-out-button";
import { authDestination, shopDestination } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = authDestination((await searchParams).next ?? null);
  const session = await getCurrentSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const shops = getUserAuthorizedShops(session.userId);

  return (
    <main className="auth-page workspace-page">
      <section className="auth-card workspace-card" aria-labelledby="workspace-title">
        <div className="workspace-actions">
          <p className="eyebrow">MERCHANT WORKSPACE</p>
          <SignOutButton />
        </div>
        <h1 id="workspace-title">Your Shop Workspace</h1>
        <p className="auth-description">
          Connected as <strong>{session.displayName || session.email}</strong>. Select an authorized shop workspace:
        </p>
        {shops.length === 0 ? (
          <div>
            <p className="auth-description" style={{ marginBottom: "16px" }}>
              You do not have an active shop workspace yet. Create your store to get started:
            </p>
            <ShopSetupForm next={next} />
          </div>
        ) : (
          <ul className="shop-list">
            {shops.map((shop) => (
              <li key={shop.shop_id}>
                <Link href={shopDestination(next, shop.shop_id)}>
                  <strong>{shop.shop_name}</strong>
                  <span>{shop.currency} · {shop.is_sample ? "Sample Workspace" : `${shop.role.toUpperCase()} access`}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div style={{ marginTop: "18px" }}>
          <Link href="/" className="auth-secondary" style={{ display: "inline-block" }}>
            ← Return to Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
