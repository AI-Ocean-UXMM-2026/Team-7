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

This is a UI foundation: no authentication, backend writes, AI extraction, payment
workflows, voucher generation, financial calculations, chart filtering, Excel export,
Supabase tables/migrations, or production Electron integration. Settings are read-only. Language
switching and first-session onboarding are deferred. Typography uses local system
fonts with Burmese-capable fallbacks; no remote font request is required at build
or runtime. Full Burmese translation and bundled fonts remain future work.

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

Shared contracts and core packages intentionally contain no speculative business
logic. The Supabase migration directory will be added with its implementation
milestone. Keep all private credentials and `.env.local` untracked.
