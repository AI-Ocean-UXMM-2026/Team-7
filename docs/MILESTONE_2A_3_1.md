# Milestone 2A.3.1 — Website UX and functional recovery

## Checkpoint 1: audit and navigation/auth repairs

Status: checkpoint in progress; not a completed recovery milestone. Checkpoints
2–4 and Milestone 2B have not started. Existing uncommitted 2A.1–2A.3 work was
inspected and preserved. No remote SQL, migrations, account creation or business
writes were performed.

### Confirmed findings

- Dashboard and Finance default to a public sample provider. Sales is deliberately
  authenticated and uses the live order provider. Entering Sales while signed out
  should request sign-in; this alone is not a broken session or OAuth loop.
- Sales previously redirected to login without its tab, search, order or shop.
  Login always sent an existing/successful session to `/workspace`; the callback
  accepted only recovery or workspace destinations. Google OAuth is only initiated
  by the explicit Google button; no inspected navigation code forces consent.
- First-shop setup discarded the destination. Sidebar brand/mobile-home links
  dropped live mode; Settings and global search dropped selected-shop context.
  Account labels were inferred from page pathname rather than actual auth state.
- An invalid or unauthorized requested Sales shop could silently fall back to the
  account's only shop. It now produces a clear access error instead.
- Cookie-backed SSR clients and proxy refresh already exist. Source inspection
  did not prove a cookie-persistence defect. An actual expired/revoked session,
  missing cookie, provider mismatch or callback-port issue still needs live proof.
- The existing OrderManager, save action, membership checks, validated readback,
  error-preserving drawer and atomic `save_shop_order` RPC path remain intact.
  Live save/readback has not been demonstrated by the current evidence.
- The finance handoff documents unconnected live payments/COGS and current-order
  summaries that include delivery and use creation dates. These differ from the
  interview's intended pass-through/confirmation-date accounting rules. Do not
  relabel these as finalized accounting results; resolve their definitions before
  Checkpoint 2 changes calculations or chart labels.

### Backend status / approval boundary

Read-only `pnpm exec supabase migration list` reached login-role initialization
but failed with `DbConfigLoginRoleNetworkError` / `TransportError`, even with the
required local CLI access. This is a network blocker, not proof a migration is
missing. Current remote deployment and hosted RLS acceptance remain UNVERIFIED.

Local files include:

- `20261020000000_business_foundation.sql`
- `20261020010000_single_shop_onboarding.sql`
- `20261020020000_order_management.sql`

The last migration defines `save_shop_order` and `order_revisions`. The save path
performs a scoped delete/replacement of an edited order's item rows inside the
transaction after capturing a revision. It is not a migration-wide data purge,
but must be included in the eventual migration review. No SQL was applied here.

Next safe steps: repeat migration history from the user's authenticated terminal;
review any missing migrations and grants/RLS/transaction behavior; obtain explicit
approval before applying; then verify real save/readback and two-account isolation.
Do not return fabricated save success or relax database authorization.

### Minimal changes made

- Allowlist local post-auth destinations and known query parameters. Drop external
  URLs, backslashes, control characters, unknown routes and secret query fields.
- Preserve destination through email login, signup, Google initiation/callback,
  callback failure, and first-shop selection/creation. Membership authorization
  remains at destination pages/actions; a redirect never grants shop access.
- Explain why protected Sales requires sign-in. Preserve signup/signin context.
- Keep selected shop across sidebar/mobile navigation, brand links, Settings,
  and global order search. Use a neutral `My shop / sign in` account entry.
- Route `Use my live shop` and live-data recovery through authenticated onboarding
  with the intended Dashboard/Finance destination; no silent sample fallback.
- Preserve public sample access and the existing OrderManager/backend operations.

### Files changed in this checkpoint

- `apps/web/src/lib/auth.ts` and `auth.test.ts`
- `apps/web/src/app/auth/confirm/route.ts`
- `apps/web/src/app/login/actions.ts`, `auth-form.tsx`, `page.tsx`, `signup/page.tsx`
- `apps/web/src/app/workspace/page.tsx`, `shop-setup-form.tsx`
- `apps/web/src/app/sales/page.tsx`
- `apps/web/src/components/app-shell.tsx`, `business-surface.tsx` (links only)
- This report. Next.js may regenerate its existing `next-env.d.ts`.

### Inspection and verification

Read project guidance, milestone handoffs, routes, auth/proxy, selected-shop links,
order actions/manager, business-provider boundaries and migration entry points.
Applied the installed ui-ux-pro-max navigation/accessibility Quick Reference;
its optional CLI search could not run because no Python runtime is installed.
No Python/dependencies were installed.

Inspected the published Figma Make Dashboard and navigation in the browser.
No visual-system replacement or dashboard/finance layout changes were made.

Automated redirect tests cover external/encoded/control-character destinations,
secret-query stripping, intended Sales tab/search/shop preservation and onboarding
shop propagation. These are not a substitute for a completed OAuth session.

Browser and final check results will be recorded below. Full signed-in navigation,
Google callback, shop setup, database persistence and cross-shop RLS remain unverified
until actually exercised. Responsive checks belong to Checkpoint 4.
