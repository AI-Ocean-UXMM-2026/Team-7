# Milestone 2A.3 — Complete Website Surface

Date: October 20, 2026
Status: Dashboard and Finance surfaces implemented and verified in sample mode.
Live database acceptance remains separate and unverified; no migration was applied.

## Delivered

### Dashboard

- Preserved the existing Good Morning banner, approved dolphin, dimensions,
  responsive styling, and workspace link behavior. Live mode omits the sample
  seller's name rather than inventing an authenticated identity.
- Four calculated KPIs: Today's Sales, Payments Received, Estimated Profit,
  and Total Orders. Today's Sales always uses the displayed Myanmar date;
  the other three follow the selected period, explicitly stated beside the filters.
- Today, 7-day, 30-day, current-month, and custom date filters; responsive sales
  trend, payment/expense summaries, recent orders, and populated/loading/error/empty states.
- Recent sample orders open the existing order drawer read-only, with an explicit
  sample notice. Live recent orders link to `/sales?shop=...&order=...`, which
  selects the same existing order interface. No sample order save path was added.
- KPI layout uses the existing container-responsive grid, adapting to expanded
  and collapsed sidebars and mobile navigation.

### Finance

- Expenses and Reports tabs, category-filtered expense ledger, add/edit expense
  drawer with visible labels, integer-MMK validation, inline blur errors, focused
  linked error summary, saving/error/success states, and unsaved-dismiss protection.
- Sample expense edits use a sample-only session-storage key. They survive
  navigation/reloads in that browser tab, update financial totals and charts,
  and explicitly report that Supabase was not used. Reset is a separate,
  confirmed sample-only action. Corrupt/unavailable storage raises an error.
- Expense breakdown, sales/receipts/profit chart, calendar-month summary with its
  own month selector, and detailed financial records filtered by report dates.
- The expense category selector filters the ledger and its subtotal. Charts and
  period KPIs cover all categories in the selected date range.
- Monthly summary dates are independent of report dates and are labeled accordingly.

### Data boundary and calculations

- `BusinessProvider` exposes typed `load` and `saveExpense` operations.
- Sample provider owns synthetic typed orders, expenses, explicit payment entries,
  and catalogue product costs. It imports no Supabase client or persistence action.
- Live adapter reuses the existing authenticated `loadOrders` implementation and
  cookie-backed Supabase client. Membership is verified for each read/write, all
  business queries include the shop ID, and expenses use shared Zod input/output
  validation. No service-role client or RLS changes were introduced.
- Live mode is explicit. Failed live requests show an error and retry/sign-in
  actions, never a silent sample-data fallback. The selected live source/shop is
  preserved in Dashboard/Finance sidebar and mobile links.
- Live payments and order product costs are not connected: they remain unavailable,
  rather than being guessed from order status or selling prices. Sample catalogue
  costs are explicit synthetic facts, independent of real shop data.
- Reports refuse incomplete live snapshots if the current provider exceeds 500
  orders or expenses; partial totals are not presented as complete shop totals.
- Shared deterministic calculations live in `packages/core`; the UI consumes their
  results rather than implementing financial arithmetic in components.

## Financial definitions

- Recorded sales: current confirmed order totals, grouped by order creation date
  in Myanmar time; discounts are already deducted and charged delivery is included.
  Draft/cancelled orders are excluded. Figures are explicitly **before refunds**.
- Payments received: explicit confirmed payment-ledger entries grouped by receipt
  date. Pending entries and unpaid orders never count as received money. Receipt
  totals are not assumed to equal sales recorded in the same period.
- Operating expenses: dated expenses outside the `Product costs` category.
- `Product costs` expense entries represent inventory purchases/spending, separate
  from costs consumed by confirmed orders. They are not deducted a second time.
- Estimated profit: recorded sales minus known costs for the eligible orders minus
  operating expenses dated in the period. Negative values are allowed. Unknown
  order costs or refunded eligible orders make profit unavailable; refund amounts
  and cost recoveries are not invented. Profit is not cash received.
