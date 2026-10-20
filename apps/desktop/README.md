# Windows floating dolphin assistant

This is the Windows Electron prototype for the floating dolphin assistant. It
uses the shared React UI package and ocean-blue tokens, with the approved
dolphin art in `assets/dolphin/`.

From the repository root, run `pnpm install --frozen-lockfile`, then
`pnpm desktop:dev`. The local Electron panel is an offline simulation: its Chat
to Order parser never sends customer messages or saves orders. To open the live
flow, configure the main process with `SALESAYAR_ASSISTANT_URL` pointing to the
single hosted HTTPS app origin; the launcher then opens the hosted `/assistant`
route, which handles email/password sign-in, shop authorization, server-side AI,
and authenticated order readback. Google OAuth is not embedded in Electron.
Screenshot to Order Match remains simulation-only and never verifies payment.
Details and release limitations are in `docs/MILESTONE_2B_2.md`.
