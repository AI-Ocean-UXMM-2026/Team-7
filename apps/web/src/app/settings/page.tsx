import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, PageHeading } from "@ocean/ui";
import { LanguagePreferenceField } from "@/components/shell-language";
import { ReceivingAccounts } from "@/components/receiving-accounts";
import { TeamMembers } from "@/components/team-members";
import { getCurrentSession, getAuthorizedShopSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const { shop } = await searchParams;
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?next=/settings");
  }

  const authSession = await getAuthorizedShopSession(shop);
  if (!authSession) {
    redirect("/workspace?next=%2Fsettings");
  }
  const { shop: currentShop, role } = authSession;

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="Your workspace"
        title="Settings"
        description="Your shop details, team collaboration, and workspace preferences."
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          <a href="#shop-profile">Shop profile</a>
          <a href="#team-management-heading">Team &amp; sharing</a>
          <a href="#receiving-accounts-heading">Receiving accounts</a>
          <a href="#preferences">Language &amp; currency</a>
        </nav>
        <div className="page-stack">
          <Card>
            <div className="card-heading">
              <div>
                <h2 id="shop-profile">Shop profile</h2>
                <p className="muted">Workspace details available to this account.</p>
              </div>
              <span className={`badge ${currentShop.is_sample ? "status-warning" : "status-info"}`}>
                {currentShop.is_sample ? "Sample Workspace" : "Live Workspace"}
              </span>
            </div>
            <dl className="settings-details">
              <div>
                <dt>Shop name</dt>
                <dd>{currentShop.name}</dd>
              </div>
              <div>
                <dt>Account access</dt>
                <dd>{role[0]?.toUpperCase()}{role.slice(1)}</dd>
              </div>
              <div>
                <dt>Currency</dt>
                <dd>{currentShop.currency === "MMK" ? "MMK · Myanmar Kyat" : currentShop.currency}</dd>
              </div>
              <div>
                <dt>Signed in as</dt>
                <dd>{session.email || session.displayName || "Account email unavailable"}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <TeamMembers shopId={currentShop.id} isOwner={role === "owner"} />
          </Card>
          <Card><ReceivingAccounts shopId={currentShop.id} owner={role === "owner"} /></Card>
          <Card>
            <div className="card-heading">
              <div>
                <h2 id="preferences">Language &amp; currency</h2>
                <p className="muted">Language is a browser preference. Currency follows the selected shop.</p>
              </div>
            </div>
            <div className="settings-fields">
              <LanguagePreferenceField />
              <div className="settings-static-value">
                <span>Currency</span>
                <strong>{currentShop.currency === "MMK" ? "MMK · Myanmar Kyat" : currentShop.currency}</strong>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
