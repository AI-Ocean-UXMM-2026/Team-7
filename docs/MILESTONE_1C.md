# Milestone 1C — Electron drag fix and MVP polish

Status: Phase A passed manual repeated-drag/click verification on Windows at
125% scaling before Phases B–D began. Website and assistant polish are complete,
all final checks passed, and the polished native drag/draft regression passed.
Stopped for review. No future milestone, commit, or push.

## Inspection and correction

Read AGENTS.md, PRD, architecture, design system, user flows, test plan, and the
Milestone 1A/1B handoffs before editing.

The previous drag implementation combined DOM screenX/screenY with Electron
window/display coordinates. The main process now samples
`screen.getCursorScreenPoint()` for both start and movement. Electron documents
this as DIP coordinates, matching native display work areas and window bounds:
https://www.electronjs.org/docs/latest/api/screen#screengetcursorscreenpoint
No manual scale-factor multiplication or division is applied. The initial grab
offset is preserved; each move uses the cursor's nearest display, the actual
window dimensions, and final integer position rounding. Negative display origins
and taskbar work-area exclusions are supported.

The renderer previously ended a gesture only on button pointerup/pointercancel.
It now also handles lostpointercapture, global capture-phase pointerup/cancel,
window blur, document hiding, component cleanup, and movement with the left mouse
button no longer held. Cleanup is idempotent and clears state before explicitly
releasing capture. Main-process blur, navigation, renderer failure, and window
closure cancel the native session. An unmatched or ended session cannot move the
window; a new pointerdown replaces any old session.

These were confirmed code-level gaps but did not resolve the narrowing. A
diagnostic run on the user's Windows display at scale factor 1.25 identified the
actual restriction: `setPosition()` enlarged the native transparent window on
successive movement events. Its dimensions grew while the display work area
remained 1536 × 816 DIP. The clamp then correctly reserved the growing window's
size, leaving progressively less available movement. The centered dolphin also
shifted within the enlarged transparent surface.

Representative diagnostic bounds (DIP):

```text
ready:   { x: 1408, y: 668, width: 108, height: 108 }
move:    { x: 1406, y: 660, width: 109, height: 108 }
move:    { x: 1391, y: 213, width: 127, height: 125 }
end:     { x:  751, y:   0, width: 423, height: 332 }
settled: { x:  751, y:   0, width: 423, height: 332 }
later:   { x:  585, y: 112, width: 880, height: 704 }
```

The window remained visible and not minimized. Pointerup/end/lostpointercapture
were delivered, so this reproduction did not implicate missing release events.
The correction replaces only the launcher `setPosition()` call with
`setBounds({ x, y, width: 106, height: 106 }, false)`, explicitly supplying the
original requested dimensions on every move instead of reusing a DPI-rounded
native size. Windows' observed native size may differ slightly from the requested
106 DIP, but it must remain stable across movement events and repeated drags.

Retest logs confirmed dimensions stayed within 107–108 DIP across repeated moves,
rather than growing. Recorded positions reached the work-area edges; releases
produced end/pointerup and lostpointercapture. The user confirmed: “Repeated
dragging and clicking now work.” Temporary diagnostics were then removed.

There is no global mouse hook: outside-window releases rely on Chromium pointer
capture and the listed fallback events. Main-process movement happens only in
response to a validated renderer movement event, not an autonomous polling loop.

The custom hit mask remains removed. No setShape, setIgnoreMouseEvents, opacity,
or launcher hide behavior was introduced. The frameless transparent appearance,
always-on-top behavior, restricted preload, sender validation, fractional IPC
coordinate validation, and draft store remain intact. Transparent-margin input
behavior must be checked over Chrome because there is no custom hit mask.

## Phase B — Website refinement

Inspected the approved published Figma Make Dashboard, Sales Management, Finance
Management, and Settings in the browser:
https://entry-align-51407368.figma.site/

- Preserved the existing Good Morning banner, official dolphin assets, shared
  ocean palette, and four primary destinations.
- Refined sidebar branding, toggle alignment, collapsed navigation, mobile bottom
  navigation, the sample disclosure, and a working sample-order header search.
- KPI columns respond to content width: four when space allows, two at narrower
  desktop/tablet and 390px mobile, and one at 320px mobile.
- Added accessible, static sample sales/cash-flow/expense charts and consistent
  sample order/activity/expense rows. No live financial calculations were added.
- Local order search and status filtering work, including an empty state/reset.
- Preserved Orders/Vouchers/Payments and Expenses/Reports tabs. Unconnected
  voucher/payment features explain their limits instead of exposing fake actions.
- Settings use labeled read-only sample profile fields and preferences.
- Added loading skeletons, readable chart/table labels, focus/hover states,
  responsive tables and reduced-motion support within the existing design system.

## Phases C–D — Assistant and presentation

- Exactly two primary home actions remain: Chat to Order and Screenshot to Order Match.
- Refined compact field sizes, explanatory text, review callouts and feedback.
- Replaced repeated DEMO/TEST-style copy with a sample-workspace disclosure and
  explicit simulation explanations at extraction, confirmation and review.
- Added a subtle idle image float, paused on pointerdown; retained thinking
  motion; added a restrained success mascot and warning pulse. The image animation
  never modifies native window bounds, hit geometry, or drag coordinates.
- Screenshot matches remain preset. Removed the invented confidence score.
  Images are not uploaded/analyzed and review never confirms received funds.
- Consistent sample story: Thiri Mon, order SS-1048, two Mira tote bags, 45,000 MMK,
  with payment needing review. The wallet illustration remains clearly synthetic.
- Main-process draft storage/hydration are unchanged. Reduced motion disables
  animations/transitions; no new mascot artwork or dependencies were introduced.

## Changed-file inventory

