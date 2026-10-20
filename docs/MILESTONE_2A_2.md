# Milestone 2A.2 — Real Order Management

Date: October 20, 2026
Status: Implementation prepared; live database acceptance is blocked.

## Implemented

- Authenticated `/sales` resolves an authorized shop, or accepts a shop selected
  from `/workspace`. The existing shop workspace links to Sales Management.
- Orders are read through the seller's cookie-backed Supabase client with explicit
  shop membership checks and shop filters. Inputs and returned rows use shared Zod
  schemas. The sample dashboard remains a sample screen.
- Search matches full order IDs, customers, phones, and products. Independent
  order/payment/fulfillment filters and date/total sorting are available.
- Responsive list, desktop details drawer, narrow-screen full-screen details,
  customer/contact fields, editable product lines, integer-MMK totals, labels,
  inline blur validation, linked/focused validation summary, unsaved-change prompt,
  pending/error/retry states, and success after database readback.
- Drawer header and save actions remain visible; only the content scrolls. Motion
  uses the existing reduced-motion override. Burmese text wraps without truncation.
- Shared deterministic totals live in `packages/core`; contracts reuse them. The
  only dependency change links this existing workspace, with no new external package.
- Prepared `20261020020000_order_management.sql`: restricted atomic save RPC,
  membership authorization, server-calculated totals, independent statuses,
  same-order serialization, optimistic edit versions, and previous revision snapshots.
  Orders/items retain their existing RLS and direct-write restrictions. Revisions
  have shop-scoped RLS and read-only authenticated grants. No service-role client,
  RLS disabling, or payment-status write was added.
- Stable client-created IDs stop a lost-response retry from creating another order.
  A retry/stale edit reports a conflict and asks for a reload. Each order update
  advances its timestamp, including multiple saves within one transaction.
- Existing customer records are preserved when contact information changes, avoiding
  changes to another order's contact. Existing voucher versions are not modified.

## Files changed by this milestone

- `apps/web/src/app/sales/page.tsx`
- `apps/web/src/app/sales/actions.ts` (new)
- `apps/web/src/components/order-manager.tsx` (new)
- `apps/web/src/components/app-shell.tsx` (Sales labels only)
- `apps/web/src/app/globals.css` (order styles appended)
- `apps/web/src/app/workspace/[shopId]/page.tsx` (Sales entry link)
- `packages/contracts/src/index.ts` (order input/read schemas)
- `packages/contracts/src/index.test.ts` (business validation assertions)
- `packages/contracts/package.json` (existing core workspace dependency)
- `packages/core/src/index.ts` (deterministic totals)
- `pnpm-lock.yaml` (local workspace link only)
- `supabase/migrations/20261020020000_order_management.sql` (new, UNAPPLIED)
- `supabase/tests/order_management.test.sql` (new, NOT EXECUTED)
- `docs/MILESTONE_2A_2.md` (this report)

Pre-existing uncommitted authentication/onboarding changes were retained. The
previous milestone's pending migration was not applied or modified.

## Prerequisites actually checked

- Read AGENTS.md, PRD, architecture, design system, user flows, and test plan; read
  the web-specific Next.js instructions and installed Next.js forms documentation.
- Inspected the published Figma Make Finance screen in the browser. Reused the
  current ocean palette, navy navigation, white cards, and existing components.
- Read the requested ui-ux-pro-max skill. Used its bundled Python searches for
  `error summary validation` (UX) and `forms server actions` (Next.js). Results
  matched web validation/focus and authenticated server-action requirements.
- `supabase migration list --linked`: FAILED. The sandbox initially denied CLI
  telemetry output; an elevated read-only retry reached login-role initialization
  but failed with `DbConfigLoginRoleNetworkError` / `TransportError`. Current hosted
  migration history has NOT been verified.
- Public REST schema probe reached HTTP 401. A more specific read-only probe of
  `/rest/v1/orders?select=id&limit=0` returned HTTP 401, code 42501, permission denied
  for table orders. This confirms endpoint reachability and rejection of anonymous
  access; it does NOT verify authenticated reads, the save RPC, or cross-shop RLS.
