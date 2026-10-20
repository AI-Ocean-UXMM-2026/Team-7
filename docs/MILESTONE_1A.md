# Milestone 1A handoff

Base: `main` at `985c445f23dd32cdf616cbd361864c19afd359b2`
(`docs: finalize buildathon specifications`). The GitHub `main` tip was verified
with `git ls-remote` before implementation and matched this commit.

## Required document verification

| File | Bytes | First heading |
| --- | ---: | --- |
| AGENTS.md | 3,345 | AGENTS.md |
| docs/PRD.md | 5,954 | Product Requirements Document |
| docs/ARCHITECTURE.md | 4,951 | Architecture Specification |
| docs/DESIGN_SYSTEM.md | 4,894 | Design System |
| docs/USER_FLOWS.md | 2,354 | User Flows |

Read all five plus `docs/TEST_PLAN.md` before implementation. Existing guidance
and specifications were preserved without edits.

## Implementation and file inventory

Modified existing files:

- `.gitignore`: additional private credential file patterns; existing dotenv rules retained.
- `README.md`: setup, workspace map, commands, scope, and limitations.

New root configuration:

- `package.json`: private workspace, pinned pnpm version, Node requirement, root scripts.
- `pnpm-workspace.yaml`: app/package workspace patterns and explicit resolver build approval.
- `pnpm-lock.yaml`: resolved dependency lockfile.
- `tsconfig.base.json`: shared strict TypeScript configuration.
- `eslint.config.mjs`: Next.js, React, TypeScript, and accessibility lint configuration.

New web foundation:

- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/next-env.d.ts`
- `apps/web/next.config.ts`
- `apps/web/postcss.config.mjs`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/sales/page.tsx`
- `apps/web/src/app/finance/page.tsx`
- `apps/web/src/app/settings/page.tsx`
- `apps/web/src/app/not-found.tsx`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/components/section-nav.tsx`
- `apps/web/src/components/metrics.tsx`

The web app includes the four primary destinations, collapsible desktop sidebar,
mobile bottom navigation, URL-addressable Sales/Finance sections, active navigation
semantics, skip link, keyboard focus indicators, and reduced-motion support.
KPI cards use container space to wrap; mobile layouts use two or one column.

New shared/reserved workspaces:

- `packages/ui/package.json`
- `packages/ui/tsconfig.json`
- `packages/ui/src/index.tsx`: shared cards, headings, placeholders, and icons.
- `packages/ui/src/tokens.css`: approved palette plus contrast, font, radius, and shadow tokens.
- `packages/contracts/package.json`
- `packages/contracts/tsconfig.json`
- `packages/contracts/src/index.ts`: reserved module only.
- `packages/core/package.json`
- `packages/core/tsconfig.json`
- `packages/core/src/index.ts`: reserved module only.
- `apps/desktop/package.json`
- `apps/desktop/README.md`: reserved workspace only.

New reference/handoff notes:

- `assets/design-references/README.md`
- `docs/MILESTONE_1A.md` (this file)

## Design and asset preservation

Inspected the published Figma Make Dashboard and Finance Management in a browser.
Reference: https://entry-align-51407368.figma.site/

The exact documented palette is shared through CSS custom properties and mapped
into Tailwind theme colors. A darker blue derivative is used behind small white
navigation text. English uses a modern system sans-serif fallback; Burmese text
uses available Myanmar-capable system fonts.

Both official dolphin PNGs remain byte-identical to the base commit. The dashboard
imports the accountant asset directly from `assets/dolphin/`; no duplicate or
replacement character was created.

## Validation

- Dependency installation: `pnpm install --frozen-lockfile`.
- Lint: `pnpm lint` with zero warnings permitted.
- TypeScript: `pnpm typecheck`, covering web, UI, contracts, and core.
- Production compilation: `pnpm build`.
- Production server: `pnpm start` on local loopback.
- Browser checks: Dashboard, Sales, Finance, Settings; sidebar collapse; Sales
  Orders/Vouchers/Payments placeholder navigation; Finance Expenses placeholder.
- Keyboard check: Tab focuses the skip link; Enter moves focus to main content.
- Visual responsive checks: desktop plus 390px and 320px iframe viewports showing
  two-column and one-column KPI layouts and fixed bottom navigation.
- Repository checks: `git diff --check`, unchanged source docs/assets, and
  `git check-ignore` for root/app dotenv and credential file examples.

The first install required approving `unrs-resolver`'s native build; the explicit
approval is saved in the workspace config. The first lint run found an anonymous
PostCSS config export warning, which was fixed. Installation emits an upstream
ESLint 9 deprecation warning; ESLint 9 is retained for the installed React lint
plugin's declared peer compatibility. No future financial/AI/Electron tests apply
to this UI-only milestone.

## Run locally

From the repository root, using Node.js 24.13+ and pnpm 11.25.0:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Visit http://127.0.0.1:3000. For production mode run `pnpm build`, then `pnpm start`.
No environment variables or private credentials are needed for this foundation.

## Known limits and remaining work

All figures and profile details are explicitly synthetic. There are no backend
writes, authentication, AI extraction, payment workflows, vouchers, database tables,
migrations, financial calculations, or Electron functionality. Chart/filter/export
areas are placeholders. Settings are read-only; full Burmese translation, language
switching, bundled fonts, onboarding/welcome overlay, and order details are deferred.
Mobile checks used browser iframe viewports rather than physical-device testing.

Stop for team review here. Further milestones require approval.