- apps/desktop/src/main/index.ts — native DIP cursor sampling and lifecycle cleanup.
- apps/desktop/src/main/launcher-drag.ts — testable drag session and work-area clamp.
- apps/desktop/src/main/launcher-drag.test.ts — five focused tests.
- apps/desktop/src/renderer/Launcher.tsx — release/capture/blur cleanup and button-state guard.
- docs/MILESTONE_1C.md — this handoff.

Website/presentation files:

- apps/web/src/components/app-shell.tsx
- apps/web/src/components/orders-table.tsx (new)
- apps/web/src/components/sample-charts.tsx (new)
- apps/web/src/lib/sample-data.ts (new)
- apps/web/src/app/page.tsx
- apps/web/src/app/sales/page.tsx
- apps/web/src/app/finance/page.tsx
- apps/web/src/app/settings/page.tsx
- apps/web/src/app/loading.tsx (new)
- apps/web/src/app/globals.css
- apps/web/package.json (documented Webpack production-build fallback)
- packages/ui/src/index.tsx (search icon and placeholder copy)
- apps/desktop/src/renderer/App.tsx
- apps/desktop/src/renderer/styles.css
- apps/desktop/src/renderer/assets/demo-transfer.svg (sample wording only)
- README.md (current status and start instructions)
- apps/web/AGENTS.md (generated by the installed Next.js dev server)

No shared token/mascot replacements, embedded credentials, database tables,
production AI, vouchers backend, or real payment integrations.

## Automated validation

Passed:

- `node --test apps/desktop/src/main/launcher-drag.test.ts` (5 tests): threshold,
  grab offset, all work-area edges, taskbar exclusion, fractional DIP coordinates,
  negative-origin display, matching pointer identity, release/cancel, second drag,
  and 20 consecutive sessions retaining full work-area reach.
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm desktop:build`
- `git diff --check`

Electron's sandboxed version command still exits with Windows code 2147483651.
Outside the execution sandbox it reports v44.9.1, and `pnpm desktop:start` launches
the rebuilt assistant. The earlier sandbox failure is not evidence that Electron
itself is broken on the presentation computer. Physical drag behavior was manually
verified as described above, not automatically injected by a UI test tool.

The default Turbopack production build failed while starting its CSS worker, both
inside and outside the sandbox. Direct PostCSS compilation succeeded (32,412
bytes), and Next.js's documented `next build --webpack` fallback completed. The
web package's build script now uses that bundled fallback; no framework version
or dependency change was required. Development still uses the default bundler.

## Manual Phase A checklist and remaining native coverage

1. Plain-click the dolphin: assistant opens. Minimize/close the panel.
2. Hold the left button on the dolphin and drag to left, right, top and bottom
   work-area edges, including corners. It stays visible and within usable bounds.
3. Release at each edge, then move the mouse without holding a button. The
   dolphin stays put. Start a second drag successfully.
4. Drag quickly outside the original launcher rectangle and release. Repeat
   after switching focus to another app during a drag. No stuck movement remains.
5. Plain-click after dragging: assistant opens without an unintended drag.
6. Check transparency and always-on-top behavior over Chrome/Messenger. Click
   nearby browser controls, including through transparent margins where possible.
7. If available, repeat at 125%/150% scaling and across displays with different
   scaling, including a monitor positioned left of the primary display.
8. Enter and edit a chat order, minimize/restore, and confirm edits remain.
   Repeat with a selected screenshot. No simulated action reruns on restoration.

The first manual failure stopped UI work; polish began only after the corrected
repeated-drag/click retest passed. The final polished build was then manually
retested: the user confirmed “Dragging and both drafts are preserved,” covering
idle-animation dragging plus minimize/reopen with edited chat and a screenshot.
Multi-display/150% scaling and transparent-margin hit testing were not separately
confirmed and remain additional coverage.

## Browser validation

- Dashboard expanded/collapsed sidebar; four versus two KPI columns; weekly chart,
  activity and sample recent orders.
- Header search, local order search/status filtering, empty state/reset, and
  Sales Orders/Vouchers/Payments navigation.
- Finance Reports/Expenses, charts, sample expense/transaction tables; Settings
  read-only fields and preference layout.
- Iframe viewports at 390, 320 and 768 px: bottom-nav navigation, chart labels,
  table scrolling, KPI wrapping and stacked Settings. These are real browser
  viewport checks, not physical mobile-device tests.
- Assistant at 410px: both actions, Burmese sample, simulated thinking, editing
  customer/product/quantity/price/delivery, 3 × 23,000 = 69,000 MMK, simulated
  confirmation, bundled sample image, local PNG selection/preview, and review
  feedback preserving unverified payment status.
- Assistant browser checks used a temporary limited preview bridge; they do not
  prove native hide/minimize or main-process draft restoration. The temporary
  responsive/assistant HTML files were removed before final builds.
- Reduced-motion CSS was reviewed; the OS preference was not changed.
- The final Webpack production build is served at http://127.0.0.1:3001 for review.

## Restart

Use separate PowerShell terminals. Stop previous instances with Ctrl+C first.

Website:

```powershell
Set-Location 'D:\Buildathon\ocean-ai-assistant'
pnpm dev
```

Normally http://127.0.0.1:3000; Next.js chooses another port if occupied. The updated
review preview in this session is http://127.0.0.1:3001.

Desktop:

```powershell
Set-Location 'D:\Buildathon\ocean-ai-assistant'
pnpm desktop:build
pnpm desktop:start
```

The build step is required after editing Electron main/preload code; the existing
`desktop:dev` command starts the built main process and the live renderer.

Known limits: sample-only data/flows, read-only Settings, no live AI or financial
writes, no voucher creation/export, no full Burmese interface translation, and
additional native/display coverage listed above. Stop after Milestone 1C for review.
