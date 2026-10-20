import { z } from "zod";

const nullableText = (max: number) => z.string().trim().max(max).nullable();

export const screenshotMimeSchema = z.enum(["image/jpeg", "image/png", "image/webp"]);
export type ScreenshotMime = z.infer<typeof screenshotMimeSchema>;

export const screenshotExtractionSchema = z.object({
  amount_mmk: z.number().int().safe().nonnegative().nullable(),
  transaction_reference: nullableText(160),
  provider: nullableText(80),
  transaction_date: z.iso.date().nullable(),
  transaction_time: z.string().trim().regex(/^\d{2}:\d{2}(?::\d{2})?$/).nullable(),
  transaction_time_uncertain: z.boolean(),
  payer_name: nullableText(160),
  payee_name: nullableText(160),
  missing_fields: z.array(z.string().trim().min(1).max(80)).max(24),
  uncertain_fields: z.array(z.string().trim().min(1).max(80)).max(24),
}).strict();
export type ScreenshotExtraction = z.infer<typeof screenshotExtractionSchema>;

export const screenshotOrderStatusSchema = z.enum(["draft", "confirmed", "cancelled"]);
export const screenshotPaymentStatusSchema = z.enum(["unpaid", "partially_paid", "paid", "refunded"]);
export const screenshotFulfillmentStatusSchema = z.enum(["unfulfilled", "processing", "shipped", "delivered", "cancelled"]);

export const screenshotCandidateSchema = z.object({
  order_id: z.uuid(),
  customer_name: z.string().trim().max(160).nullable(),
  customer_phone: z.string().trim().max(40).nullable(),
  total_mmk: z.number().int().safe().nonnegative(),
  order_status: screenshotOrderStatusSchema,
  payment_status: screenshotPaymentStatusSchema,
  fulfillment_status: screenshotFulfillmentStatusSchema,
  eligible: z.boolean(),
  match_state: z.enum(["exact", "possible", "uncertain", "ineligible"]),
  amount_relation: z.enum(["exact", "close", "less", "greater", "missing"]),
  customer_relation: z.enum(["match", "mismatch", "unavailable"]),
  reference_relation: z.literal("unavailable"),
  reasons: z.array(z.string().trim().min(1).max(180)).max(8),
  duplicate_warning: z.enum(["pending_evidence", "rejected_evidence"]).nullable(),
}).strict();
export type ScreenshotCandidate = z.infer<typeof screenshotCandidateSchema>;

export const duplicateEvidenceWarningSchema = z.object({
  type: z.enum(["reference_provider", "image_hash"]),
  status: z.enum(["pending_review", "rejected"]),
  message: z.string().trim().min(1).max(180),
}).strict();
export type DuplicateEvidenceWarning = z.infer<typeof duplicateEvidenceWarningSchema>;

const screenshotResultFields = {
  extraction: screenshotExtractionSchema,
  candidates: z.array(screenshotCandidateSchema).max(20),
  duplicate_warnings: z.array(duplicateEvidenceWarningSchema).max(20),
  image_sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  evidence_schema_available: z.boolean(),
};

export const screenshotAnalyzeResponseSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("live"),
    ...screenshotResultFields,
    message: z.string().trim().min(1).max(240),
  }).strict(),
  z.object({
    mode: z.literal("simulation"),
    ...screenshotResultFields,
    message: z.string().trim().min(1).max(240),
  }).strict(),
  z.object({
    mode: z.literal("error"),
    ...screenshotResultFields,
    error: z.string().trim().min(1).max(240),
  }).strict(),
]);
export type ScreenshotAnalyzeResponse = z.infer<typeof screenshotAnalyzeResponseSchema>;

export const screenshotAnalyzeRequestSchema = z.object({
  shop_id: z.uuid(),
  evidence_id: z.uuid().optional(),
}).strict();

export const screenshotMatchRequestSchema = z.object({
  shop_id: z.uuid(),
  extraction: screenshotExtractionSchema,
  image_sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional(),
}).strict();

export const screenshotMatchResponseSchema = z.object({
  mode: z.literal("live-match"),
  candidates: z.array(screenshotCandidateSchema).max(20),
  duplicate_warnings: z.array(duplicateEvidenceWarningSchema).max(20),
  image_sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  evidence_schema_available: z.boolean(),
  message: z.string().trim().min(1).max(240),
}).strict();

export const paymentEvidenceSaveSchema = z.object({
  shop_id: z.uuid(),
  evidence_id: z.uuid(),
  order_id: z.uuid().nullable(),
  status: z.enum(["pending_review", "rejected"]),
  expected_revision: z.number().int().nonnegative().max(1000000),
  extraction: screenshotExtractionSchema,
  seller_reviewed: screenshotExtractionSchema,
}).strict();
export type PaymentEvidenceSave = z.infer<typeof paymentEvidenceSaveSchema>;

export function buildPaymentEvidenceSavePayload(input: {
  shopId: string;
  evidenceId: string;
  orderId: string | null;
  status: PaymentEvidenceSave["status"];
  expectedRevision: number;
  originalExtraction: ScreenshotExtraction;
  sellerReviewed: ScreenshotExtraction;
}): PaymentEvidenceSave {
  return paymentEvidenceSaveSchema.parse({
    shop_id: input.shopId,
    evidence_id: input.evidenceId,
    order_id: input.orderId,
    status: input.status,
    expected_revision: input.expectedRevision,
    extraction: input.originalExtraction,
    seller_reviewed: input.sellerReviewed,
  });
}

export const paymentEvidenceReadbackSchema = z.object({
  id: z.uuid(),
  shop_id: z.uuid(),
  order_id: z.uuid().nullable(),
  storage_object_path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[a-f0-9]{64}\.(jpg|png|webp)$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  extracted: screenshotExtractionSchema,
  seller_reviewed: screenshotExtractionSchema,
  status: z.enum(["pending_review", "rejected"]),
  created_by: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
  revision: z.number().int().nonnegative(),
}).strict();
export type PaymentEvidenceReadback = z.infer<typeof paymentEvidenceReadbackSchema>;
