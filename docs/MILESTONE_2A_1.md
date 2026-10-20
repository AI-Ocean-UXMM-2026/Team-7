# Milestone 2A.1 — Supabase Business Foundation

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
