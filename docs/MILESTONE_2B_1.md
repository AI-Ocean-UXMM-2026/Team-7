# Milestone 2B.1 — Functional Website Experience Recovery

Date: October 21, 2026
Status: Ready for curator verification; local browser and read-only hosted probes completed, authenticated hosted acceptance remains separate.

## Outcome

The existing website recovery work was reviewed and kept within the approved
ocean-blue/Figma Make direction. The Dashboard now has a focused, derived
Needs attention panel beside its single primary trend, and the competing
Dashboard payment/expense summary was removed. Sample recent orders now hand
off directly to the protected Sales route instead of returning to the live
Dashboard.

## Navigation and authentication findings

- Sales is intentionally protected and uses the authenticated live provider;
  opening it while signed out is expected to lead to sign-in.
- The existing auth helpers preserve the requested Sales tab, query, order, and
  shop through sign-in, signup, OAuth callback, and first-shop onboarding.
- Google OAuth is initiated only by the explicit Google button. No normal
  Dashboard, Finance, or Sales navigation path starts Google consent.
- Requested live shops are checked against the authenticated membership list;
  an unauthorized shop is shown as an access error rather than silently falling
  back to another shop.
- A read-only hosted probe confirmed Google is enabled in Supabase Auth, and
  the OAuth authorize endpoint returned the expected Google redirect without
  following it or creating a session. Anonymous REST reads for shops, orders,
  and expenses were denied with permission error `42501`; authenticated
  migration history, sessions, live readback, and cross-shop RLS remain
  unverified. No migration, hosted setting, account, or business record was
  changed during this pass.

## Incremental changes relative to the initial dirty baseline

- `apps/web/src/lib/business/attention.ts` — added a typed presentation helper
  that derives review prompts from the selected period and labels missing live
  receipt/product-cost sources as unavailable.
- `apps/web/src/lib/business/attention.test.ts` — added focused tests for draft,
  payment, fulfillment, and unavailable-source attention states.
- `apps/web/src/components/business-surface.tsx` — added Dashboard Needs
  attention, removed the redundant Dashboard payment/expense card, and corrected
  the sample “Use live order management” destination to `/sales`.
- `apps/web/src/app/globals.css` — added compact attention-panel styles with
  keyboard-visible actions and responsive wrapping.
- `apps/web/package.json` — included the attention regression test in the
  existing website test script.

The pre-existing 2A.1–2A.3 and 2A.3.1 website, auth, order, finance, shared
contract, migration, and Electron changes were preserved. No shared contract,
schema, migration, dependency version, Electron file, or remote state was
changed by this recovery slice.

## Acceptance evidence

### AC-1 — Navigation/auth recovery

Source inspection, the existing auth tests, and a local browser pass confirm
allowlisted internal destinations, shop propagation, membership checks, and
explicit-only Google initiation. The local protected `/sales` and `/workspace`
routes redirect signed-out users to `/login` with the requested destination.
The configured hosted Supabase Auth settings report Google enabled, and a
read-only authorize probe returned a 302 to Google with the Supabase callback
and configured app redirect. No credentials were entered and no session was
created. Authenticated onboarding and cross-shop RLS remain unverified.

### AC-2 — Dashboard hierarchy

The Dashboard continues to render the Good Morning dolphin banner and four
prescribed KPIs. The selected period drives the trend and order attention
items; today’s sales remains explicitly day-scoped. Needs attention is derived
from draft orders, unpaid/partially-paid confirmed orders, unfulfilled
confirmed orders, and unavailable live sources. Recent live orders retain
`/sales?shop=...&order=...` deep links; sample orders remain view-only.

### AC-3 — Finance

The existing Expenses/Reports tabs, date/category filters, validated add/edit
drawer, readback messaging, sample-only session persistence, report definitions,
charts, and unavailable live payment/cost states were retained. The core and
provider tests below cover the locked deterministic calculations.

### AC-4 — Sales

The existing authenticated OrderManager, server actions, membership checks,
validated order edits, readback-backed success, preserved unsaved edits, and
clear Vouchers/Payments unavailable states were not rewritten. Hosted save and
readback remain blocked by unverified migration/session availability.

### AC-5 — Responsive/accessibility

The new attention actions use semantic links/buttons, 44px minimum action
targets, text labels, and the existing focus/reduced-motion rules. A fresh
local browser pass verified the Dashboard at the default desktop viewport and
at 390x844, including the mobile navigation, attention panel, chart, and
recent-order area. Finance Expenses and Reports navigation, Settings, and the
sample order details drawer were also verified. The sample order drawer
clearly says it is view-only and not connected to Supabase. At 390x844 the
expense ledger remains usable through its visible horizontal scroll affordance.

### AC-6 — Checks

- `pnpm --filter @ocean/web test` — PASS, 8 tests. Node reports the existing
  module-type inference warning for TypeScript test files; assertions pass.
- `pnpm --filter @ocean/core test` — PASS, 6 tests.
- `pnpm --filter @ocean/contracts test` — PASS, 5 tests.
- `pnpm lint` — PASS, zero warnings.
- `pnpm typecheck` — PASS for core, UI, contracts, web, and desktop.
- `pnpm build` — first sandboxed attempt reached compilation/TypeScript and hit
  the known `.next` Windows `EPERM`; the required elevated retry PASSed with
  Next.js webpack production output.
- `git diff --check` — PASS; Git may emit existing CRLF normalization notices.

## Known limitations and remaining work

- Full screen-reader, OS text-scaling, physical-device, and independent dark
  theme testing remain outstanding.
- Live Supabase migrations, authentication, order persistence/readback,
  expense persistence/readback, and cross-shop isolation still require curator
  verification with an authorized project/session. The hosted probes only
  establish provider configuration and anonymous access denial; no successful
  live save or authenticated readback is claimed here.
- Vouchers, payment verification, AI extraction, and Electron work remain
  future milestones.

## Curator handoff

This is a terminal implementation report for independent verification. The
curator should inspect the incremental diff and call paths, map the required
acceptance criteria to evidence, and decide whether to accept, request focused
rework, or escalate the remaining authenticated hosted gaps. No commit, push,
remote migration, account creation, business write, or next milestone was
started.