- Docker is unavailable. No local PostgreSQL stack or SQL test execution occurred.
- No remote SQL/migrations, hosted order writes, auth admin changes, or account
  creation were performed. No credential values were printed or committed.

## Verification

- Shared contracts: 5 Node tests PASS. New assertions cover Burmese strings,
  quantity edits and totals, empty/oversized lines, fractional/unsafe money,
  excessive discount, invalid quantities/prices, and forbidden payment/total fields.
- Website auth: 3 existing Node tests PASS. Node reports module-type inference
  warnings for TypeScript modules; no failing test assertions.
- Workspace typecheck: PASS for core, UI, contracts, web, and desktop.
- Targeted ESLint: PASS with zero warnings for all changed TypeScript sources.
- Full repository lint: FAIL in existing `.agents/skills` scripts: 15 CommonJS
  require-import errors and one unused-variable warning. Those scripts were not
  rewritten for this milestone.
- Production Next.js webpack build: PASS with filesystem access. The first sandboxed
  attempt failed creating generated `.next/server/app/settings` output (EPERM).
- `git diff --check`: PASS; Git emits CRLF normalization notices.
- Prepared 17 pgTAP assertions for atomic create/edit/readback, calculated totals,
  unpaid defaults, forbidden payment overrides, retry/stale versions, rollback,
  revision isolation, and unauthorized access. These were NOT EXECUTED.

### Synthetic browser checks (not database acceptance)

An isolated, temporary Vite harness imported the real OrderManager component,
shared schemas, and styles. Its save/load actions used synthetic in-memory data;
it had no Supabase client, credentials, production route, or RLS bypass. The
harness was labeled as a synthetic test, stopped, and removed afterward.

Verified: empty state, field labels, failed-submit summary focus and inline errors,
Burmese customer/product rendering, unsaved-dismiss prompt and keep-editing action,
create and open details, edit quantity from 2 to 3, totals changing from 52,000 to
77,000 MMK (25,000 unit price, 3,000 delivery, 1,000 discount), and unpaid status
remaining separate. Inspected 375x812 portrait and 812x375 landscape frames and
fixed footer visibility. These are UI checks only: the component's normal success
text in this harness does not establish any Supabase save or readback.

Reduced-motion behavior was checked in source, not through browser emulation.
Authenticated production UI, full assistive-technology testing, actual network
failure/pending scenarios, and hosted isolation remain unverified.

## Known limitations / remaining acceptance

- The new migration is UNAPPLIED and SQL behavior is unexecuted. Restore database
  connectivity and inspect current hosted migration history first. Review and
  authorize the exact pending migrations before applying them; do not blindly push
  all pending migrations.
- Complete authentication and first-shop prerequisites from Milestone 2A.1.
- Run pgTAP against a local stack with the migrations applied. Then use two actual
  seller test sessions for hosted isolation; passing local tests alone is insufficient.
- In the authenticated application: create an order, confirm it in the list, open
  details, edit quantity/contact/status, save, close/reopen, reload the page, and
  confirm persisted values. Repeat in another session to test stale-edit rejection.
- Search/filter/sort operate on the newest 500 loaded orders, explicitly disclosed
  in the list. Larger-scale pagination is not part of this implementation.
- Orders with any payment status other than unpaid are view-only until a payment
  adjustment workflow is approved. This prevents editing amounts under payment records.
- Revision snapshots are stored by the migration; a revision-history viewer,
  vouchers, payment verification, AI extraction, and finance integration remain
  outside this change. No next milestone was started.
- No commits or pushes were made.

## Dependency verification note

The offline install attempt could not complete because pnpm lacked cached registry
metadata. Checks during workspace linking used
`pnpm --config.verify-deps-before-run=false` to run the already-installed tools.
A subsequent `pnpm install --frozen-lockfile --ignore-scripts` PASS completed the
workspace link and passed pnpm's supply-chain policy check for all 571 existing
lockfile entries. No third-party dependency versions were added or changed.