- These are current-order operational summaries, not an immutable accounting ledger.
  No refund, payment-verification, voucher, or financial-posting workflow was added.
- All monetary inputs and aggregate outputs enforce safe integer MMK. Invalid dates,
  reversed ranges, overlong ranges (more than 367 days), and unsafe totals fail visibly.

## Charting decision

No chart library was installed: old sample charts were fixed SVG/CSS presentation
components. `docs/ARCHITECTURE.md` explicitly specifies Recharts, providing the
requested architectural reason to use Recharts instead of adding Chart.js.

Added only Recharts 3.10.1 and its matching React peer `react-is` 19.3.1 as direct
web dependencies. No duplicate chart library was introduced. Chart chunks are
loaded dynamically; Recharts receives the shared computed data. Charts provide
readable MMK ticks/tooltips, distinct line patterns, exact data tables or category
values, responsive containers, and meaningful empty states. Chart animations are
disabled; existing reduced-motion styling remains in effect.

## Files changed in this milestone

- `apps/web/src/app/page.tsx`
- `apps/web/src/app/finance/page.tsx`
- `apps/web/src/app/globals.css` (business-surface styles appended)
- `apps/web/src/components/business-surface.tsx` (new)
- `apps/web/src/components/business-charts.tsx` (new)
- `apps/web/src/components/expense-form.tsx` (new)
- `apps/web/src/components/app-shell.tsx` (generic identity, source-aware navigation)
- `apps/web/src/components/order-manager.tsx` (read-only drawer export and initial selection)
- `apps/web/src/app/sales/page.tsx` (order deep link only; existing persistence retained)
- `apps/web/src/lib/business/types.ts` (new)
- `apps/web/src/lib/business/sample-provider.ts` (new)
- `apps/web/src/lib/business/live-provider.ts` (new)
- `apps/web/src/lib/business/live-actions.ts` (new)
- `apps/web/src/lib/business/sample-provider.test.ts` (new)
- `packages/core/src/index.ts` (shared financial calculations; existing order totals retained)
- `packages/core/src/index.test.ts` (new)
- `packages/core/package.json` (ES module declaration and tests)
- `packages/core/tsconfig.json` (TypeScript test imports)
- `packages/contracts/src/index.ts` (expense-input schema and shared exports)
- `apps/web/package.json` (chart dependencies and test command)
- `pnpm-lock.yaml`
- `eslint.config.mjs` (exclude external `.agents/skills` tooling from application lint)
- `docs/MILESTONE_2A_3.md` (this report)

Next.js also regenerates `apps/web/next-env.d.ts` when switching between development
and production type directories. Existing uncommitted auth/onboarding/order work
was retained. Supabase migrations, SQL tests, and hosted settings were not modified.

## Verification actually performed

- Read project instructions, PRD, architecture, design system, user flows,
  Milestone 2A.2 report, test plan, current routes/components/order manager, chart
  implementation, Git status, and the installed Next.js forms documentation.
- Applied ui-ux-pro-max. Focused local searches matched a line chart for a financial
  time series, exact accessible data alternatives, and Next.js chart code splitting.
  Preserved the approved Finance visual direction previously inspected in this chat.
- `pnpm --filter @ocean/core test`: PASS, 6 tests. Covers separate sales/receipts,
  exclusion of draft/cancelled orders, unknown costs, negative profit, inventory
  double-counting, payment receipt dates, Myanmar midnight, refund uncertainty,
  aggregation, categories, invalid ranges, fractional money, and overflow.
- `pnpm --filter @ocean/contracts test`: PASS, 5 tests, including existing order rules.
- `pnpm --filter @ocean/web test`: PASS, 5 tests (3 auth and 2 provider/expense tests).
  Tests cover schema validation, sample save/edit/reload/reset, recalculated expenses,
  typed Burmese fixtures, and corrupt storage rejection. Node emits a module-type
  inference warning for the web TypeScript tests; assertions pass.
