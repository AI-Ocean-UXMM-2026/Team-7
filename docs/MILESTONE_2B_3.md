# Milestone 2B.3 — Screenshot transaction review

Deployment follow-up: the user approved deployment on October 21, 2026. All three
pending migrations were applied successfully and remote history/catalog checks
passed; see [deployment evidence](MIGRATION_DEPLOYMENT_2026_10_21.md). References
below to unapplied SQL describe the earlier implementation/review state. pgTAP
and authenticated runtime/RLS acceptance remain unverified.

## Curator review — October 21, 2026

The updated Subculture terminal handoff was received successfully. Independent
inspection confirmed the separate original/reviewed payloads, immutable extraction
check in the RPC, before/after association/status/revision audit snapshots, and
canonical reviewed-reference matching with 201-row completeness sentinels.

Focused verification actually rerun by the curator:
`node --test packages/contracts/src/screenshot-to-order.test.ts packages/core/src/screenshot-match.test.ts apps/web/src/lib/ai/screenshot-scope.test.ts`
— **8 passed, 0 failed**. These are local TypeScript tests, not executed SQL or
hosted authorization evidence. The reviewed corrections have no identified
remaining material defect. Overall acceptance remains **BLOCKED** pending the
SQL execution, real provider, authenticated private-storage
readback/isolation, and browser/native workflow evidence. No migration was applied.

Curator production-build follow-up: `pnpm build` with elevated local filesystem
access **PASSED, exit code 0**. Next.js webpack compilation, TypeScript, all 16
static-generation steps and final tracing completed; both screenshot API and
pending-evidence API routes appear in the production route output. This resolves
the earlier build-permission blocker; it does not establish runtime acceptance.

## Status

Focused rework complete; ready for curator verification. This slice prepares screenshot extraction and seller review; it does not confirm receipt, allocate a payment, or change an order payment status.

## Implemented changes

- Added strict shared screenshot extraction, candidate, duplicate-warning, and pending/rejected evidence contracts.
- Added deterministic same-shop candidate matching in `@ocean/core`:
  - exact and close MMK amount relations;
  - customer-name match, mismatch, or unavailable explanation;
  - explicit reference relation unavailable because existing orders have no transaction-reference field;
  - confirmed unpaid/partially-paid eligibility only;
  - bounded deterministic candidates and same-shop duplicate warnings based on canonical seller-reviewed provider/reference values.
- Added a server-only screenshot route with:
  - JPEG, PNG, and WebP signature validation;
  - 8 MiB actual-byte limit, request/output bounds, and image dimension/pixel limits;
  - no remote URL support;
  - separate vision-provider configuration and server-side key use;
  - authenticated shop membership and usage checks before live order/evidence queries;
  - clearly synthetic-only fallback when no vision key is configured.
- Added authenticated rematch and pending/rejected evidence save routes. Save revalidates the original image, derives a shop/evidence/hash storage path server-side, uses the private bucket, calls only the narrow persistence RPC, and reads the evidence back through the authenticated client.
- Added an unapplied Supabase migration for private `payment_evidence` and append-only `payment_evidence_events`, same-shop composite references, RLS, private storage policies, revision control, stable evidence IDs, immutable original extraction, and atomic review persistence.
- Audit events now retain before/after order association, status, revision, and seller-reviewed values for create, update, and rejection transitions.
- Matching requests load at most 200 orders and 200 evidence records plus a 201-row sentinel. If either same-shop scope exceeds that bound, matching stops with an explicit incomplete-scope message instead of claiming that no duplicate or candidate exists.
- Added pgTAP coverage for table/RLS/privilege/isolation boundaries, original-extraction immutability, and audit transitions. The migration and SQL test are prepared but were not applied to a hosted project.
- Replaced the hosted screenshot placeholder with an editable, keyboard-accessible seller-review workflow. It keeps the local preview local until Analyze, invalidates selected candidates after corrections, prevents stale rematch results, requires an explicit second click for pending/rejected decisions, and shows readback success without any payment confirmation control.

## Verification

Passed checks:

- `pnpm typecheck` (core, UI, contracts, desktop, and web);
- `pnpm lint` with zero warnings;
- contracts tests: 10 passed, including the immutable-original/corrected-review payload flow;
- core tests: 13 passed, including canonical corrected-field duplicate matching;
- web tests: 17 passed, including 200-row completeness/sentinel coverage and image signature/size/dimension validation;
- desktop regression tests: 11 passed;
- `git diff --check` completed without whitespace errors.

Environment-blocked checks:

- `pnpm --filter @ocean/web build` reached Next.js compilation but failed on this Windows host with `EPERM` while creating generated `.next/server/app/*` directories. A clean output directory and the alternate Turbopack compiler were also tried; Turbopack exited while spawning its CSS child process. No source error was reported.
- `pnpm exec supabase db lint --local` could not connect because no local Postgres was listening on `127.0.0.1:54322`; the migration and pgTAP file remain unapplied and unexecuted.

## Security and data boundaries

- Vision keys remain server-only; no image, prompt, provider response, or key is logged.
- Live analysis and rematch query only the authenticated shop. Simulation performs no shop/order/evidence query.
- Evidence is private, shop-scoped, hash-addressed, and not exposed through public URLs. Renderer clients receive no storage write/delete primitive.
- The first provider extraction is stored in `extracted` and cannot be replaced on later revisions; seller corrections are stored separately in `seller_reviewed` and are the canonical duplicate-check input.
- The review RPC does not update `orders.payment_status`; the current schema has no trusted receipt ledger or allocation workflow.
- Duplicate warnings are same-shop and distinguish pending versus rejected evidence. They are warnings, not proof of payment.
- A failed RPC after a successful upload may leave a private orphan object; no unsafe delete workaround is attempted. Administrator cleanup is a future operational concern.

## Setup and limitations

- Configure `AI_VISION_API_KEY` (or the existing server-side key fallback), `AI_VISION_API_URL`, and a vision-capable `AI_VISION_MODEL` for live extraction. A text-only chat model must not be assumed to support images.
- Apply `supabase/migrations/20261021030000_payment_evidence.sql` only through the normal reviewed deployment process; it was intentionally not applied by this task.
- Migration review note: the `storage.buckets` reconciliation intentionally updates any existing `payment-evidence` bucket to private mode, the 8 MiB limit, and the JPEG/PNG/WebP allowlist. Inspect that existing bucket before applying the migration; no remote bucket or database mutation was performed here.
- Hosted OAuth/session, storage bucket availability, provider credentials, browser responsive verification, and live RLS/order readback require curator/environment verification.
- Electron remains an explicitly local simulation for screenshot selection; no native screenshot upload bridge was added in this milestone.
