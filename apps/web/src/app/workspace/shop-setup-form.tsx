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
      {state?.error && <p className="auth-message error" role="alert">{state.error}</p>}
      <button className="auth-submit" disabled={pending}>
        {pending ? "Creating workspace…" : "Create shop workspace"}
      </button>
    </form>
  );
}
