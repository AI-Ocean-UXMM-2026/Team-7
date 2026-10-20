# Milestone 2A.1 — Supabase Business Foundation

## Completion pass — October 20, 2026

This section supersedes earlier connectivity/history limitations below. Milestone
2A.1 is still awaiting live user-flow and isolation verification, not complete.

### Verified against the linked project

- The read-only CLI history check succeeded. `20261020000000` is present locally
  and remotely. No remote SQL or database mutation was executed in this pass.
- The Auth settings endpoint returned HTTP 200: Google enabled, email enabled,
  signup enabled. This verifies configuration/connectivity, not successful login.
- Browser-tested Google initiation reached Google, which rejected the request
  with `400: redirect_uri_mismatch`. Its error-details dialog identifies the
  rejected URI as `https://pzirbuiwunrbfdzoeaal.supabase.co/auth/v1/callback`.
  Add that exact URI to the Authorized redirect URIs of the Google Web OAuth
  client configured in Supabase, then retry. No Google settings were modified.
  This is the confirmed blocker to end-to-end Google login.
- The ignored root environment had non-placeholder public configuration matching
  the linked project, while `apps/web/.env.local` had placeholders. Copied only
  the public URL and publishable key into the ignored web environment. Neither
  credentials nor tokens were printed. Both environment files remain ignored.

### Application changes

- Added Google OAuth initiation using the SSR PKCE client and the existing
  callback. OAuth redirects are restricted to the configured Supabase origin.
- Added recovery request and authenticated password-reset forms. Recovery replies
  avoid revealing whether an address is registered. Reset checks the current user,
  validates matching passwords, updates through Supabase Auth, and signs out.
- Callback accepts PKCE codes or supported email token hashes, handles provider
  failure, strips callback secrets by redirecting to a fixed destination, and
  only permits the workspace or password-reset destination. Redirect origin comes
  from trusted application configuration, not request host headers.
- Added placeholder/public-key configuration guards, including rejection of
  `sb_secret_` keys. Added callback-origin/redirect tests and recovery schema tests.
- A single existing membership goes directly to its shop. Additional-shop UI was
  removed; pre-existing multiple memberships are preserved without deletion.
- Prepared `20261020010000_single_shop_onboarding.sql`, which remains PENDING.
  It makes first-shop creation idempotent and serializes concurrent submissions
  with a per-user transaction lock. Existing membership returns its shop. The
  function checks authentication, has an empty search path, uses restricted grants,
  and creates an owner membership atomically when none exists. It has no DROP,
  TRUNCATE, DELETE, table changes, or updates to existing business rows. Existing
  historical multiple shops are preserved. Applying it requires explicit approval.
- Extended pgTAP checks for repeat onboarding, owner membership creation, and
  prevention of direct membership grants. These require both local migrations.

### Local Auth configuration / next verification

The existing dev process runs at `http://127.0.0.1:3002`; local
`NEXT_PUBLIC_APP_URL` now matches that origin. Do not test the stale 3000/3001
instances as evidence for the updated application. Open:

`http://127.0.0.1:3002/login`

In Supabase Auth URL Configuration, use the intended application origin as Site
URL and allow these local redirect URLs (replace the port consistently if changed):

- `http://127.0.0.1:3002/auth/confirm`
- `http://127.0.0.1:3002/auth/confirm?next=/login/reset-password`

Google's authorized redirect is the Supabase provider callback,
`https://<project-ref>.supabase.co/auth/v1/callback`, not the Next.js callback.
Do not change provider credentials or disable email confirmation for testing.

For email token-hash templates compatible with the implemented callback:

- Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
- Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`

These are dashboard instructions only; hosted settings/templates have not been
changed by this pass. PKCE email links must be opened in the initiating browser.

Remaining live acceptance steps:

1. User completes Google sign-in, callback, refresh/session persistence and sign-out.
2. Verify email signup/confirmation/login and password recovery with user-entered
   credentials; never paste passwords or recovery links into chat.
3. After approval, apply only the pending one-shop migration, repeat history check,
   create a shop, and confirm repeated onboarding returns the same shop.
4. Use two independent test accounts to verify cross-shop reads/writes fail for
   customers, orders/items and expenses, and membership/payment-status writes fail.
5. Execute the 21 pgTAP checks against a local Supabase stack when Docker is
   available. Local tests do not replace hosted isolation checks.

Website sample screens and Electron remain unchanged. No Milestone 2A.2 work,
production transactions, commits, or pushes are included.

### Checks in the completion pass

- `pnpm lint`: passed, zero warnings.
- `pnpm --filter @ocean/web test`: passed, 3 auth security/configuration tests.
  Node emits a module-type inference warning for the TypeScript test file.
- `pnpm --filter @ocean/contracts test`: passed, 4 schema tests.
- `pnpm typecheck`: passed, including web, desktop and shared workspaces.
- `pnpm build`: passed after retrying with filesystem access; the first attempt
  was blocked by an EPERM when creating generated Next.js output.
- Browser: sign-in/Google button and recovery page rendered; OAuth initiation
  reached Google's explicit mismatch error. No completed Google session claimed.
- `git diff --check`: passed; Git emitted CRLF normalization notices.
- Docker is unavailable, so pgTAP was not executed. The new migration has been
  reviewed but not SQL-executed; concurrency behavior remains untested.
- No dependency additions, SQL execution, remote migrations, auth admin changes,
  test account creation or hosted business writes occurred.

## Delivered

- Added pinned `@supabase/ssr` and `@supabase/supabase-js` dependencies to the
  website and pinned Zod in `@ocean/contracts`.
- Added browser and server Supabase client factories. The server client reads
  sessions from cookies, and the Next.js 16 `src/proxy.ts` refreshes them using
  verified claims. Only the public URL and publishable key are read by the app.
- Added `/login` and `/login/signup` email/password flows, email confirmation
  callback, sign-out, server-side session checks, and a protected `/workspace`
  route. The signed-in seller can create a first shop through the restricted
  `create_shop_for_current_user` database function. Shop routes query through
  the authenticated client and return no record for non-members.
- Added shared Zod schemas and inferred TypeScript types for profiles, shops,
  memberships, customers, orders, order items, and expenses. Money uses safe
  integer MMK values. Order, payment, and fulfillment statuses are separate.
- Added the versioned migration `supabase/migrations/20261020000000_business_foundation.sql`.
  All seven requested tables enable RLS. Policies resolve membership through
  restricted `SECURITY DEFINER` helpers to avoid policy recursion. The migration
  creates the user's profile on signup and provides the atomic first-shop setup
  RPC. Profile names outside the 1–120 character bound are stored as null so
  malformed Auth metadata cannot block signup or the profile backfill.
- Authenticated users can read shop orders and items but cannot write or delete
  them directly. The transactional order persistence path is deferred to
  Milestone 2A.2 so order totals cannot drift from item lines. Authenticated
  writes also cannot set or update `payment_status`; new orders use the `unpaid`
  default until a separately approved payment workflow exists.
- Added a pgTAP cross-shop isolation test and Node schema tests. No seed file or
  fabricated business records are added.
- Kept existing website content and Electron launcher behavior intact. The
  sample dashboard remains clearly marked as sample data; `/workspace` is the
  private authenticated path.

## Supabase project status

The public project URL and publishable key were copied from the ignored root
`.env.local` into ignored `apps/web/.env.local`; only the two `NEXT_PUBLIC_`
variables needed by the app were copied. The latest user-provided
`supabase migration list` output shows local and remote version
`20261020000000`, so the migration is recorded as applied to the linked project.
The execution shell could not repeat the history check or apply the migration:
the CLI login is not available in that shell, and its approved `db push` attempt
failed immediately with `AccessTokenRequiredError` before connecting. The
successful application is based on the user's CLI output. Live signup, login,
first-shop creation, and remote RLS isolation have not been exercised.

## Setup on Windows

1. Copy the example into the Next.js app directory and enter the project's public
   API details from Supabase **Connect**. Keep the publishable key in this
   `NEXT_PUBLIC_` variable; do not use a secret/service-role key here.

   ```powershell
   Set-Location D:\Buildathon\ocean-ai-assistant
   Copy-Item apps\web\.env.example apps\web\.env.local
   notepad apps\web\.env.local
   ```

   Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and
   `NEXT_PUBLIC_APP_URL` (for local development, `http://127.0.0.1:3000`). The
   `.env.local` file is ignored by Git.

2. Install the CLI if needed, authenticate in your own terminal, link the
   intended Supabase project, and apply the versioned migration. The CLI prompts
   for the database password during linking; enter it locally and do not paste
   it into chat or commit it.

   ```powershell
   pnpm dlx supabase login
   pnpm dlx supabase link --project-ref <project-ref>
   pnpm dlx supabase db push
   pnpm dlx supabase migration list
   ```

3. To verify the migrations and pgTAP tests locally first, start Docker Desktop
   and run:

   ```powershell
   pnpm dlx supabase start
   pnpm dlx supabase db reset
   pnpm dlx supabase test db
   ```

4. In Supabase Auth URL Configuration, set the Site URL to
   `http://127.0.0.1:3000` and allow `http://127.0.0.1:3000/auth/confirm` as a
   redirect URL. Then start the site and establish a seller workspace:

   ```powershell
   pnpm dev
   ```

   Open `http://127.0.0.1:3000/login/signup`, create an account, confirm the
   email if enabled, sign in, and create the shop at `/workspace`. To verify
   isolation, create a second account and confirm it cannot see the first
   account's shop or its records through the database API.

The local stack and hosted project are separate databases. `supabase db reset`
and `supabase test db` verify the local migration; `supabase db push` is the
explicit remote apply step.

## Checks and limitations

- `pnpm install --frozen-lockfile`: passed after adding the pinned dependencies.
- `pnpm --filter @ocean/contracts test`: passed, 3 schema test cases.
- `pnpm lint`: passed with zero warnings.
- `pnpm typecheck`: passed for web, desktop, and shared packages.
- `pnpm build`: passed using the repository's configured Next.js Webpack builder.
- `supabase/tests/business_rls.test.sql`: expanded to check profile metadata
  handling, read isolation for orders and items, withheld direct order writes,
  payment-status protection, and existing customer/expense isolation. It has
  not been executed because Docker is not installed in this environment.
- The hosted migration is recorded as applied according to the user's CLI
  output. Live authentication and remote cross-shop isolation remain unverified.
- Team invitations, membership-role editing, data APIs, order/expense screens,
  payment workflows, AI extraction, vouchers, and Electron authentication are
  outside this milestone.

The SSR setup follows the official [Supabase Next.js SSR guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security),
and [database testing guide](https://supabase.com/docs/guides/database/testing).
