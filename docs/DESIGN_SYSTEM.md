# Design System

Version: 1.0

## Design Philosophy

A trustworthy financial workspace with a cute, playful AI dolphin companion.

Target balance:
- 70% professional business software.
- 30% playful and friendly character-driven experience.

Do not make the interface childish or generic.

Use the approved Figma design as the primary visual reference.

## Colors

Working palette:

- Main background: #EAF5FF
- Secondary background: #D8EDFF
- Sidebar navy: #172C78
- Primary interactive blue: #3478F6
- Aqua accent: #37C9D9
- Text: #183153
- White cards: #FFFFFF
- Success: #16A574
- Warning: #F2AE40
- Error: #E96565

Exact values may be refined from the approved Figma file.

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

Use the approved Finance Management page as the visual foundation for other screens.

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
## Approved Design Reference

Our current UI/UX prototype is a Figma Make website:

https://entry-align-51407368.figma.site/

Use this as the primary visual reference for layout, navigation, colors, component styling, and interactions.

Finance Management is our preferred visual design reference.

The website has:
- Dashboard
- Sales Management
- Finance Management
- Settings
- Floating dolphin assistant

Codex should inspect the live website using a browser-capable environment when available.

If the website cannot be inspected, report that limitation rather than inventing the design.

The implementation must follow our approved PRD and design specifications.

The final product name is undecided.

## Approved Design Source

Our approved UI reference is the Figma Make project and published Figma Make website.

Primary design reference:
https://entry-align-51407368.figma.site/

The team uses the Figma Make app as the main design source of truth.

Implementation should follow:
1. This DESIGN_SYSTEM.md file
2. The approved Figma Make UI
3. The official dolphin assets in `assets/dolphin/`

Do not redesign the interface based only on text requirements if the Figma Make design is available.

If implementation details are unclear, follow the latest approved Figma Make version.

## Mascot Assets

Official mascot:
- `assets/dolphin/dolphin-accountant.png`

Floating launcher:
- `assets/dolphin/dolphin-launcher.png`

The launcher must use the same dolphin accountant identity in a smaller transparent launcher-friendly version.

It must not appear inside a visible circle or square container.