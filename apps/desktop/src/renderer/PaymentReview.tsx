import { useEffect, useRef, useState } from "react";
import {
  buildPaymentEvidenceSavePayload,
  screenshotExtractionSchema,
  type ScreenshotAnalyzeResponse,
  type ScreenshotCandidate,
  type ScreenshotExtraction,
  type DuplicateEvidenceWarning,
} from "@ocean/contracts";
import { compareReceiptRecipient } from "@ocean/core";

type ReceivingAccount = { provider: string; account_name: string; last_four: string };

type PaymentResult = Extract<ScreenshotAnalyzeResponse, { mode: "live" | "manual" | "simulation" }>;

export function PaymentReview({ image, onNotice }: { image: string; onNotice: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [shopId, setShopId] = useState("");
  const [shopName, setShopName] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  const [original, setOriginal] = useState<ScreenshotExtraction | null>(null);
  const [draft, setDraft] = useState<ScreenshotExtraction | null>(null);
  const [candidates, setCandidates] = useState<ScreenshotCandidate[]>([]);
  const [warnings, setWarnings] = useState<DuplicateEvidenceWarning[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [matchesStale, setMatchesStale] = useState(false);
  const [saved, setSaved] = useState(false);
  const [receivingAccounts, setReceivingAccounts] = useState<ReceivingAccount[] | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    return () => { requestId.current += 1; };
  }, []);

  async function analyze() {
    if (!image || busy) return;
    const currentRequest = ++requestId.current;
    setBusy(true);
    setSaved(false);
    onNotice("Reading the transaction image…");
    try {
      const response = await window.assistant.analyzePayment(image);
      if (currentRequest !== requestId.current) return;
      if (response.analysis.mode === "error") throw new Error(response.analysis.error);
      setResult(response.analysis);
      setShopId(response.shop_id);
      setShopName(response.shop_name);
      setEvidenceId(response.evidence_id);
      setOriginal(response.analysis.extraction);
      setDraft(response.analysis.extraction);
      setCandidates(response.analysis.candidates);
      setWarnings(response.analysis.duplicate_warnings);
      setSelectedOrderId(null);
      setMatchesStale(false);
      onNotice(response.analysis.message);
      void window.assistant.receivingAccounts(response.shop_id).then(accounts => {
        if (currentRequest === requestId.current) setReceivingAccounts(accounts);
      }).catch(() => {
        if (currentRequest === requestId.current) setReceivingAccounts(null);
      });
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      setResult(null);
      onNotice(error instanceof Error ? error.message : "The image could not be analyzed. Try again.");
    } finally {
      if (currentRequest === requestId.current) setBusy(false);
    }
  }

  function edit<K extends keyof ScreenshotExtraction>(field: K, value: ScreenshotExtraction[K]) {
    setDraft(current => {
      if (!current) return current;
      const next = { ...current, [field]: value };
      const fields = ["amount_mmk", "transaction_reference", "provider", "transaction_date", "transaction_time", "payer_name", "payee_name", "payee_account"] as const;
      if ((fields as readonly string[]).includes(field)) {
        next.missing_fields = fields.filter(name => next[name] === null);
        next.uncertain_fields = next.uncertain_fields.filter(name => name !== field);
      }
      return next;
    });
    setMatchesStale(true);
    setSelectedOrderId(null);
    setSaved(false);
  }

  async function rematch() {
    if (!draft || !result || !shopId || busy) return;
    const valid = screenshotExtractionSchema.safeParse(draft);
    if (!valid.success) { onNotice("Check the edited amount, date, time, and text fields before matching."); return; }
    setBusy(true);
    const currentRequest = ++requestId.current;
    try {
      const matched = await window.assistant.rematchPayment({ shop_id: shopId, extraction: valid.data, image_sha256: result.image_sha256 });
      if (currentRequest !== requestId.current) return;
      setCandidates(matched.candidates);
      setWarnings(matched.duplicate_warnings);
      setMatchesStale(false);
      onNotice(matched.message);
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      onNotice(error instanceof Error ? error.message : "The order candidates could not be refreshed.");
    } finally {
      if (currentRequest === requestId.current) setBusy(false);
    }
  }

  async function savePending() {
    if (!draft || !original || !result || !shopId || !evidenceId || busy || matchesStale || saved) return;
    const valid = screenshotExtractionSchema.safeParse(draft);
    if (!valid.success) { onNotice("Check the edited fields before saving the review."); return; }
    if (!result.evidence_schema_available) { onNotice("Private evidence storage is unavailable for this shop."); return; }
    setBusy(true);
    const currentRequest = ++requestId.current;
    try {
      const payload = buildPaymentEvidenceSavePayload({
        shopId, evidenceId, orderId: selectedOrderId, status: "pending_review", expectedRevision: 0,
        originalExtraction: original, sellerReviewed: valid.data,
      });
      const savedEvidence = await window.assistant.savePaymentEvidence({ image, payload });
      if (currentRequest !== requestId.current) return;
      setSaved(true);
      onNotice(savedEvidence.message);
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      onNotice(error instanceof Error ? error.message : "The pending payment review could not be saved.");
    } finally {
      if (currentRequest === requestId.current) setBusy(false);
    }
  }

  const selected = candidates.find(candidate => candidate.order_id === selectedOrderId);
  const recipientSignal = draft && receivingAccounts ? compareReceiptRecipient(draft, receivingAccounts) : null;
  return <div className="payment-review">
    <button type="button" className="primary-button analyze-button" disabled={!image || busy} onClick={() => void analyze()}>{busy && !result ? "Reading image…" : result ? "Analyze again" : "Analyze screenshot"}</button>
    {result && <section className="order-preview" aria-labelledby="payment-draft-heading">
      <div className="preview-header"><div><span className="eyebrow">{shopName} · seller review</span><h2 id="payment-draft-heading">Transaction details</h2></div></div>
      <div className={result.mode === "live" ? "payment-result-note" : "missing-card"} role="status"><strong>{result.mode === "live" ? "Image read" : "Manual review"}</strong><span>{result.message}</span></div>
      {draft && <div className="payment-field-grid">
        <label className="form-field"><span>Amount (MMK)</span><input type="number" min="0" step="1" value={draft.amount_mmk ?? ""} disabled={saved} onChange={event => edit("amount_mmk", event.target.value ? Number(event.target.value) : null)} /></label>
        <label className="form-field"><span>Payment provider</span><input value={draft.provider ?? ""} disabled={saved} onChange={event => edit("provider", event.target.value || null)} /></label>
        <label className="form-field"><span>Transaction reference</span><input value={draft.transaction_reference ?? ""} disabled={saved} onChange={event => edit("transaction_reference", event.target.value || null)} /></label>
        <label className="form-field"><span>Sender name</span><input value={draft.payer_name ?? ""} disabled={saved} onChange={event => edit("payer_name", event.target.value || null)} /></label>
        <label className="form-field"><span>Recipient name</span><input value={draft.payee_name ?? ""} disabled={saved} onChange={event => edit("payee_name", event.target.value || null)} /></label>
        <label className="form-field"><span>Recipient account or phone</span><input value={draft.payee_account ?? ""} disabled={saved} onChange={event => edit("payee_account", event.target.value || null)} /></label>
        <label className="form-field"><span>Transaction date</span><input type="date" value={draft.transaction_date ?? ""} disabled={saved} onChange={event => edit("transaction_date", event.target.value || null)} /></label>
        <label className="form-field"><span>Transaction time</span><input type="time" value={draft.transaction_time ?? ""} disabled={saved} onChange={event => edit("transaction_time", event.target.value || null)} /></label>
        <label className="payment-checkbox"><input type="checkbox" checked={draft.transaction_time_uncertain} disabled={saved} onChange={event => edit("transaction_time_uncertain", event.target.checked)} /> Time needs review</label>
      </div>}
      {draft && <div className="missing-card" role="status"><strong>Recipient check · advisory</strong><span>{recipientSignal?.message ?? "Receiving accounts could not be loaded. Compare the receipt with your trusted payment record."}</span></div>}
      {draft && !saved && <button type="button" className="secondary-button payment-wide-button" disabled={busy || !matchesStale} onClick={() => void rematch()}>{busy && matchesStale ? "Matching…" : "Refresh order matches"}</button>}
      {warnings.map((warning, index) => <div className="missing-card" role="status" key={`${warning.type}-${index}`}><strong>Possible duplicate</strong><span>{warning.message}</span></div>)}
      <div className="items-heading"><strong>Orders to review</strong><small>{candidates.length} candidate{candidates.length === 1 ? "" : "s"}</small></div>
      {matchesStale && <p className="field-hint">Refresh order matches after editing details.</p>}
      {!matchesStale && candidates.length === 0 && <p className="field-hint">No order matches yet. Check the details or save the evidence without an order.</p>}
      {!matchesStale && candidates.map(candidate => <label className="payment-candidate" key={candidate.order_id}>
        <input type="radio" name="payment-order" disabled={!candidate.eligible || saved} checked={selectedOrderId === candidate.order_id} onChange={() => setSelectedOrderId(candidate.order_id)} />
        <span><strong>{candidate.customer_name || candidate.customer_phone || "Order"} · {candidate.total_mmk.toLocaleString("en-US")} MMK</strong><small>{candidate.match_state} match · {candidate.reasons.join(" ")}</small></span>
      </label>)}
      <p className="field-hint">A screenshot cannot confirm that money reached your account. Check the trusted payment record before marking an order paid.</p>
      {saved ? (
        <button type="button" className="secondary-button payment-wide-button" onClick={() => setSaved(false)}>Edit review details</button>
      ) : (
        <button type="button" className="primary-button payment-wide-button" disabled={busy || matchesStale || !result.evidence_schema_available} onClick={() => void savePending()}>{busy ? "Saving…" : selectedOrderId ? "Attach to order & save review" : "Save pending payment review"}</button>
      )}
    </section>}
  </div>;
}
