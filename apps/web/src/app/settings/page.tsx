import type { Metadata } from "next";
import { Card, PageHeading } from "@ocean/ui";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="Your workspace"
        title="Settings"
        description="Your shop details and preferences, together in one place."
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections"><a href="#shop-profile">Shop profile</a><a href="#preferences">Language &amp; currency</a></nav>
        <div className="page-stack">
        <Card>
          <div className="card-heading">
            <div>
              <h2 id="shop-profile">Shop profile</h2>
              <p className="muted">
                The details that make your shop, yours
              </p>
            </div>
            <span className="badge">Sample profile</span>
          </div>
          <div className="settings-fields">
            <label className="settings-field field-full">Shop name<input readOnly value="May Thu’s Shop"/></label>
            <label className="settings-field">Phone number<input readOnly value="09 xxx xxx xxx"/></label>
            <label className="settings-field">Business email<input readOnly value="hello@example.com"/></label>
            <label className="settings-field field-full">Shop address<textarea readOnly value="Hlaing Township, Yangon" rows={3}/></label>
          </div>
          <p className="settings-note">
            These are read-only sample details. Profile saving and account setup aren’t connected.
          </p>
        </Card>
        <Card>
          <div className="card-heading">
            <div>
              <h2 id="preferences">Language &amp; currency</h2>
              <p className="muted">English-first, with room for Burmese</p>
            </div>
          </div>
          <dl className="settings-list">
            <div>
              <dt>Interface language</dt>
              <dd>English</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>Myanmar Kyat (MMK)</dd>
            </div>
            <div>
              <dt>Theme</dt>
              <dd>Ocean blue</dd>
            </div>
          </dl>
          <p className="settings-note">
            English is available. Burmese text is supported in customer chats;
            full interface translation isn’t connected yet.
          </p>
        </Card>
        </div>
      </div>
    </div>
  );
}
