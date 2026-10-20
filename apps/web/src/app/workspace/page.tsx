import Link from "next/link";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { ShopSetupForm } from "./shop-setup-form";
import { SignOutButton } from "./sign-out-button";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (typeof userId !== "string") redirect("/login");

  const { data: memberships, error: membershipError } = await supabase
    .from("shop_memberships")
    .select("shop_id, role, created_at")
    .order("created_at", { ascending: true });
  const shopIds = (memberships ?? []).map((membership) => membership.shop_id);
  const { data: shops, error: shopError } = shopIds.length
    ? await supabase.from("shops").select("id, name, currency").in("id", shopIds)
    : { data: [], error: null };
  const workspaceError = membershipError || shopError;
  const missingSchema = ["42P01", "PGRST205"].includes(workspaceError?.code ?? "");
  const shopsById = new Map((shops ?? []).map((shop) => [shop.id, shop]));

  return (
    <main className="auth-page workspace-page">
      <section className="auth-card workspace-card" aria-labelledby="workspace-title">
        <div className="workspace-actions">
          <p className="eyebrow">PRIVATE SELLER WORKSPACE</p>
          <SignOutButton />
        </div>
        <h1 id="workspace-title">Your shop workspace</h1>
        {workspaceError ? (
          <div className="workspace-message" role="status">
            <strong>{missingSchema ? "Business database setup is still required." : "Shop access could not be loaded."}</strong>
            <p>{missingSchema ? "Apply the versioned Supabase migration, then refresh this page. No business data has been created." : "Check the Supabase connection and refresh this page."}</p>
            <Link href="/">Return to sample dashboard</Link>
          </div>
        ) : memberships?.length ? (
          <>
            <p className="auth-description">Choose a shop you belong to, or establish another workspace.</p>
            <ul className="shop-list">
              {memberships.map((membership) => (
                <li key={membership.shop_id}>
                  <Link href={`/workspace/${membership.shop_id}`}>
                    <strong>{shopsById.get(membership.shop_id)?.name ?? "Open shop workspace"}</strong>
                    <span>{shopsById.get(membership.shop_id)?.currency ?? "MMK"} · {membership.role}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <details className="shop-create-details">
              <summary>Create another shop</summary>
              <ShopSetupForm />
            </details>
          </>
        ) : (
          <>
            <p className="auth-description">Create the first shop attached to your account. The setup is saved under your signed-in user.</p>
            <ShopSetupForm />
          </>
        )}
      </section>
    </main>
  );
}
