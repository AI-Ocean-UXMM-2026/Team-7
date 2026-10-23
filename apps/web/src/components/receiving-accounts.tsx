"use client";

import { useEffect, useState } from "react";

export type PublicReceivingAccount = { id: string; provider: string; account_name: string; last_four: string };

const POPULAR_PROVIDERS = [
  { name: "KBZPay", icon: "💳" },
  { name: "WavePay", icon: "🟡" },
  { name: "AYA Pay", icon: "🔴" },
  { name: "CB Pay", icon: "🏦" },
  { name: "KBZ Bank", icon: "🏛️" },
  { name: "Cash on Delivery", icon: "💵" },
];

export function ReceivingAccounts({ shopId, owner }: { shopId: string; owner: boolean }) {
  const [accounts, setAccounts] = useState<PublicReceivingAccount[]>([]);
  const [provider, setProvider] = useState("");
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch(`/api/shop-receiving-accounts?shop_id=${encodeURIComponent(shopId)}`, { credentials: "same-origin" });
    const result = await response.json() as { accounts?: PublicReceivingAccount[]; error?: string };
    if (!response.ok) throw new Error(result.error ?? "Receiving accounts could not be loaded.");
    setAccounts(result.accounts ?? []);
  }

  useEffect(() => { void load().catch(error => setNotice(error instanceof Error ? error.message : "Receiving accounts could not be loaded.")); }, [shopId]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!provider.trim()) {
      setNotice("Select or type a payment method.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/shop-receiving-accounts", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ shop_id: shopId, provider: provider.trim(), account_name: name.trim(), account_number: number.trim() }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Account could not be saved.");
      setProvider(""); setName(""); setNumber("");
      await load();
      setNotice("✓ Receiving account saved successfully.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Account could not be saved."); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/shop-receiving-accounts", { method: "DELETE", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ shop_id: shopId, id }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Account could not be removed.");
      await load(); setNotice("✓ Receiving account removed.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Account could not be removed."); }
    finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="receiving-accounts-heading">
      <div className="card-heading">
        <div>
          <h2 id="receiving-accounts-heading">Receiving accounts</h2>
          <p className="muted">
            Save each mobile wallet or bank account where customers can transfer money. Receipt verification will cross-check these accounts.
          </p>
        </div>
      </div>

      <div className="receiving-account-list">
        {accounts.length ? (
          accounts.map(account => (
            <div className="receiving-account-row" key={account.id}>
              <div className="receiving-account-info">
                <span className="account-provider-badge">
                  {account.provider}
                </span>
                <span className="account-holder">
                  <strong>{account.account_name}</strong>
                  <small>ending {account.last_four || "••••"}</small>
                </span>
              </div>
              {owner && (
                <button
                  type="button"
                  className="account-remove-btn"
                  disabled={busy}
                  onClick={() => void remove(account.id)}
                  title="Remove account"
                >
                  Remove
                </button>
              )}
            </div>
          ))
        ) : (
          <p className="muted empty-accounts-note">No receiving accounts saved yet. Add your KBZPay, WavePay or Bank account below.</p>
        )}
      </div>

      {owner && (
        <form className="receiving-account-form" onSubmit={event => void add(event)}>
          <div className="form-group-block">
            <span className="form-group-title">Select Payment Provider</span>
            <div className="payment-pills-row" role="group" aria-label="Quick select payment provider">
              {POPULAR_PROVIDERS.map(p => {
                const isSelected = provider === p.name;
                return (
                  <button
                    key={p.name}
                    type="button"
                    className={`payment-pill-btn${isSelected ? " is-selected" : ""}`}
                    onClick={() => setProvider(p.name)}
                  >
                    <span aria-hidden="true">{p.icon}</span>
                    <span>{p.name}</span>
                    {isSelected && <span className="pill-check-dot">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-inputs-grid">
            <label className="form-input-label">
              <span>Payment method name</span>
              <input
                required
                maxLength={80}
                value={provider}
                onChange={event => setProvider(event.target.value)}
                placeholder="e.g. KBZPay, WavePay, AYA Pay…"
              />
            </label>
            <label className="form-input-label">
              <span>Account holder name</span>
              <input
                required
                maxLength={160}
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="e.g. Daw Aye Aye Win"
              />
            </label>
            <label className="form-input-label">
              <span>Account number or phone</span>
              <input
                required
                maxLength={80}
                value={number}
                onChange={event => setNumber(event.target.value)}
                placeholder="e.g. 09444333222 or 1234 5678…"
              />
            </label>
          </div>

          <button type="submit" className="primary-button add-account-submit" disabled={busy || !provider.trim() || !name.trim() || !number.trim()}>
            {busy ? "Saving Account…" : "+ Add receiving account"}
          </button>
        </form>
      )}

      {notice && <p role="status" className="settings-note">{notice}</p>}
    </section>
  );
}
