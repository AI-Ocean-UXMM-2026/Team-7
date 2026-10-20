# Milestone 1B: Windows Floating Dolphin Prototype

Status: implemented for review. This milestone adds a local Electron companion
to the existing website foundation. It does not add production services or
financial writes.

## What is included

- `apps/desktop` is a React, TypeScript, Vite, and Tailwind Electron app in the
  existing pnpm workspace. It imports the shared ocean-blue design tokens and
  shared UI icons.
- The floating launcher uses the approved transparent
  `assets/dolphin/dolphin-launcher.png` directly, without a visible circle or
  square. The frameless transparent window is placed in the Windows work area
  and configured always on top for ordinary application windows.
- Clicking the launcher opens a compact assistant panel with exactly two
  primary choices: **Chat to Order** and **Screenshot to Order Match**. The
  panel has draggable title space, minimize and close controls, and hides rather
  than destroys its window so the draft remains in memory when reopened from
  the launcher.
- Chat to Order accepts editable English or Burmese sample chat. Analyze Chat
  shows a short thinking state and then a fixed, explicitly synthetic example
  order. Customer, product, quantity, unit price, and delivery address are
  editable; the line total updates from the sample fields. Confirming displays
  a simulated confirmation only.
- Screenshot to Order Match can preview the bundled synthetic transfer
  illustration or a locally selected PNG, JPEG, WebP, or GIF up to 8 MB. The
  suggested order and MMK amount are predetermined. Review is required; the
  UI says the suggestion is unverified and never marks a payment received.
- Every workflow is marked DEMO / SIMULATED. Chat text and selected image stay
  in the local renderer; there is no network upload or backend write.
- Electron enables context isolation and sandboxing, disables renderer Node
  integration, exposes only two narrow preload methods, validates commands
  with a strict Zod schema, and checks the sending window before acting. The
  preload bundle is self-contained so it uses only Electron's approved preload
  API. Navigation and new-window requests are restricted to the local app.
- Existing website screens, design-reference files, documentation, and both
  approved dolphin image files are preserved. `.env` and `.env.local` remain
  ignored by Git; Electron release output is also ignored.

## Start it for the presentation

Requires the versions in the root README (Node.js 24.13+ and pnpm 11.25.0).
Open two PowerShell terminals at the repository root.

Website terminal:

```powershell
Set-Location D:\Buildathon\ocean-ai-assistant
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:3000` in a browser.

Electron terminal:

```powershell
Set-Location D:\Buildathon\ocean-ai-assistant
pnpm desktop:dev
```

`pnpm desktop:dev` starts the renderer on `127.0.0.1:5173` and the Windows
assistant. Keep that terminal open during the demo. For the built app, run
`pnpm desktop:build` followed by `pnpm desktop:start`. The workspace does not
produce an installer in this milestone.

## Checks and demo validation

Passed on Windows:

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build` (website)
- `pnpm desktop:build` (Electron main, self-contained preload, and renderer)
- `pnpm desktop:start` launched the built Electron process.
- The renderer UI was exercised in a local browser preview: both primary
  actions; simulated thinking and order generation; editing all five order
  fields and recalculating the total; simulated confirmation; bundled example
  image preview; local PNG selection and preview; predetermined match details;
  review messaging and unverified payment status.

The team manually confirmed the transparent always-on-top launcher, click-to-open,
and both primary actions before the follow-up interaction fixes. In the follow-up,
the restricted shell could not expose the Electron window, so the updated native
drag, hit testing over Chrome/Messenger, and minimize/restore flows could not be
retested through the Windows UI bridge. The production Electron process starts;
Chromium logged cache-permission warnings, but the process remained open. These
specific interactions still need a hands-on check on the presentation machine.
No Messenger account or conversations were accessed.

## Milestone 1B interaction bug fixes

- Launcher drag root cause: the launcher put `-webkit-app-region: drag` on its
  stage but `no-drag` on the dolphin button, so the visible mascot could click
  but could not initiate native dragging. Pointer gestures now use a 6px movement
  threshold and a narrowly scoped, validated launcher-position IPC event. The
  main process clamps the launcher to the pointer's display work area. A Windows
  hit shape previously came from the approved PNG's alpha silhouette. The
  visibility follow-up removes this custom shape while retaining the frameless,
  transparent, always-on-top launcher and its validated drag IPC.
- Draft-loss root cause: assistant workflow fields existed only in renderer
  React state. Hiding the current BrowserWindow retains that state, but a renderer
  reload or window recreation does not. Workflow fields and selected screenshot
  preview details are now copied into a session-only main-process memory store
  through validated, panel-only IPC. The renderer hydrates before showing the
  form; transient analysis/loading state is never stored or resumed.

Follow-up checks passed: `pnpm lint`, `pnpm typecheck`, `pnpm build`, and
`pnpm desktop:build`. The visibility follow-up was not runtime-tested: Electron
could not be started in the current environment (`electron --version` exits with
Windows code `2147483651`). The user's report confirms disappearance during and
after a drag, while source inspection found no drag-time hide, minimize, opacity,
or renderer visibility changes. The removed native hit shape is the leading
suspect, but the cause and result of disabling it remain unverified until tested
on the presentation machine. Native dragging, click-after-drag, click-through to
Chrome, and edited draft restoration still need hands-on checks there.

## Deliberate limits

Chat extraction is a predetermined fixture and does not parse the entered chat.
Screenshot recognition and matching are predetermined and do not inspect the
selected image. Nothing is saved or sent. Authentication, Supabase, AI services,
payment verification, voucher generation, financial logic, installers, and the
Electron overlay's connection to the website remain outside Milestone 1B.
