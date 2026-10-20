# AGENTS.md

## Project Context

We are building an AI business assistant for Myanmar Facebook and TikTok sellers.

Working name: SaleSayar AI. Final name undecided.

Buildathon: Into the AI Ocean, hosted by UXMM.

Duration: Five days.

Primary certified platform: Windows.

Architecture: Next.js website, Electron floating dolphin assistant, shared backend.

## Read Before Coding

Read:

- docs/PRD.md
- docs/ARCHITECTURE.md
- docs/DESIGN_SYSTEM.md
- docs/USER_FLOWS.md
- docs/TEST_PLAN.md

If a specification is unclear or conflicts with another, report the conflict before implementing it.

## Development Rules

1. Inspect existing files before modifying them.
2. Work on one requested milestone at a time.
3. Propose a short implementation plan.
4. Follow the approved design references.
5. Do not redesign unrelated pages.
6. Reuse existing components.
7. Keep TypeScript strict.
8. Avoid unnecessary dependencies.
9. Add tests for critical business rules.
10. Run relevant checks after changes.
11. Report exactly what was tested.
12. Do not implement future milestones without approval.

## UI/UX Requirements

UX quality is a primary project goal.

Keep the application:
- Friendly and playful.
- Professional enough for financial management.
- Responsive.
- Accessible.
- Consistent with the Finance Management design reference.
- English-first and Burmese-ready.

Use the approved blue accountant dolphin.

The launcher is a small standalone transparent dolphin, not a mascot inside a visible circle.

Do not add unnecessary dolphin illustrations to data-heavy screens.

Prefer purposeful animation for AI loading, order success, and warnings.

The primary visual implementation reference is the Figma Make app and published Figma Make website, not a standard Figma design file.

## Required Navigation

Website:
- Dashboard
- Sales Management
- Finance Management
- Settings

Sales tabs:
- Orders
- Vouchers
- Payments

Finance tabs:
- Expenses
- Reports

Floating assistant:
- Chat to Order
- Screenshot to Order Match

Do not add a third primary floating assistant action.

## AI and Data Integrity

- Never invent missing order details.
- Require seller approval before saving AI-created orders.
- Allow all extracted fields to be corrected.
- Never mark screenshots as verified payments automatically.
- Keep financial statuses separate.
- Protect all shop data.
- Preserve voucher revisions.
- Use integer MMK amounts.
- Validate model responses with Zod.

## Security

- Keep API keys server-side.
- Use Supabase RLS.
- Store financial evidence privately.
- Keep Electron context isolation enabled.
- Disable renderer Node integration.
- Restrict IPC and external navigation.
- Never commit secrets.

## Efficiency

- Do not rewrite the entire codebase for a small issue.
- Do not add speculative features.
- Do not create a second business-logic implementation.
- Do not generate large amounts of unused placeholder code.
- Stop when the milestone acceptance criteria pass.

## Completion Report

After each milestone, report:

1. Implemented changes.
2. Files changed.
3. Tests and build checks performed.
4. Known limitations.
5. Remaining work.

Do not automatically start the next milestone.
