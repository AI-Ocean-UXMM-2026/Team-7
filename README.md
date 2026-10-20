# ocean-ai-assistant
AI-powered order and financial assistant for Myanmar online sellers. Built for Into the AI Ocean Buildathon.
## Repository Status

This is our team's private preparation repository for the UXMM Into the AI Ocean buildathon.

It contains:
- Product requirements and architecture planning
- Design system and UX references
- Dolphin mascot assets
- Development guidelines for Codex

UXMM is expected to provide an official GitHub repository for the buildathon.

When that repository is available, we will review its structure and submission requirements before transferring approved materials or starting official implementation.

Do not commit API keys, database passwords, `.env.local`, or other secrets.

The project name SaleSayar AI is temporary.

## Milestone 1A: Web foundation

Requires Node.js 24.13+ and pnpm 11.25.0. From the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:3000. No credentials or environment variables are needed.

```powershell
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

`pnpm start` serves the production build after `pnpm build`. Both servers bind
to the local machine by default.

### Workspace structure

- `apps/web`: Next.js App Router, React, strict TypeScript, Tailwind CSS.
- `apps/desktop`: Windows Electron floating dolphin assistant; demo only.
- `packages/ui`: shared UI primitives, icons, and ocean-blue CSS tokens.
- `packages/contracts`: reserved shared contract module.
- `packages/core`: reserved shared business-rule module.
- `assets/dolphin`: unchanged official artwork, imported directly by the website.
- `assets/design-references`: published Figma Make reference and inspection notes.

The responsive shell includes a collapsible desktop sidebar, four-item mobile
bottom navigation, Dashboard, Sales Management, Finance Management, and Settings.
Sales and Finance section links select sample records/reports or clearly
unconnected feature views through the URL.
All displayed financial figures and profile details are synthetic and labeled.

### Current limits

The website still shows clearly marked synthetic dashboard, sales, finance, and
settings content. Live order, expense, voucher, AI, and payment workflows are not
connected. The seller sign-in and shop workspace foundation is documented in
`docs/MILESTONE_2A_1.md`; it requires the versioned migration to be applied to a
configured Supabase project before workspace onboarding is available.

## Milestone 1C: Presentation prototype

The approved ocean-blue interface now includes sample charts, order search/status
filters, responsive tables, and polished read-only settings. The Good Morning
banner and official dolphin PNGs are preserved. Data is illustrative; live AI,
payment verification, voucher creation and backend writes are not connected.

The Electron launcher drag fix was manually retested on Windows at 125% scaling.
Movement supplies explicit fixed-size bounds to prevent native window growth.
The assistant has two simulated flows, session draft restoration, and reduced-
motion-friendly mascot reactions. See `docs/MILESTONE_1C.md` for evidence,
changed files, validation, and remaining display/native checks.

Build the desktop main/preload before starting it:

```powershell
pnpm desktop:build
pnpm desktop:start
```

For renderer development, run `pnpm desktop:dev` after a desktop build. Keep the
website and desktop commands in separate PowerShell terminals.

`pnpm build` uses Next.js's bundled Webpack production builder after the default
Turbopack CSS worker failed on this Windows environment. Development is unchanged;
no additional bundler dependency is installed.

Shared Zod entity contracts now live in `packages/contracts`. The Supabase
migration and pgTAP shop-isolation test live under `supabase/`. The core package
continues to have no speculative financial logic. Keep private credentials and
`.env.local` untracked.

## Milestone 2A.1: Supabase business foundation

Install dependencies, configure `apps/web/.env.local` from the committed example,
and follow the project linking, migration, and auth redirect steps in
`docs/MILESTONE_2A_1.md`. Start the website with `pnpm dev`, then visit
http://127.0.0.1:3000/login to sign in or create an account. The first-shop flow
is at `/workspace` after authentication. No service-role key is needed by the
website; never put one in a `NEXT_PUBLIC_` variable.

Schema tests: `pnpm --filter @ocean/contracts test`. Database isolation tests
require the Supabase CLI and its local Postgres stack; see the milestone handoff.
