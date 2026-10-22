export const ipcChannels = {
  command: "assistant:command",
  launcherDrag: "assistant:launcher-drag",
  loadDraft: "assistant:load-draft",
  saveDraftFields: "assistant:save-draft-fields",
  saveDraftScreenshot: "assistant:save-draft-screenshot",
  readClipboardText: "assistant:read-clipboard-text",
  writeClipboardText: "assistant:write-clipboard-text",
  readClipboardImage: "assistant:read-clipboard-image",
  analyzePayment: "assistant:analyze-payment",
  rematchPayment: "assistant:rematch-payment",
  savePaymentEvidence: "assistant:save-payment-evidence",
  receivingAccounts: "assistant:receiving-accounts",
} as const;
