# Design System

Version: 1.0

## Design Philosophy

A trustworthy financial workspace with a cute, playful AI dolphin companion.

Target balance:
- 70% professional business software.
- 30% playful and friendly character-driven experience.

Do not make the interface childish or generic.

Use the shipped product components and this document as the visual source of truth.

## Colors

Ocean-blue palette:

- Main background: #EAF5FF
- Secondary background: #D8EDFF
- Sidebar navy: #172C78
- Primary interactive blue: #3478F6
- Strong blue: #245DD0
- Aqua accent: #37C9D9
- Text: #183153
- White cards: #FFFFFF
- Success: #16A574
- Warning: #F2AE40
- Error: #E96565

Colors must retain readable contrast and keep financial status meaning consistent.

## Typography

English: Inter or a similar modern sans-serif.

Burmese: Noto Sans Myanmar.

Use readable sizes and sufficient contrast.

Avoid tiny chart labels and unnecessarily large empty form areas.

## Navigation

Desktop:
- Standard left collapsible sidebar.
- Hamburger toggle.
- Consistent icon alignment.
- No irregular sculpted sidebar shapes.

Mobile:
- Bottom navigation with Home, Sales, Finance, Settings.

## Dashboard

Keep the existing Good Morning banner design and size.

Display four KPI cards in one desktop row when container width allows.

The cards must adapt when the sidebar expands or collapses.

On smaller containers, cards can wrap to two or one column to preserve readability.

Welcome overlay:
- Appears as an additional introductory panel.
- Has a close button.
- Does not replace or resize the Good Morning banner.
- Prefer once per login session.

## Sales Management

Tabs: Orders, Vouchers, Payments.

Desktop order details use a right-side drawer.

Mobile order details use a full-screen view.

Forms must support clear quantity editing and missing-field correction.

## Finance Management

Use Finance Management as the product’s density and trust reference for other screens.

Include readable filtered charts, summary cards, and detailed tables.

## Mascot

Official character: cute blue 3D dolphin accountant.

Recognizable features:
- Round glasses.
- Navy vest.
- Teal tie.
- Calculator.
- Financial clipboard.
- Natural dolphin tail.
- No human legs.

Use the official exported character artwork.

Floating launcher:
- Transparent image.
- No visible circular container.
- Compact size.
- Does not cover important controls.

Mascot states:
- Welcome
- Thinking
- Swimming/loading
- Success
- Warning

## Motion

Use meaningful microinteractions:
- Sidebar transitions.
- Tab switching.
- Drawer opening.
- AI extraction.
- Voucher generation.
- Dolphin reactions.

Keep motion subtle, purposeful, and compatible with reduced-motion preferences.

## Accessibility

- Readable color contrast.
- Keyboard focus states.
- Clear labels.
- Accessible touch targets.
- Responsive tables.
- No color-only status communication.
- Correct Burmese text rendering.

## Design Assets

Store approved mascot files under assets/dolphin.

Store Figma screenshots and references under assets/design-references.

Do not replace the mascot with a newly invented character without approval.
## Product Design Reference

The implemented design system, shared components, and validated seller workflows are the visual source of truth.

Finance Management remains the preferred density and financial-trust reference.

The website has:
- Dashboard
- Sales Management
- Finance Management
- Settings
- Floating dolphin assistant

Inspect the running website at desktop and mobile widths before completing visual milestones.

The implementation must follow our approved PRD and design specifications.

The final product name is undecided.

## Approved Design Source

Implementation should follow:
1. This DESIGN_SYSTEM.md file.
2. The product requirements and user flows.
3. Existing shared components and design tokens.
4. The official dolphin assets in `assets/dolphin/`.

When details are unclear, prefer the option that makes seller decisions faster and financial state easier to verify.

## Mascot Assets

Official mascot:
- `assets/dolphin/dolphin-accountant.png`

Floating launcher:
- `assets/dolphin/dolphin-launcher.png`

The launcher must use the same dolphin accountant identity in a smaller transparent launcher-friendly version.

It must not appear inside a visible circle or square container.
