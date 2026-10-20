# Approved hosted migration deployment — October 21, 2026

User explicitly approved the three reviewed pending migrations after preflight.
Verified linked project: `ocean-ai-assistant`, ref `pzirbuiwunrbfdzoeaal`, healthy.

## Preflight

- CLI migration history matched the user's table: only `20261020000000` deployed.
- Read-only SQL confirmed no `payment-evidence` bucket, no Storage object policies,
  and no existing order-revisions/evidence tables or order-save RPC.
- `pnpm exec supabase db push --linked --skip-vault --dry-run` listed exactly
  the three approved migrations, with no seeds or role changes.
- CLI required elevated local filesystem access for its authenticated profile.
  The initial sandboxed read failed on the CLI telemetry file; it applied nothing.

## Applied

`pnpm exec supabase db push --linked --skip-vault --yes` completed with exit 0:

- `20261020010000_single_shop_onboarding.sql`
- `20261020020000_order_management.sql`
- `20261021030000_payment_evidence.sql`

Vault updates, seeds and custom roles were excluded. No reset, application test
account, sample transaction, or uploaded image was created by this deployment.

## Verified after deployment

Read-only queries using the CLI's `db query --linked --project-ref` confirmed:

- `supabase_migrations.schema_migrations` contains all four local versions:
  `20261020000000`, `20261020010000`, `20261020020000`, `20261021030000`.
- RLS enabled on `order_revisions`, `payment_evidence`, `payment_evidence_events`.
- The onboarding, order-save and evidence-review SECURITY DEFINER functions exist
  with an empty fixed `search_path`.
- Member SELECT policies exist on the new tables, and shop-scoped SELECT/INSERT
  policies exist on Storage objects.
- `payment-evidence` bucket is private with an 8,388,608-byte maximum.

The post-deployment `migration list` stalled at login-role initialization and was
cancelled. History was verified directly from the remote migration-history table
instead; the stalled command is not reported as a pass.

## Still unverified

This deploy establishes schema availability, not end-to-end application acceptance.
pgTAP remains unexecuted. Sign-in/callback, first-shop setup, live order create/edit
and readback, private image upload/review readback, two-seller isolation and real
AI-provider behavior still need runtime tests. Receipt confirmation/payment
allocation remain outside the pending-evidence workflow. No commit or push.
