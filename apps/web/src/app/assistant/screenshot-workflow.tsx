"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  buildPaymentEvidenceSavePayload,
  paymentEvidenceReadbackSchema,
  screenshotAnalyzeResponseSchema,
  screenshotExtractionSchema,
  screenshotMatchResponseSchema,
  type ScreenshotAnalyzeResponse,
  type ScreenshotCandidate,
  type ScreenshotExtraction,
} from "@ocean/contracts";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const acceptedMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const emptyExtraction: ScreenshotExtraction = {
  amount_mmk: null,
  transaction_reference: null,
  provider: null,
  transaction_date: null,
  transaction_time: null,
  transaction_time_uncertain: true,
  payer_name: null,
  payee_name: null,
  missing_fields: [],
  uncertain_fields: [],
};

type PendingAction = "pending_review" | "rejected" | null;

function mmk(value: number) { return `${value.toLocaleString("en-US")} MMK`; }
function asNullable(value: string) { return value.trim() || null; }
function asList(value: string) { return value.split(",").map(item => item.trim()).filter(Boolean).slice(0, 24); }
function extractError(body: unknown, fallback: string) {
  return body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : fallback;
}

export function ScreenshotToOrderWorkflow({ shopId }: { shopId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [fileName, setFileName] = useState("");
  const [analysis, setAnalysis] = useState<ScreenshotAnalyzeResponse | null>(null);
  const [originalExtraction, setOriginalExtraction] = useState<ScreenshotExtraction>(emptyExtraction);
  const [extraction, setExtraction] = useState<ScreenshotExtraction>(emptyExtraction);
  const [candidates, setCandidates] = useState<ScreenshotCandidate[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [evidenceId, setEvidenceId] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [saved, setSaved] = useState<"pending_review" | "rejected" | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [notice, setNotice] = useState("");
  const sequence = useRef(0);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function resetForFile(nextFile: File) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
    setFileName(nextFile.name);
    setEvidenceId(crypto.randomUUID());
    setRevision(0);
    setAnalysis(null);
    setOriginalExtraction(emptyExtraction);
    setExtraction(emptyExtraction);
    setCandidates([]);
    setSelectedOrderId(null);
    setSaved(null);
    setPendingAction(null);
    setNotice("Local preview only. Nothing is uploaded until you choose Analyze screenshot.");
  }

  function chooseFile(nextFile: File | undefined) {
    if (!nextFile) return;
    if (!(acceptedMimeTypes as readonly string[]).includes(nextFile.type) || nextFile.size > MAX_IMAGE_BYTES) {
      setNotice("Choose a JPEG, PNG, or WebP image up to 8 MiB. The server will also verify its file signature.");
      return;
    }
    resetForFile(nextFile);
  }

  async function analyze() {
    if (!file) { setNotice("Choose a local JPEG, PNG, or WebP image before analyzing."); return; }
    const current = ++sequence.current;
    setBusy(true);
    setSaved(null);
    setPendingAction(null);
    setSelectedOrderId(null);
    setCandidates([]);
    setNotice("Reading the image securely. It stays local until this action is submitted.");
    try {
      const body = new FormData();
      body.set("shop_id", shopId);
      body.set("evidence_id", evidenceId || crypto.randomUUID());
      body.set("file", file);
      const response = await fetch("/api/ai/screenshot-to-order", { method: "POST", credentials: "same-origin", body });
      const parsed = screenshotAnalyzeResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error(response.ok ? "The screenshot workflow returned an unsupported response." : "The screenshot workflow could not analyze this image.");
      if (current !== sequence.current) return;
      setAnalysis(parsed.data);
      setOriginalExtraction(parsed.data.extraction);
      setExtraction(parsed.data.extraction);
      setCandidates(parsed.data.candidates);
      if (parsed.data.mode === "error") setNotice(parsed.data.error);
      else setNotice(parsed.data.message);
    } catch (error) {
      if (current !== sequence.current) return;
      setAnalysis(null);
      setCandidates([]);
      setNotice(error instanceof Error ? error.message : "The screenshot workflow could not analyze this image.");
    } finally {
      if (current === sequence.current) setBusy(false);
    }
  }

  async function rematch(nextExtraction: ScreenshotExtraction) {
    if (analysis?.mode !== "live") return;
    const current = ++sequence.current;
    setRematching(true);
    try {
      const response = await fetch("/api/payment-evidence/match", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shop_id: shopId, extraction: nextExtraction, image_sha256: analysis.image_sha256 }),
      });
      const parsed = screenshotMatchResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error(response.ok ? "The match response was unsupported." : "The authorized order candidates could not be refreshed.");
      if (current !== sequence.current) return;
      setCandidates(parsed.data.candidates);
      setAnalysis(previous => previous && previous.mode === "live" ? { ...previous, candidates: parsed.data.candidates, duplicate_warnings: parsed.data.duplicate_warnings, evidence_schema_available: parsed.data.evidence_schema_available, message: parsed.data.message } : previous);
      setNotice(parsed.data.message);
    } catch (error) {
      if (current === sequence.current) setNotice(error instanceof Error ? `${error.message} Your edits remain in place; no save was attempted.` : "Candidates could not be refreshed. Your edits remain in place.");
    } finally {
      if (current === sequence.current) setRematching(false);
    }
  }

  function editExtraction<K extends keyof ScreenshotExtraction>(field: K, value: ScreenshotExtraction[K]) {
    if (busy || rematching || saved) return;
    const next = { ...extraction, [field]: value };
    const parsed = screenshotExtractionSchema.safeParse(next);
    if (!parsed.success) { setNotice("That correction is outside the supported screenshot fields."); return; }
    setExtraction(parsed.data);
    setSelectedOrderId(null);
    setCandidates([]);
    setPendingAction(null);
    setNotice("Candidate selection cleared after your correction. Refreshing authorized candidates…");
    void rematch(parsed.data);
  }

  function selectCandidate(candidate: ScreenshotCandidate) {
    if (busy || rematching || saved || !candidate.eligible) return;
    setSelectedOrderId(candidate.order_id);
    setPendingAction(null);
    setNotice("Order candidate selected for seller review. This does not change its payment status.");
  }

  async function save(action: Exclude<PendingAction, null>) {
    if (!file || !analysis || analysis.mode !== "live" || !analysis.evidence_schema_available || saved || busy || rematching) {
      setNotice("Live extraction and the installed private evidence schema are required before saving.");
      return;
    }
    const selected = selectedOrderId ? candidates.find(candidate => candidate.order_id === selectedOrderId) : null;
    if (selectedOrderId && !selected?.eligible) { setNotice("Choose an eligible confirmed order, or clear the match before saving pending evidence."); return; }
    if (pendingAction !== action) { setPendingAction(action); setNotice(action === "pending_review" ? "Click Save pending review again to confirm the seller-reviewed evidence." : "Click Reject evidence again to confirm the rejection record."); return; }
    const current = ++sequence.current;
    setBusy(true);
    setPendingAction(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("payload", JSON.stringify(buildPaymentEvidenceSavePayload({
        shopId,
        evidenceId,
        orderId: selectedOrderId,
        status: action,
        expectedRevision: revision,
        originalExtraction,
        sellerReviewed: extraction,
      })));
      const response = await fetch("/api/payment-evidence", { method: "POST", credentials: "same-origin", body });
      const raw = await response.json();
      if (!response.ok) throw new Error(extractError(raw, "The private evidence review could not be saved."));
      const readback = paymentEvidenceReadbackSchema.safeParse(raw && typeof raw === "object" && "evidence" in raw ? raw.evidence : null);
      if (!readback.success) throw new Error("The save returned no valid readback. Reload evidence before retrying to avoid a duplicate.");
      if (current !== sequence.current) return;
      setRevision(readback.data.revision);
      setSaved(readback.data.status);
      setNotice(readback.data.status === "pending_review" ? "Evidence saved as pending review and read back. No payment status was changed." : "Evidence rejection was saved and read back. No payment status was changed.");
    } catch (error) {
      if (current === sequence.current) setNotice(error instanceof Error ? error.message : "The evidence save failed. Your stable review ID and edits are preserved for retry.");
    } finally {
      if (current === sequence.current) setBusy(false);
    }
  }

  const canSave = analysis?.mode === "live" && analysis.evidence_schema_available && !saved;
  const duplicateWarnings = analysis?.duplicate_warnings ?? [];
  return <section className="hosted-workflow" aria-labelledby="hosted-match-heading">
    <div className="hosted-workflow-heading"><span className="hosted-workflow-icon" aria-hidden="true">⌁</span><div><span className="eyebrow">A helpful second look</span><h2 id="hosted-match-heading">Screenshot to Order Match</h2></div></div>
    <div className="hosted-safety-note"><strong>Suggestion only</strong><span>A screenshot cannot confirm received funds. This workflow never updates an order payment status or creates a trusted receipt.</span></div>
    <div className="hosted-match-actions">
      <button className="hosted-primary-button" type="button" disabled={busy || rematching || Boolean(saved)} onClick={() => { if (preview) URL.revokeObjectURL(preview); setPreview(""); setAnalysis({ mode: "simulation", extraction: emptyExtraction, candidates: [], duplicate_warnings: [], image_sha256: null, evidence_schema_available: false, message: "Synthetic sample only. Choose a local image to analyze." }); setOriginalExtraction(emptyExtraction); setExtraction(emptyExtraction); setCandidates([]); setSelectedOrderId(null); setFile(null); setFileName("synthetic-transfer-example"); setNotice("Synthetic sample selected. It is not a real transaction and cannot be analyzed or saved."); }}>Use sample image</button>
      <label className="hosted-secondary-button">Choose local image<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || rematching || Boolean(saved)} onChange={event => chooseFile(event.currentTarget.files?.[0])} /></label>
    </div>
    {preview && <div className="hosted-screenshot-preview"><Image className="hosted-screenshot" src={preview} alt={`Local preview of ${fileName}`} width={720} height={360} unoptimized /></div>}
    {file && <div className="hosted-local-file"><strong>{fileName}</strong><span>{(file.size / (1024 * 1024)).toFixed(2)} MiB · local preview until Analyze screenshot</span></div>}
    <button className="hosted-primary-button" type="button" disabled={!file || busy || rematching || Boolean(saved)} onClick={() => void analyze()}>{busy ? "Working…" : "Analyze screenshot"}</button>
    {busy && <div className="hosted-status-card" role="status">The image is being checked and the review draft is being prepared…</div>}
    {analysis && <section className="hosted-match-card hosted-evidence-card" aria-labelledby="evidence-details-heading">
      <div className="hosted-preview-heading"><div><span className="eyebrow">Seller review draft</span><h3 id="evidence-details-heading">Extracted transaction details</h3></div><span className={`hosted-mode hosted-mode-${analysis.mode === "live" ? "live" : "simulation"}`}>{analysis.mode === "live" ? "AI draft" : analysis.mode === "error" ? "Unavailable" : "Simulation"}</span></div>
      <p className="hosted-note">{analysis.mode === "live" ? "Correct every readable field. A correction clears the selected order and refreshes candidates." : analysis.mode === "simulation" ? "Simulation-only mode is clearly marked. The image is not stored or sent to an AI provider, orders are not queried, and evidence is not saved." : analysis.error}</p>
      <div className="hosted-fields hosted-evidence-fields">
        <label>Amount (MMK)<input disabled={busy || rematching || Boolean(saved)} type="number" min="0" step="1" value={extraction.amount_mmk ?? ""} onChange={event => editExtraction("amount_mmk", event.target.value.trim() ? Number(event.target.value) : null)} /></label>
        <label>Provider<input disabled={busy || rematching || Boolean(saved)} value={extraction.provider ?? ""} onChange={event => editExtraction("provider", asNullable(event.target.value))} /></label>
        <label>Transaction reference<input disabled={busy || rematching || Boolean(saved)} value={extraction.transaction_reference ?? ""} onChange={event => editExtraction("transaction_reference", asNullable(event.target.value))} /></label>
        <label>Payer name<input disabled={busy || rematching || Boolean(saved)} value={extraction.payer_name ?? ""} onChange={event => editExtraction("payer_name", asNullable(event.target.value))} /></label>
        <label>Payee name<input disabled={busy || rematching || Boolean(saved)} value={extraction.payee_name ?? ""} onChange={event => editExtraction("payee_name", asNullable(event.target.value))} /></label>
        <label>Date<input disabled={busy || rematching || Boolean(saved)} type="date" value={extraction.transaction_date ?? ""} onChange={event => editExtraction("transaction_date", asNullable(event.target.value))} /></label>
        <label>Time<input disabled={busy || rematching || Boolean(saved)} type="time" value={extraction.transaction_time ?? ""} onChange={event => editExtraction("transaction_time", asNullable(event.target.value))} /></label>
        <label className="hosted-checkbox-field"><input disabled={busy || rematching || Boolean(saved)} type="checkbox" checked={extraction.transaction_time_uncertain} onChange={event => editExtraction("transaction_time_uncertain", event.target.checked)} /> Time needs review</label>
        <label className="hosted-wide">Missing fields <input disabled={busy || rematching || Boolean(saved)} value={extraction.missing_fields.join(", ")} onChange={event => editExtraction("missing_fields", asList(event.target.value))} /></label>
        <label className="hosted-wide">Uncertain fields <input disabled={busy || rematching || Boolean(saved)} value={extraction.uncertain_fields.join(", ")} onChange={event => editExtraction("uncertain_fields", asList(event.target.value))} /></label>
      </div>
      {rematching && <div className="hosted-status-card" role="status">Refreshing candidates for the corrected details…</div>}
      {duplicateWarnings.length > 0 && <div className="hosted-missing" role="status"><strong>Same-shop duplicate warning</strong><span>{duplicateWarnings.map(warning => warning.message).join(" ")} This is a warning, not a payment confirmation.</span></div>}
      {analysis.mode === "live" && analysis.evidence_schema_available === false && <div className="hosted-missing" role="status"><strong>Review persistence is not installed</strong><span>Apply the unapplied Milestone 2B.3 migration and private bucket policies before attempting a save.</span></div>}
      {candidates.length > 0 ? <div className="hosted-candidate-list" aria-label="Authorized order candidates">{candidates.map(candidate => <button key={candidate.order_id} className={`hosted-candidate ${selectedOrderId === candidate.order_id ? "hosted-candidate-selected" : ""}`} type="button" disabled={!candidate.eligible || busy || rematching || Boolean(saved)} onClick={() => selectCandidate(candidate)}><span className="hosted-candidate-top"><strong>{candidate.customer_name ?? "Unnamed customer"}</strong><span className={`hosted-mode hosted-mode-${candidate.match_state === "exact" ? "live" : "simulation"}`}>{candidate.match_state}</span></span><span>{mmk(candidate.total_mmk)} · {candidate.amount_relation} amount · {candidate.customer_relation} customer</span><span>{candidate.order_status} · {candidate.payment_status} · {candidate.fulfillment_status}</span><small>{candidate.reasons.join(" ")}</small>{candidate.duplicate_warning && <small className="hosted-danger">Duplicate evidence warning: {candidate.duplicate_warning.replace("_", " ")}</small>}</button>)}</div> : analysis.mode === "live" && !rematching && <div className="hosted-review-status"><strong>No candidate is ready to select</strong><span>{extraction.amount_mmk === null ? "A readable amount is needed for a useful match; you may still save unmatched evidence for review." : "No same-shop order met the bounded matching conditions."}</span></div>}
      <div className="hosted-review-status"><strong>{saved ? saved === "pending_review" ? "Pending review saved" : "Evidence rejected" : "Seller decision required"}</strong><span>{saved ? "Readback succeeded. Payment status and order records were unchanged." : "Choose an eligible candidate if one is appropriate, then save as pending review or record an explicit rejection."}</span></div>
      {canSave && <div className="hosted-evidence-actions"><button className="hosted-primary-button" type="button" disabled={busy || rematching} onClick={() => void save("pending_review")}>{pendingAction === "pending_review" ? "Click again to confirm pending review" : "Save pending review"}</button><button className="hosted-secondary-button hosted-danger-button" type="button" disabled={busy || rematching} onClick={() => void save("rejected")}>{pendingAction === "rejected" ? "Click again to confirm rejection" : "Reject evidence"}</button></div>}
    </section>}
    {notice && <p className="hosted-notice" role="status">{notice}</p>}
  </section>;
}
