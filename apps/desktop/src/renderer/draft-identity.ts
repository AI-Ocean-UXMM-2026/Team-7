export function resolveDraftOrderId(existing: string | null, createId: () => string) {
  return existing ?? createId();
}

export function canConfirmDraft(confirmed: boolean, confirmationInFlight: boolean) {
  return !confirmed && !confirmationInFlight;
}
