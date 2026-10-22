"use client";

import { useActionState } from "react";
import { createShopAction } from "../login/actions";

export function ShopSetupForm({ next = "/workspace" }: { next?: string }) {
  const [state, formAction, pending] = useActionState(createShopAction, undefined);

  return (
    <form action={formAction} className="auth-form shop-setup-form">
      <input type="hidden" name="next" value={next}/>
      <label>
        Shop name
        <input name="name" minLength={2} maxLength={120} required placeholder="For example, Thiri's Shop" />
      </label>
      <fieldset className="shop-payment-setup"><legend>First receiving account (optional)</legend><p>Add other wallets or banks later in Settings.</p>
        <label>Payment method<input name="provider" maxLength={80} placeholder="KBZPay, WavePay, bank…" /></label>
        <label>Account holder name<input name="account_name" maxLength={160} /></label>
        <label>Receiving number or account<input name="account_number" maxLength={80} /></label>
      </fieldset>
      {state?.error && <p className="auth-message error" role="alert">{state.error}</p>}
      <button className="auth-submit" disabled={pending}>
        {pending ? "Creating workspace…" : "Create shop workspace"}
      </button>
    </form>
  );
}
