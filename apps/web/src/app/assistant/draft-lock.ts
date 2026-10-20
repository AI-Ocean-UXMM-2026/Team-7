export type HostedDraftPhase = "editable" | "saving" | "saved";

export function canMutateHostedDraft(phase: HostedDraftPhase, inFlight: boolean) {
  return phase === "editable" && !inFlight;
}

export function canAnalyzeHostedDraft(phase: HostedDraftPhase, inFlight: boolean) {
  return canMutateHostedDraft(phase, inFlight);
}

export function canConfirmHostedDraft(phase: HostedDraftPhase, inFlight: boolean) {
  return canMutateHostedDraft(phase, inFlight);
}

export function resolveHostedSave(phase: HostedDraftPhase, outcome: "success" | "failure") {
  if (phase !== "saving") return phase;
  return outcome === "success" ? "saved" : "editable";
}

export function startNewHostedDraft(phase: HostedDraftPhase, inFlight: boolean) {
  return phase === "saved" && !inFlight ? "editable" : null;
}