- `pnpm lint`: PASS, zero warnings. External skill scripts are ignored; application
  and shared source rules remain enabled. This resolves the prior milestone's lint
  failures in copied CommonJS skill tooling without editing that tooling.
- `pnpm typecheck`: PASS for core, UI, contracts, web, and desktop.
- `pnpm build`: PASS, Next.js production webpack build. Dashboard and Finance are
  dynamic routes so their source/date parameters resolve at request time.
- `git diff --check`: PASS (Git may print CRLF normalization notices).

### Browser checks against actual Next.js pages

- Observed initial loading, populated Dashboard/Finance, and accurate sample-mode labels.
- Dashboard 7-day -> 30-day changed receipts from 45,000 to 108,000 MMK and order
  count from 4 to 15, while Today's Sales stayed 18,000 MMK as labeled.
- Opened a Burmese sample customer in the existing read-only order drawer; no edit
  or Supabase-saving controls appeared in sample details.
- Failed expense submission showed inline errors and focused its linked summary.
- Added a Burmese sample expense for 3,500 MMK, navigated to the ledger, edited it
  to 5,000 MMK, and observed expense/profit/chart updates. The original period's
  operating expenses changed from 93,500 to 98,500 MMK and estimated profit from
  59,500 to 54,500 MMK; receipts and recorded sales did not change.
- After navigation and a clean server restart, the same tab still showed the
  5,000 MMK sample edit. Category `Packaging` produced three entries totaling 42,000 MMK.
- Selecting January 1–7, 2025 showed zero period activity and meaningful empty
  trend/breakdown/ledger states; the separate monthly summary remained independent.
- Selecting live Finance without a session showed an explicit sign-in error with
  no fallback records. No successful authenticated database query/write is claimed.
- Desktop sidebar expand/collapse and actual pages in 375x812, 768x900, and 812x375
  frames were inspected. Tablet KPIs wrapped into two columns; mobile Finance and
  its full-screen expense form retained readable labels and controls.
- Fixed a chart container rule discovered in browser testing that hid the SVG plot.
  Verified actual line and bar plots afterward, including the production build.
- A development hot-update hydration mismatch occurred while changing navigation
  structure. A clean restart removed it; the production Finance smoke test had no
  browser console errors. Temporary responsive-review HTML files were removed.
- Started the built app on `http://127.0.0.1:3005` and smoke-tested Finance, chart
  rendering, sidebar resizing, and navigation to Dashboard. No hosted app was deployed.

## Limitations and remaining work

- Backend deployment is still unverified. Milestone 2A.2's migration is unchanged
  and unapplied. Authenticated live reads, expense writes/readback, cross-shop RLS,
  and live order persistence were not executed in this milestone.
- Live receipt/COGS providers and larger-shop pagination require future backend work.
  An empty known period can correctly total zero; unknown data is labeled unavailable.
- Sample records are synthetic. Sample edits are local browser-session data, not a
  backup or production ledger; closing/resetting that session may remove them.
- The monthly selector and ledger category filter intentionally have distinct scopes,
  as described above. Refunded-order profit remains unavailable until refund data exists.
- Responsive checks used real pages in browser frames, not physical mobile devices.
  No complete screen-reader audit, OS text-scaling test, or independent dark theme
  was performed. English UI and Burmese user-content rendering are supported;
  a complete Burmese translation is not added here.
- Existing Sales persistence logic remains in place; only deep-link selection and a
  read-only reuse option were added to the drawer. Live order acceptance remains the
  separate 2A.2 follow-up rather than being represented as completed by sample tests.
- No commits, pushes, migrations, AI extraction, payment verification, voucher work,
  or automatic next milestone were performed.

### Final production follow-up

The production Dashboard populated its four expected sample KPIs after navigation.
The native month control was also exercised in production: August 2026 displayed
75,000 MMK recorded sales, 27,000 MMK receipts, 38,000 MMK order costs, 32,500 MMK
operating expenses, and 4,500 MMK estimated profit. The monthly values changed
independently of the October report period. Production browser error logs were empty.
