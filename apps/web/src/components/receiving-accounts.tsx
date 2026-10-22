"use client";

import { useEffect, useState } from "react";

export type PublicReceivingAccount = { id: string; provider: string; account_name: string; last_four: string };

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
    setBusy(true);
    try {
      const response = await fetch("/api/shop-receiving-accounts", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ shop_id: shopId, provider, account_name: name, account_number: number }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Account could not be saved.");
      setProvider(""); setName(""); setNumber("");
      await load();
      setNotice("Receiving account saved.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Account could not be saved."); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/shop-receiving-accounts", { method: "DELETE", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ shop_id: shopId, id }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Account could not be removed.");
      await load(); setNotice("Receiving account removed.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Account could not be removed."); }
    finally { setBusy(false); }
  }

  return <section aria-labelledby="receiving-accounts-heading">
    <div className="card-heading"><div><h2 id="receiving-accounts-heading">Receiving accounts</h2><p className="muted">Save each wallet or bank account that customers can pay. Receipt comparisons are advisory; check the real account record before confirming money.</p></div></div>
    <div className="receiving-account-list">{accounts.length ? accounts.map(account => <div className="receiving-account-row" key={account.id}><span><strong>{account.provider}</strong> · {account.account_name} · ending {account.last_four || "unknown"}</span>{owner && <button type="button" disabled={busy} onClick={() => void remove(account.id)}>Remove</button>}</div>) : <p className="muted">No receiving accounts saved yet.</p>}</div>
    {owner && <form className="receiving-account-form" onSubmit={event => void add(event)}><label>Payment method<input required maxLength={80} value={provider} onChange={event => setProvider(event.target.value)} placeholder="KBZPay, WavePay, AYA Pay, bank…" /></label><label>Account holder name<input required maxLength={160} value={name} onChange={event => setName(event.target.value)} /></label><label>Receiving number or account<input required maxLength={80} value={number} onChange={event => setNumber(event.target.value)} /></label><button type="submit" disabled={busy}>Add receiving account</button></form>}
    {notice && <p role="status" className="settings-note">{notice}</p>}
  </section>;
}
