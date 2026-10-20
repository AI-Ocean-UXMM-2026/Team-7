export type ScreenshotEvidenceForMatch = {
  amount_mmk: number | null;
  transaction_reference: string | null;
  provider: string | null;
  payer_name: string | null;
};

export type MatchableOrder = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_mmk: number;
  order_status: "draft" | "confirmed" | "cancelled";
  payment_status: "unpaid" | "partially_paid" | "paid" | "refunded";
  fulfillment_status: "unfulfilled" | "processing" | "shipped" | "delivered" | "cancelled";
};

export type ExistingPaymentEvidence = {
  sha256: string | null;
  status: "pending_review" | "rejected";
  seller_reviewed: {
    transaction_reference?: string | null;
    provider?: string | null;
  } | null;
};

export type ScreenshotCandidate = {
  order_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_mmk: number;
  order_status: MatchableOrder["order_status"];
  payment_status: MatchableOrder["payment_status"];
  fulfillment_status: MatchableOrder["fulfillment_status"];
  eligible: boolean;
  match_state: "exact" | "possible" | "uncertain" | "ineligible";
  amount_relation: "exact" | "close" | "less" | "greater" | "missing";
  customer_relation: "match" | "mismatch" | "unavailable";
  reference_relation: "unavailable";
  reasons: string[];
  duplicate_warning: "pending_evidence" | "rejected_evidence" | null;
};

export type DuplicateWarning = {
  type: "reference_provider" | "image_hash";
  status: "pending_review" | "rejected";
  message: string;
};

const CLOSE_AMOUNT_MMK = 1000;
const MAX_MATCH_CANDIDATES = 20;

function normalize(value: string | null | undefined) {
  return value?.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase() || null;
}

function amountRelation(amount: number | null, total: number) {
  if (amount === null) return "missing" as const;
  if (amount === total) return "exact" as const;
  if (Math.abs(amount - total) <= CLOSE_AMOUNT_MMK) return "close" as const;
  return amount < total ? "less" as const : "greater" as const;
}

function duplicateStatus(existing: ExistingPaymentEvidence[], evidence: ScreenshotEvidenceForMatch, imageSha256: string | null) {
  const reference = normalize(evidence.transaction_reference);
  const provider = normalize(evidence.provider);
  const duplicate = existing.find(row => {
    const reviewedReference = normalize(row.seller_reviewed?.transaction_reference);
    const reviewedProvider = normalize(row.seller_reviewed?.provider);
    const sameReferenceAndProvider = Boolean(reference && provider && reference === reviewedReference && provider === reviewedProvider);
    const sameImage = Boolean(imageSha256 && row.sha256 && imageSha256 === row.sha256);
    return sameReferenceAndProvider || sameImage;
  });
  return duplicate?.status === "pending_review" ? "pending_evidence" as const : duplicate ? "rejected_evidence" as const : null;
}

export function duplicateWarnings(
  existing: ExistingPaymentEvidence[],
  evidence: ScreenshotEvidenceForMatch,
  imageSha256: string | null,
): DuplicateWarning[] {
  const reference = normalize(evidence.transaction_reference);
  const provider = normalize(evidence.provider);
  const warnings: DuplicateWarning[] = [];
  const matchesReference = existing.some(row => {
    const reviewedReference = normalize(row.seller_reviewed?.transaction_reference);
    const reviewedProvider = normalize(row.seller_reviewed?.provider);
    return Boolean(reference && provider && reference === reviewedReference && provider === reviewedProvider);
  });
  if (matchesReference) {
    const status = existing.find(row => {
      const reviewedReference = normalize(row.seller_reviewed?.transaction_reference);
      const reviewedProvider = normalize(row.seller_reviewed?.provider);
      return Boolean(reference && provider && reference === reviewedReference && provider === reviewedProvider);
    })?.status ?? "pending_review";
    warnings.push({
      type: "reference_provider",
      status,
      message: status === "pending_review"
        ? "A same-shop evidence item with this provider and reference is already pending review."
        : "A same-shop evidence item with this provider and reference was previously rejected.",
    });
  }
  if (imageSha256 && existing.some(row => row.sha256 === imageSha256)) {
    const status = existing.find(row => row.sha256 === imageSha256)?.status ?? "pending_review";
    warnings.push({
      type: "image_hash",
      status,
      message: status === "pending_review"
        ? "This image matches same-shop evidence that is already pending review."
        : "This image matches same-shop evidence that was previously rejected.",
    });
  }
  return warnings;
}

export function matchScreenshotOrders(
  orders: MatchableOrder[],
  evidence: ScreenshotEvidenceForMatch,
  existing: ExistingPaymentEvidence[] = [],
  imageSha256: string | null = null,
): { candidates: ScreenshotCandidate[]; duplicate_warnings: DuplicateWarning[] } {
  const warnings = duplicateWarnings(existing, evidence, imageSha256);
  const candidates = orders.map((order): ScreenshotCandidate => {
    const relation = amountRelation(evidence.amount_mmk, order.total_mmk);
    const payer = normalize(evidence.payer_name);
    const customer = normalize(order.customer_name);
    const customerRelation = !payer || !customer ? "unavailable" as const : payer === customer ? "match" as const : "mismatch" as const;
    const eligible = order.order_status === "confirmed" && ["unpaid", "partially_paid"].includes(order.payment_status);
    const reasons: string[] = [];
    if (relation === "exact") reasons.push("The extracted amount exactly matches the order total.");
    else if (relation === "close") reasons.push("The extracted amount is close to the order total and needs seller review.");
    else if (relation === "missing") reasons.push("No readable amount was extracted, so there is no amount match.");
    else reasons.push(`The extracted amount is ${relation} than the order total.`);
    if (customerRelation === "match") reasons.push("The payer name matches the order customer name.");
    else if (customerRelation === "mismatch") reasons.push("The payer name does not match the order customer name.");
    else reasons.push("Customer comparison is unavailable because one name is missing.");
    reasons.push("Transaction-reference matching is unavailable because orders do not store transaction references.");
    if (!eligible) reasons.push("This order is not eligible for a pending evidence review because its order or payment status is already closed.");
    const duplicate = duplicateStatus(existing, evidence, imageSha256);
    if (duplicate) reasons.push(duplicate === "pending_evidence" ? "A same-shop evidence duplicate is pending review." : "A same-shop evidence duplicate was rejected previously.");
    let matchState: ScreenshotCandidate["match_state"];
    if (!eligible) matchState = "ineligible";
    else if (relation === "exact" && customerRelation !== "mismatch") matchState = "exact";
    else if (relation === "close" && customerRelation === "match") matchState = "possible";
    else matchState = "uncertain";
    return {
      order_id: order.id,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      total_mmk: order.total_mmk,
      order_status: order.order_status,
      payment_status: order.payment_status,
      fulfillment_status: order.fulfillment_status,
      eligible,
      match_state: matchState,
      amount_relation: relation,
      customer_relation: customerRelation,
      reference_relation: "unavailable",
      reasons,
      duplicate_warning: duplicate,
    };
  });
  candidates.sort((left, right) => {
    const stateRank = { exact: 0, possible: 1, uncertain: 2, ineligible: 3 };
    const amountRank = { exact: 0, close: 1, missing: 2, less: 3, greater: 4 };
    return stateRank[left.match_state] - stateRank[right.match_state]
      || amountRank[left.amount_relation] - amountRank[right.amount_relation]
      || left.order_id.localeCompare(right.order_id);
  });
  return { candidates: candidates.slice(0, MAX_MATCH_CANDIDATES), duplicate_warnings: warnings };
}
