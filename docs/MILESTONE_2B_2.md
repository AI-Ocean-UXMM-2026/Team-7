# Milestone 2B.2 — Real AI Chat to Order

Date: 2026-10-21  
Status: `READY_WITH_CONCERNS` — the bounded implementation is complete for
curator verification. This is not an acceptance or release decision.

## Outcome

The Chat to Order slice is implemented in two deliberately separate modes:

- The hosted assistant is a same-origin `/assistant` route in the Next.js web
  app. It uses the existing authenticated Sales save/readback workflow and
  gates live AI extraction and order saving by authenticated shop membership.
- The local Electron panel is an explicitly labelled offline simulation. It
  keeps the local draft and screenshot demonstration, but it does not send
  renderer requests to the web API or save local sample orders.

The flow accepts English, Burmese, and mixed messages; supports multiple items,
quantities, prices, customer and delivery details, notes, delivery fee, and
discount; keeps missing or ambiguous values unknown; and lets the seller edit
every extracted field before confirmation. MMK totals are calculated as integer
values in the shared core package.

The assistant still exposes exactly two primary actions: Chat to Order and
Screenshot to Order Match. Screenshot matching remains a simulation and does
not mark a screenshot as a verified payment.

## Implementation

- Shared extraction parser and tests: `packages/core/src/chat-to-order.ts` and
  `packages/core/src/chat-to-order.test.ts`.
- Shared Zod request, extraction, response, and save contracts:
  `packages/contracts/src/chat-to-order.ts` and
  `packages/contracts/src/index.ts`.
- Server-only AI boundary with bounded input/output, membership checks, usage
  limiting, provider timeout, and validated fallback:
  `apps/web/src/app/api/ai/chat-to-order/route.ts` and `guard.ts`.
- Hosted assistant route, bounded email/password sign-in, shop chooser, and
  editable order workflow:
  `apps/web/src/app/assistant/page.tsx`, `login/page.tsx`, and
  `assistant-panel.tsx`.
- Hosted assistant uses same-origin requests, existing authenticated order
  actions, stable draft order IDs, explicit editable/saving/saved phases,
  confirmation-in-flight protection, and order readback validation. The hosted
  draft freezes chat, analysis, and all field/item mutations while saving and
  after success; a failed save preserves edits for a stable-ID retry, while a
  successful save requires an explicit new-draft action.
- Electron hosted-panel URL and navigation restrictions:
  `apps/desktop/src/main/hosted-assistant.ts` and
  `apps/desktop/src/main/navigation-guard.ts` and
  `apps/desktop/src/main/index.ts`. Both `will-navigate` and main-frame
  `will-redirect` use the same strict origin/path policy.
- Electron hosted mode has one persistent isolated session partition,
  context isolation, sandboxing, web security, no general preload bridge, and
  no arbitrary redirects or window opens. The local simulation retains the
  existing restricted preload for launcher/draft controls.
- Local Electron extraction, draft validation, totals, and screenshot behavior
  remain in `apps/desktop/src/renderer/chat-order.ts` and `App.tsx`; the
  local panel is clearly marked as offline simulation.

## Setup boundary

For live provider extraction, configure the web server with a server-only
`OPENAI_API_KEY` or `AI_API_KEY`. `AI_CHAT_API_URL` and `AI_CHAT_MODEL`
are optional overrides. Provider keys are never placed in `NEXT_PUBLIC_*` or
Electron renderer variables.

For hosted Electron mode, configure the Electron main process with
`SALESAYAR_ASSISTANT_URL` set to one validated HTTPS app origin. The hosted
panel normalizes that origin to `/assistant`; only `/assistant` and its
bounded `/assistant/login` path are navigable. HTTP is accepted only for
explicit local development origins. Google OAuth is not embedded in Electron;
the hosted assistant uses email/password sign-in, while website OAuth remains a
website flow.

The hosted route checks the authenticated user and explicit
`shop_memberships` access before live provider invocation or order save. The
current local environment does not contain an AI provider key or an
authenticated hosted shop session, so no live provider response or hosted
order was created during this verification.

## Acceptance evidence

- Multilingual and mixed-language extraction, multiple items, unknown missing
  values, delivery-phone requirements, and integer MMK fields are covered by
  shared parser and contract tests.
- Request and response boundaries reject invalid input and unvalidated
  provider output through shared Zod contracts.
- Every draft field and item quantity/price is editable before confirmation;
  missing-field warnings and extracted/manual source labels are visible.
- Totals are recomputed from the editable draft through shared core logic.
- Stable draft order IDs prevent a retry from creating a second order, and
  confirmation is blocked while a save is in flight or after success. Focused
  state tests cover deferred-save mutation/re-analysis attempts, successful
  save-to-new-draft transition, and failed-save retry behavior.
- Focused navigation-guard tests cover allowed assistant-to-sign-in redirects,
  rejected off-origin/other-path main-frame redirects, subframe handling, and
  denied window opens through the actual event wiring.
- Local Electron draft preservation continues through the existing IPC store;
  hosted panel state remains mounted while hidden and its authenticated session
  uses the persistent isolated Electron partition.
- The hosted assistant exposes only the two required actions. Screenshot
  preview is local/sample-only and never changes payment status.
- Local runtime probes returned HTTP 200 for `/assistant`, HTTP 200 for the
  bounded email/password assistant sign-in page without a Google button, and
  HTTP 200 for simulation extraction. No credential or hosted write was used.

## Checks performed

All checks below were run from the repository root on 2026-10-21:

- `pnpm --filter @ocean/core test` — passed, 9 tests.
- `pnpm --filter @ocean/contracts test` — passed, 7 tests.
- `pnpm --filter @ocean/web test` — passed, 14 tests.
- `pnpm --filter @ocean/desktop test` — passed, 11 tests.
- `pnpm --filter @ocean/web typecheck` — passed.
- `pnpm --filter @ocean/desktop typecheck` — passed.
- `pnpm typecheck` — passed for all workspace packages.
- `pnpm lint` — passed with zero ESLint warnings/errors.
- `pnpm --filter @ocean/desktop build` — passed; Vite built main, preload,
  and renderer bundles. Existing Zod Rollup annotation warnings were emitted.
- `pnpm --filter @ocean/web build` — passed; Next.js compiled TypeScript,
  generated 13 pages, and included `/assistant` and `/assistant/login`.
- `git diff --check` — passed; Git reported only normal LF/CRLF conversion
  warnings for the Windows working copy.
- Local runtime probes — passed for hosted route availability, the bounded
  assistant sign-in surface, and simulation extraction. The local development
  server was stopped after the probes.

## Known limitations and remaining work

- A real provider response has not been exercised because no AI key is present
  in the current environment.
- Hosted authenticated OAuth/session behavior, live order save/readback, and
  cross-shop RLS isolation remain open. They require a configured hosted
  environment and test accounts; no hosted writes or migrations were used.
- Browser-level navigation, visual layout, responsive behavior, and packaged
  Windows Electron interaction still require final acceptance verification.
- Hosted assistant state is retained while its Electron panel is hidden, but a
  full page reload is not a separate persistence contract; the server-backed
  order is the durable record after confirmation.
- No account creation, hosted business write, commit, or push was performed.

Task 3 and broader product work remain out of scope until curator review.

