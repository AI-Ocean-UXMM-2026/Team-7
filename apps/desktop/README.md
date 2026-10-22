# တူတူတွက်မယ် Windows floating dolphin assistant

This is the Windows Electron prototype for the floating dolphin assistant. It
uses the shared React UI package and ocean-blue tokens, with the approved
dolphin art in `assets/dolphin/`.

From the repository root, run `pnpm install --frozen-lockfile`, then start
`pnpm dev` and `pnpm desktop:dev` in separate terminals. The Electron panel
preserves drafts and performs payment extraction, field review, order matching,
and pending evidence saving in the same floating window. The server handles AI,
shop authorization, and private evidence storage. The first payment action may
open a one-time browser connection page for the existing signed-in website
session. Configure `SALESAYAR_WEB_URL` for a hosted HTTPS workspace; development
defaults to `http://127.0.0.1:3000`. A screenshot alone never verifies payment.
