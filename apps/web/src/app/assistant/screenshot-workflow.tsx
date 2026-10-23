"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@ocean/ui";
import { compareReceiptRecipient } from "@ocean/core";
import type { PublicReceivingAccount } from "@/components/receiving-accounts";

declare global {
  interface Window { floatingAssistant?: { takePaymentImage: () => Promise<string | null>; backToAssistant: () => Promise<void> } }
}
import {
  buildPaymentEvidenceSavePayload,
  localPaymentEvidenceReadbackSchema,
  paymentEvidenceReadbackSchema,
  paymentEvidenceResumeResponseSchema,
  paymentEvidenceVerifyReadbackSchema,
  paymentEvidenceVerifyRequestSchema,
  screenshotAnalyzeResponseSchema,
  screenshotExtractionSchema,
  screenshotMatchResponseSchema,
  type ScreenshotAnalyzeResponse,
  type ScreenshotCandidate,
  type ScreenshotExtraction,
  type PaymentEvidenceVerifyReadback,
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
  payee_account: null,
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

export function ScreenshotToOrderWorkflow({ shopId, resumeEvidenceId }: { shopId: string; resumeEvidenceId?: string | null }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [previewReadable, setPreviewReadable] = useState(false);
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
  const [matchesStale, setMatchesStale] = useState(false);
  const [saved, setSaved] = useState<"pending_review" | "rejected" | "verified" | null>(null);
  const [verificationReadback, setVerificationReadback] = useState<PaymentEvidenceVerifyReadback | null>(null);
  const [trustedRecordConfirmed, setTrustedRecordConfirmed] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const [receivingAccounts, setReceivingAccounts] = useState<PublicReceivingAccount[] | null>(null);
  const sequence = useRef(0);
  const pasteTarget = useRef<HTMLDivElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    let active = true;
    fetch(`/api/shop-receiving-accounts?shop_id=${encodeURIComponent(shopId)}`, { credentials: "same-origin" })
      .then(async response => { if (!response.ok) throw new Error("Receiving accounts unavailable"); return response.json() as Promise<{ accounts: PublicReceivingAccount[] }>; })
      .then(result => { if (active) setReceivingAccounts(result.accounts); })
      .catch(() => { if (active) setReceivingAccounts(null); });
    return () => { active = false; };
  }, [shopId]);

  useEffect(() => {
    if (!resumeEvidenceId) return;
    let active = true;
    async function resume() {
      setBusy(true);
      setNotice("Loading the saved private evidence review…");
      try {
        const query = new URLSearchParams({ shop_id: shopId, evidence_id: resumeEvidenceId! });
        const response = await fetch(`/api/payment-evidence?${query.toString()}`, { credentials: "same-origin" });
        const raw: unknown = await response.json();
        const parsed = paymentEvidenceResumeResponseSchema.safeParse(raw);
        if (!response.ok || !parsed.success) throw new Error(extractError(raw, "The saved evidence review could not be loaded."));
        if (!active) return;
        const data = parsed.data;
        setEvidenceId(data.evidence.id);
        setRevision(data.evidence.revision);
        setOriginalExtraction(data.evidence.extracted);
        setExtraction(data.evidence.seller_reviewed);
        setCandidates(data.candidates);
        setMatchesStale(false);
        setSelectedOrderId(data.evidence.order_id);
        setAnalysis({
          mode: "manual",
          extraction: data.evidence.extracted,
          candidates: data.candidates,
          duplicate_warnings: data.duplicate_warnings,
          image_sha256: data.image_sha256,
          evidence_schema_available: data.evidence_schema_available,
          verification_available: data.verification_available,
          message: data.message,
        });
        setSaved(data.evidence.status);
        setFile(null);
        if ("image_data" in data.evidence && data.evidence.image_data) {
          setPreview(data.evidence.image_data);
          setPreviewReadable(true);
        }
        setFileName("Saved private evidence");
        setNotice(data.evidence.status === "pending_review" ? `${data.message} The original image remains private; you can edit fields or verify from a trusted record.` : data.message);
      } catch (error) {
        if (active) setNotice(error instanceof Error ? error.message : "The saved evidence review could not be loaded.");
      } finally {
        if (active) setBusy(false);
      }
    }
    void resume();
    return () => { active = false; };
  }, [resumeEvidenceId, shopId]);

  function resetForFile(nextFile: File) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
    setPreviewReadable(false);
    setFileName(nextFile.name);
    setEvidenceId(crypto.randomUUID());
    setRevision(0);
    setAnalysis(null);
    setOriginalExtraction(emptyExtraction);
    setExtraction(emptyExtraction);
    setCandidates([]);
    setMatchesStale(false);
    setSelectedOrderId(null);
    setSaved(null);
    setVerificationReadback(null);
    setTrustedRecordConfirmed(false);
    setPendingAction(null);
    setNotice("Local preview only. Nothing is uploaded until you choose Analyze screenshot.");
  }

  function chooseFile(nextFile: File | undefined) {
    if (!nextFile) return;
    if (!(acceptedMimeTypes as readonly string[]).includes(nextFile.type) || nextFile.size === 0 || nextFile.size > MAX_IMAGE_BYTES) {
      if (preview) URL.revokeObjectURL(preview);
      setFile(null);
      setPreview("");
      setPreviewReadable(false);
      setFileName("");
      setAnalysis(null);
      setCandidates([]);
      setSelectedOrderId(null);
      setSaved(null);
      setVerificationReadback(null);
      setNotice("Choose a JPEG, PNG, or WebP image up to 8 MiB. The server will also verify its file signature.");
      return;
    }
    resetForFile(nextFile);
  }

  useEffect(() => {
    if (!window.floatingAssistant?.takePaymentImage || resumeEvidenceId) return;
    let active = true;
    void window.floatingAssistant.takePaymentImage().then(async source => {
      if (!source || !active || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/u.test(source)) return;
      const blob = await fetch(source).then(response => response.blob());
      if (active) chooseFile(new File([blob], "Transaction image.png", { type: "image/png" }));
    }).catch(() => { if (active) setNotice("The selected image could not be transferred. Choose it again here."); });
    return () => { active = false; };
  }, [resumeEvidenceId]);

  function pastedImage(items: DataTransferItemList) {
    for (const item of Array.from(items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) return item.getAsFile() ?? undefined;
    }
    return undefined;
  }

  async function pasteFromClipboard() {
    try {
      if (!navigator.clipboard?.read) throw new Error("clipboard-read-unavailable");
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const mime = item.types.find(type => acceptedMimeTypes.includes(type as typeof acceptedMimeTypes[number]));
        if (!mime) continue;
        const blob = await item.getType(mime);
        chooseFile(new File([blob], `Pasted transaction.${mime.split("/")[1] === "jpeg" ? "jpg" : mime.split("/")[1]}`, { type: mime }));
        return;
      }
      setNotice("The clipboard has no supported image. Copy a transaction screenshot, then try again.");
    } catch {
      pasteTarget.current?.focus();
      setNotice("Clipboard access was unavailable. Click the paste area and press Ctrl+V.");
    }
  }

  async function analyze() {
    if (!file || !previewReadable) { setNotice("The image preview could not be read. Choose another local JPEG, PNG, or WebP image."); return; }
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
      const raw: unknown = await response.json();
      const parsed = screenshotAnalyzeResponseSchema.safeParse(raw);
      if (!parsed.success) throw new Error(response.ok ? "The screenshot workflow returned an unsupported response." : extractError(raw, "The screenshot workflow could not analyze this image."));
      if (current !== sequence.current) return;
      setAnalysis(parsed.data);
      setOriginalExtraction(parsed.data.extraction);
      setExtraction(parsed.data.extraction);
      setCandidates(parsed.data.candidates);
      setMatchesStale(false);
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
    if (analysis?.mode !== "live" && analysis?.mode !== "manual") return;
    const current = ++sequence.current;
    setRematching(true);
    try {
      const response = await fetch("/api/payment-evidence/match", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shop_id: shopId, extraction: nextExtraction, image_sha256: analysis.image_sha256 }),
      });
      const raw: unknown = await response.json();
      const parsed = screenshotMatchResponseSchema.safeParse(raw);
      if (!parsed.success) throw new Error(response.ok ? "The match response was unsupported." : extractError(raw, "The authorized order candidates could not be refreshed."));
      if (current !== sequence.current) return;
      setCandidates(parsed.data.candidates);
      setMatchesStale(false);
      setAnalysis(previous => previous && (previous.mode === "live" || previous.mode === "manual") ? { ...previous, candidates: parsed.data.candidates, duplicate_warnings: parsed.data.duplicate_warnings, evidence_schema_available: parsed.data.evidence_schema_available, verification_available: parsed.data.verification_available, message: parsed.data.message } : previous);
      setNotice(parsed.data.message);
    } catch (error) {
      if (current === sequence.current) setNotice(error instanceof Error ? `${error.message} Your edits remain in place; no save was attempted.` : "Candidates could not be refreshed. Your edits remain in place.");
    } finally {
      if (current === sequence.current) setRematching(false);
    }
  }

  function editExtraction<K extends keyof ScreenshotExtraction>(field: K, value: ScreenshotExtraction[K]) {
    if (busy || saved === "verified") return;
    const next = { ...extraction, [field]: value };
    const fieldNames = ["amount_mmk", "transaction_reference", "provider", "transaction_date", "transaction_time", "payer_name", "payee_name", "payee_account"] as const;
    if ((fieldNames as readonly string[]).includes(field)) {
      next.missing_fields = fieldNames.filter(name => next[name] === null);
    }
    const parsed = screenshotExtractionSchema.safeParse(next);
    if (!parsed.success) { setNotice("That correction is outside the supported screenshot fields."); return; }
    setExtraction(parsed.data);
    setMatchesStale(true);
    setPendingAction(null);
    setTrustedRecordConfirmed(false);
    setVerificationReadback(null);
    setNotice("Details updated. Click Refresh order matches or select a candidate below to attach.");
  }

  function selectCandidate(candidate: ScreenshotCandidate) {
    if (busy || rematching || saved === "verified" || !candidate.eligible) return;
    setSelectedOrderId(candidate.order_id);
    setPendingAction(null);
    setNotice(`Order #${candidate.order_id.slice(0, 8).toUpperCase()} (${candidate.customer_name ?? "Order"}) selected. Click Save review to attach.`);
  }

  async function save(action: Exclude<PendingAction, null>) {
    const hasImage = Boolean(file || evidenceId);
    if (!hasImage || !analysis || !["live", "manual"].includes(analysis.mode) || !analysis.evidence_schema_available || saved === "verified" || busy || rematching) {
      setNotice("A validated image and available private evidence storage are required before saving.");
      return;
    }
    const selected = selectedOrderId ? candidates.find(candidate => candidate.order_id === selectedOrderId) : null;
    if (selectedOrderId && !selected?.eligible) { setNotice("Choose an eligible confirmed order, or clear the match before saving pending evidence."); return; }
    if (pendingAction !== action) {
      setPendingAction(action);
      setNotice(action === "pending_review" ? (selectedOrderId ? "Click again to confirm attaching this order to the evidence review." : "Click Save pending review again to confirm.") : "Click Reject evidence again to confirm.");
      return;
    }
    const current = ++sequence.current;
    setBusy(true);
    setPendingAction(null);
    try {
      const body = new FormData();
      if (file) body.set("file", file);
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
      const rawEvidence = raw && typeof raw === "object" && "evidence" in raw ? raw.evidence : null;
      const readback = analysis.verification_available
        ? localPaymentEvidenceReadbackSchema.safeParse(rawEvidence)
        : paymentEvidenceReadbackSchema.safeParse(rawEvidence);
      if (!readback.success) throw new Error("The save returned no valid readback. Reload evidence before retrying to avoid a duplicate.");
      if (current !== sequence.current) return;
      setRevision(readback.data.revision);
      setSaved(readback.data.status);
      setMatchesStale(false);
      setNotice(readback.data.status === "pending_review" ? (selectedOrderId ? "Evidence saved with order attached. You can now verify the payment." : "Evidence saved as pending review and read back. No payment status was changed.") : "Evidence rejection was saved and read back. No payment status was changed.");
      window.dispatchEvent(new CustomEvent("refresh-orders"));
    } catch (error) {
      if (current === sequence.current) setNotice(error instanceof Error ? error.message : "The evidence save failed. Your stable review ID and edits are preserved for retry.");
    } finally {
      if (current === sequence.current) setBusy(false);
    }
  }

  async function verifyTrustedPayment() {
    if (!analysis?.verification_available || !selectedOrderId || !trustedRecordConfirmed) {
      setNotice("Select an eligible order candidate and confirm that you checked the incoming funds in your bank or merchant account.");
      return;
    }

    const current = ++sequence.current;
    setBusy(true);

    try {
      // Step 1: If evidence review is not yet saved, or details changed, save/sync with server
      let currentRevision = revision;
      if (saved !== "pending_review" || matchesStale || (file && !evidenceId)) {
        setNotice("Saving evidence review and linking to order…");
        const body = new FormData();
        if (file) body.set("file", file);
        body.set("payload", JSON.stringify(buildPaymentEvidenceSavePayload({
          shopId,
          evidenceId,
          orderId: selectedOrderId,
          status: "pending_review",
          expectedRevision: revision,
          originalExtraction,
          sellerReviewed: extraction,
        })));

        const saveRes = await fetch("/api/payment-evidence", { method: "POST", credentials: "same-origin", body });
        const saveRaw = await saveRes.json();
        if (!saveRes.ok) {
          throw new Error(extractError(saveRaw, "Could not save evidence review."));
        }
        const rawEvidence = saveRaw && typeof saveRaw === "object" && "evidence" in saveRaw ? saveRaw.evidence : null;
        const readback = localPaymentEvidenceReadbackSchema.safeParse(rawEvidence);
        if (readback.success) {
          currentRevision = readback.data.revision;
          setRevision(readback.data.revision);
          setSaved(readback.data.status);
          setMatchesStale(false);
        }
      }

      setNotice("Recording the trusted-record verification and updating order payment status…");
      const request = paymentEvidenceVerifyRequestSchema.safeParse({
        shop_id: shopId,
        evidence_id: evidenceId,
        order_id: selectedOrderId,
        amount_mmk: extraction.amount_mmk,
        payment_method: extraction.provider || "KBZPay",
        reference_number: extraction.transaction_reference,
        expected_revision: currentRevision,
        confirm_trusted_record: true,
      });

      if (!request.success) {
        throw new Error("Enter a positive whole MMK amount and payment provider before verifying.");
      }

      const response = await fetch("/api/payment-evidence/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request.data),
      });

      const raw: unknown = await response.json();
      const parsed = paymentEvidenceVerifyReadbackSchema.safeParse(raw && typeof raw === "object" && "readback" in raw ? raw.readback : null);
      if (!response.ok) throw new Error(extractError(raw, "The verified payment could not be recorded."));
      if (!parsed.success) throw new Error("The payment action returned no valid readback. Refresh Payments and the order before retrying.");
      if (current !== sequence.current) return;
      setVerificationReadback(parsed.data);
      setSaved("verified");
      setTrustedRecordConfirmed(false);
      setNotice(parsed.data.idempotent ? "The matching verified payment already exists. No duplicate was recorded." : "✓ Verified! Payment recorded and order payment status updated to paid.");
      window.dispatchEvent(new CustomEvent("refresh-orders"));
      try {
        window.localStorage.setItem("salesayar_orders_updated", Date.now().toString());
      } catch {}
      router.refresh();
    } catch (error) {
      if (current === sequence.current) setNotice(error instanceof Error ? `${error.message} Your saved review remains available for recovery.` : "Payment verification failed. Your saved review remains available for recovery.");
    } finally {
      if (current === sequence.current) setBusy(false);
    }
  }

  const duplicateWarnings = analysis?.duplicate_warnings ?? [];
  const selectedCandidate = selectedOrderId ? candidates.find(candidate => candidate.order_id === selectedOrderId) : null;
  const canSave = (analysis?.mode === "live" || analysis?.mode === "manual") && analysis.evidence_schema_available && saved !== "verified";
  const reviewSignals = [
    ...(receivingAccounts ? [compareReceiptRecipient(extraction, receivingAccounts).message] : ["Shop receiving accounts could not be loaded; recipient comparison is unavailable."]),
    ...(!extraction.amount_mmk ? ["No positive amount is available for matching or payment recording."] : []),
    ...(!extraction.provider ? ["No provider or payment method has been recorded."] : []),
    ...(!extraction.transaction_reference ? ["No transaction reference is available for duplicate review."] : []),
    ...(extraction.missing_fields.length > 0 ? [`Fields still marked missing: ${extraction.missing_fields.join(", ")}.`] : []),
    ...(selectedCandidate && selectedCandidate.amount_relation !== "exact" ? ["The selected order amount differs from or cannot be compared with this review."] : []),
    ...(selectedCandidate?.customer_relation === "mismatch" ? ["The payer name differs from the selected order customer."] : []),
    ...duplicateWarnings.map(warning => warning.message),
  ];
  return <section className="hosted-workflow" aria-labelledby="hosted-match-heading">
    <div className="hosted-workflow-heading"><Icon name="wallet" /><div><span className="eyebrow">Payment evidence review</span><h2 id="hosted-match-heading">Match Payment to Order</h2></div></div>
    <div className="hosted-safety-note"><strong>Advisory only</strong><span>A screenshot cannot confirm received funds. Check your bank or merchant record before you explicitly record a payment.</span></div>
    <div className="hosted-paste-actions"><button className="hosted-secondary-button" type="button" disabled={busy || rematching || saved === "verified"} onClick={() => void pasteFromClipboard()}>Paste copied image</button><span>or select the area below and press Ctrl+V</span></div>
    <div
      ref={pasteTarget}
      tabIndex={0}
      role="group"
      aria-label="Paste or choose a transaction image"
      className={`hosted-dropzone ${isDragging ? "is-dragging" : ""} ${preview ? "has-preview" : ""}`}
      onPaste={(event) => {
        if (busy || rematching || saved === "verified") return;
        const image = pastedImage(event.clipboardData.items);
        if (image) { event.preventDefault(); chooseFile(image); }
        else setNotice("The clipboard has no supported image. Copy a JPEG, PNG, or WebP screenshot.");
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!busy && !rematching && saved !== "verified") setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (busy || rematching || saved === "verified") return;
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) chooseFile(droppedFile);
      }}
    >
      <input
        id="hosted-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={busy || rematching || saved === "verified"}
        onChange={(event) => chooseFile(event.currentTarget.files?.[0])}
      />
      <label htmlFor="hosted-file-input" className="hosted-dropzone-label">
        <Icon name="wallet" />
        <span><strong>Choose local image</strong>, paste, or drag a transaction screenshot here</span>
        <small>Supports JPEG, PNG, or WebP up to 8 MiB</small>
      </label>
    </div>
    {preview && <div className="hosted-screenshot-preview"><Image className="hosted-screenshot" src={preview} alt={`Local preview of ${fileName}`} width={720} height={360} unoptimized onLoad={() => setPreviewReadable(true)} onError={() => { setPreviewReadable(false); setNotice("This image could not be previewed. Choose another local JPEG, PNG, or WebP file."); }} /></div>}
    {file && !previewReadable && <p className="hosted-missing" role="status">Checking the local preview. If it cannot be read, choose another image.</p>}
    {file && <div className="hosted-local-file"><strong>{fileName}</strong><span>{(file.size / (1024 * 1024)).toFixed(2)} MiB · remains local until you analyze or save it</span></div>}
    <button className="hosted-primary-button" type="button" disabled={!file || !previewReadable || busy || rematching || saved === "verified"} onClick={() => void analyze()}>{busy ? "Working…" : "Analyze screenshot"}</button>
    {busy && <div className="hosted-status-card" role="status">The image is being checked and the review draft is being prepared…</div>}
    {analysis && <section className="hosted-match-card hosted-evidence-card" aria-labelledby="evidence-details-heading">
      <div className="hosted-preview-heading"><div><span className="eyebrow">Seller review draft</span><h3 id="evidence-details-heading">Transaction details</h3></div><span className={`hosted-mode hosted-mode-${analysis.mode === "live" ? "live" : analysis.mode === "manual" ? "simulation" : "simulation"}`}>{analysis.mode === "live" ? "AI draft" : analysis.mode === "manual" ? "Manual review" : "Unavailable"}</span></div>
      {analysis.mode === "manual" && <div className="hosted-missing" role="status"><strong>Manual review</strong><span>{analysis.message}</span></div>}
      {analysis.mode !== "manual" && <p className="hosted-note">{analysis.mode === "live" ? "Correct every readable field. A correction clears the selected order and refreshes candidates." : analysis.mode === "error" ? analysis.error : analysis.message}</p>}
      {analysis.mode !== "error" && <div className="hosted-fields hosted-evidence-fields">
        <label>Amount (MMK)<input aria-label="Amount in whole MMK" disabled={busy || rematching || Boolean(saved)} type="number" min="0" step="1" value={extraction.amount_mmk ?? ""} onChange={event => editExtraction("amount_mmk", event.target.value.trim() ? Number(event.target.value) : null)} /></label>
        <label>Provider<input aria-label="Payment provider" disabled={busy || rematching || Boolean(saved)} value={extraction.provider ?? ""} onChange={event => editExtraction("provider", asNullable(event.target.value))} /></label>
        <label>Transaction reference<input disabled={busy || rematching || Boolean(saved)} value={extraction.transaction_reference ?? ""} onChange={event => editExtraction("transaction_reference", asNullable(event.target.value))} /></label>
        <label>Payer name<input disabled={busy || rematching || Boolean(saved)} value={extraction.payer_name ?? ""} onChange={event => editExtraction("payer_name", asNullable(event.target.value))} /></label>
        <label>Payee name<input disabled={busy || rematching || Boolean(saved)} value={extraction.payee_name ?? ""} onChange={event => editExtraction("payee_name", asNullable(event.target.value))} /></label>
        <label>Recipient account or phone<input disabled={busy || rematching || Boolean(saved)} value={extraction.payee_account ?? ""} onChange={event => editExtraction("payee_account", asNullable(event.target.value))} /></label>
        <label>Date<input disabled={busy || rematching || Boolean(saved)} type="date" value={extraction.transaction_date ?? ""} onChange={event => editExtraction("transaction_date", asNullable(event.target.value))} /></label>
        <label>Time<input disabled={busy || rematching || Boolean(saved)} type="time" value={extraction.transaction_time ?? ""} onChange={event => editExtraction("transaction_time", asNullable(event.target.value))} /></label>
        <label className="hosted-checkbox-field"><input disabled={busy || rematching || Boolean(saved)} type="checkbox" checked={extraction.transaction_time_uncertain} onChange={event => editExtraction("transaction_time_uncertain", event.target.checked)} /> Time needs review</label>
        <label className="hosted-wide">Missing fields <input disabled={busy || rematching || Boolean(saved)} value={extraction.missing_fields.join(", ")} onChange={event => editExtraction("missing_fields", asList(event.target.value))} /></label>
        <label className="hosted-wide">Uncertain fields <input disabled={busy || rematching || Boolean(saved)} value={extraction.uncertain_fields.join(", ")} onChange={event => editExtraction("uncertain_fields", asList(event.target.value))} /></label>
      </div>}
      {matchesStale && <button type="button" className="hosted-secondary-button" disabled={busy || rematching} onClick={() => void rematch(extraction)}>{rematching ? "Refreshing matches…" : "Refresh order matches"}</button>}
      {rematching && <div className="hosted-status-card" role="status">Refreshing candidates for the corrected details…</div>}
      {analysis.mode !== "error" && reviewSignals.length > 0 && <div className="hosted-missing" role="status"><strong>Review signals · advisory only</strong><span>{reviewSignals.join(" ")} These signals are not a fraud verdict.</span></div>}
      {duplicateWarnings.length > 0 && <div className="hosted-missing" role="status"><strong>Same-shop duplicate warning</strong><span>{duplicateWarnings.map(warning => warning.message).join(" ")} This is a warning, not a payment confirmation.</span></div>}
      {(analysis.mode === "live" || analysis.mode === "manual") && !analysis.evidence_schema_available && <div className="hosted-missing" role="status"><strong>Evidence storage is unavailable</strong><span>This workspace could not confirm private evidence storage, so nothing was saved. Check the database and private storage configuration before retrying.</span></div>}
      {candidates.length > 0 && analysis.mode !== "error" ? <div className="hosted-candidate-list" aria-label="Authorized order candidates">{candidates.map(candidate => <button key={candidate.order_id} className={`hosted-candidate ${selectedOrderId === candidate.order_id ? "hosted-candidate-selected" : ""}`} type="button" disabled={!candidate.eligible || busy || rematching || saved === "verified"} onClick={() => selectCandidate(candidate)}><span className="hosted-candidate-top"><strong>{candidate.customer_name ?? "Unnamed customer"}</strong><span className={`hosted-mode hosted-mode-${candidate.match_state === "exact" ? "live" : "simulation"}`}>{candidate.match_state}</span></span><span>{mmk(candidate.total_mmk)} · {candidate.amount_relation} amount · {candidate.customer_relation} customer</span><span>{candidate.order_status} · {candidate.payment_status} · {candidate.fulfillment_status}</span><small>{candidate.reasons.join(" ")}</small>{candidate.duplicate_warning && <small className="hosted-danger">Duplicate evidence warning: {candidate.duplicate_warning.replace("_", " ")}</small>}</button>)}</div> : (analysis.mode === "live" || analysis.mode === "manual") && !rematching && <div className="hosted-review-status"><strong>No candidate is ready to select</strong><span>{extraction.amount_mmk === null ? "A readable amount is needed for a useful match; you may still save unmatched evidence for review." : "No same-shop order met the bounded matching conditions."}</span></div>}
      <div className="hosted-review-status"><strong>{saved === "verified" ? "Verified payment recorded" : saved === "pending_review" ? "Pending review saved" : saved === "rejected" ? "Evidence rejected" : "Seller decision required"}</strong><span>{saved === "verified" && verificationReadback ? `Payment ${verificationReadback.payment.id.slice(0, 8).toUpperCase()} read back. Order payment status is ${verificationReadback.order.payment_status}; order and fulfillment statuses remain ${verificationReadback.order.order_status} and ${verificationReadback.order.fulfillment_status}.` : saved ? (selectedOrderId ? `Evidence readback succeeded with Order #${selectedOrderId.slice(0, 8).toUpperCase()} attached. Verify funds against your bank or merchant account below.` : "Evidence readback succeeded without an attached order. Select an order above to attach it before verifying.") : "Choose an eligible candidate if one is appropriate, then save pending evidence or explicitly reject it."}</span></div>
      {canSave && <div className="hosted-evidence-actions"><button className="hosted-primary-button" type="button" disabled={busy || rematching} onClick={() => void save("pending_review")}>{pendingAction === "pending_review" ? "Click again to confirm pending review" : selectedOrderId ? "Attach to order & save review" : "Save pending review"}</button><button className="hosted-secondary-button hosted-danger-button" type="button" disabled={busy || rematching} onClick={() => void save("rejected")}>{pendingAction === "rejected" ? "Click again to confirm rejection" : "Reject evidence"}</button></div>}
      {saved === "pending_review" && <div className="hosted-review-status"><button className="hosted-text-button" type="button" disabled={busy} onClick={() => { setSaved(null); setTrustedRecordConfirmed(false); setVerificationReadback(null); setNotice("Review details reopened. You can enter or correct the payer name, select an order candidate, and save."); }}>Edit review details</button></div>}
      {saved !== "verified" && analysis.verification_available && selectedOrderId && (
        <div className="hosted-evidence-actions" style={{ background: "var(--surface-muted, #f8fafc)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--border-subtle, #e2e8f0)", marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <label className="hosted-checkbox-field" style={{ fontWeight: 600, display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer" }}>
            <input type="checkbox" checked={trustedRecordConfirmed} disabled={busy} onChange={event => setTrustedRecordConfirmed(event.target.checked)} style={{ marginTop: "0.2rem" }} />
            <span>I checked incoming funds in my bank/merchant account. (ဘဏ်/ပိုက်ဆံအိတ်ထဲ ငွေဝင်ပြီးဖြစ်ကြောင်း စစ်ဆေးအတည်ပြုပါသည်)</span>
          </label>
          <button
            className="hosted-primary-button"
            type="button"
            style={{ width: "100%", padding: "0.75rem 1rem", fontSize: "0.95rem", fontWeight: 700 }}
            disabled={busy || !trustedRecordConfirmed}
            onClick={() => void verifyTrustedPayment()}
          >
            {busy ? "Verifying & Recording Payment…" : "✓ Verify & Record Payment (ငွေပေးချေမှု အတည်ပြုမှတ်တမ်းတင်မည်)"}
          </button>
        </div>
      )}
      {saved === "pending_review" && analysis.verification_available && !selectedOrderId && <div className="hosted-missing" role="status"><strong>No order attached yet</strong><span>To verify this payment, click &quot;Edit review details&quot; above, enter the payer name if needed, select an eligible order candidate, and save the review.</span></div>}
      {saved === "pending_review" && !analysis.verification_available && <div className="hosted-missing" role="status"><strong>Hosted verification is not available</strong><span>This workspace can save private evidence, but recording a payment requires a reviewed shop-scoped database transaction. No payment or order status was changed.</span></div>}
      {saved === "verified" && verificationReadback && <div className="hosted-success" role="status"><strong>Payment readback confirmed</strong><span>{mmk(verificationReadback.payment.amount_mmk)} via {verificationReadback.payment.payment_method} · {verificationReadback.order.payment_status}</span></div>}
    </section>}
    {notice && <p className="hosted-notice" role="status">{notice}</p>}
  </section>;
}
