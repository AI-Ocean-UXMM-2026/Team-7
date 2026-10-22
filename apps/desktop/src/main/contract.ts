import { z } from "zod";
import type { PaymentEvidenceSave, ScreenshotAnalyzeResponse, ScreenshotExtraction, ScreenshotCandidate, DuplicateEvidenceWarning } from "@ocean/contracts";
import { ipcChannels } from "./channels.js";
export { ipcChannels };
export { paymentReviewImageSchema } from "./payment-review-image.js";

export const commandSchema = z
  .object({
    channel: z.literal(ipcChannels.command),
    action: z.enum(["toggle", "hide", "openWebsite"]),
  })
  .strict();

export const launcherDragSchema = z
  .object({
    phase: z.enum(["start", "move", "end"]),
    pointerId: z.number().int().min(0).max(2_147_483_647),
    screenX: z.number().finite().min(-32_768).max(32_768),
    screenY: z.number().finite().min(-32_768).max(32_768),
  })
  .strict();

const fieldSourceSchema = z.enum(["extracted", "missing", "manual"]);
const draftItemSchema = z.object({
  key: z.string().min(1).max(100),
  product_name: z.string().max(200),
  product_name_source: fieldSourceSchema,
  quantity: z.string().max(50),
  quantity_source: fieldSourceSchema,
  unit_price_mmk: z.string().max(50),
  unit_price_mmk_source: fieldSourceSchema,
}).strict();

const draftOrderSchema = z.object({
  customer_name: z.string().max(160),
  customer_name_source: fieldSourceSchema,
  customer_phone: z.string().max(40),
  customer_phone_source: fieldSourceSchema,
  delivery_address: z.string().max(500),
  delivery_address_source: fieldSourceSchema,
  notes: z.string().max(4_000),
  notes_source: fieldSourceSchema,
  delivery_fee_mmk: z.string().max(50),
  delivery_fee_mmk_source: fieldSourceSchema,
  discount_mmk: z.string().max(50),
  discount_mmk_source: fieldSourceSchema,
  items: z.array(draftItemSchema).min(1).max(100),
}).strict();

export const assistantDraftFieldsSchema = z
  .object({
    view: z.enum(["home", "chat", "match"]),
    chat: z.string().max(200_000),
    order: draftOrderSchema,
    hasOrder: z.boolean(),
    confirmed: z.boolean(),
    orderId: z.uuid().nullable(),
    notice: z.string().max(2_000),
    extractionMode: z.enum(["live", "simulation"]),
  })
  .strict();

const screenshotDraftSchema = z
  .object({
    source: z.string().max(12_000_000),
    name: z.string().max(255),
  })
  .strict();

export const saveDraftFieldsSchema = z
  .object({
    channel: z.literal(ipcChannels.saveDraftFields),
    fields: assistantDraftFieldsSchema,
  })
  .strict();

export const saveDraftScreenshotSchema = z
  .object({
    channel: z.literal(ipcChannels.saveDraftScreenshot),
    screenshot: screenshotDraftSchema.nullable(),
  })
  .strict();

export const writeClipboardTextSchema = z.string().max(20_000);

export type AssistantDraftFields = z.infer<typeof assistantDraftFieldsSchema>;
export type AssistantDraftScreenshot = z.infer<typeof screenshotDraftSchema>;
export type AssistantDraft = {
  fields: AssistantDraftFields;
  screenshot: AssistantDraftScreenshot | null;
};

export type AssistantBridge = {
  toggleAssistant: () => Promise<void>;
  hideAssistant: () => Promise<void>;
  openWebsite: () => Promise<void>;
  analyzePayment: (image: string) => Promise<{ shop_id: string; shop_name: string; evidence_id: string; analysis: ScreenshotAnalyzeResponse }>;
  rematchPayment: (input: { shop_id: string; extraction: ScreenshotExtraction; image_sha256: string | null }) => Promise<{ candidates: ScreenshotCandidate[]; duplicate_warnings: DuplicateEvidenceWarning[]; message: string }>;
  savePaymentEvidence: (input: { image: string; payload: PaymentEvidenceSave }) => Promise<{ evidence_id: string; revision: number; status: string; message: string }>;
  receivingAccounts: (shopId: string) => Promise<Array<{ id: string; provider: string; account_name: string; last_four: string }>>;
  saveOrder: (order: {
    id: string;
    customer_name: string;
    customer_phone?: string | null;
    delivery_address?: string | null;
    notes?: string | null;
    delivery_fee_mmk: number;
    discount_mmk: number;
    items: Array<{ product_name: string; quantity: number; unit_price_mmk: number }>;
  }) => Promise<{ order: any; shop_id: string; shop_name: string }>;
  getWebsiteUrl: () => Promise<string>;
  setWebsiteUrl: (url: string) => Promise<string>;
  reconnect: () => Promise<{ shop_id: string; shop_name: string; user_email?: string; shops?: Array<{ shop_id: string; shop_name: string }> }>;
  getShopContext: () => Promise<{ shop_id: string; shop_name: string; user_email?: string; shops?: Array<{ shop_id: string; shop_name: string }> }>;
  setActiveShop: (shopId: string) => Promise<void>;
  launcherDrag: (gesture: z.infer<typeof launcherDragSchema>) => void;
  loadDraft: () => Promise<AssistantDraft | null>;
  saveDraftFields: (fields: AssistantDraftFields) => void;
  saveDraftScreenshot: (screenshot: AssistantDraftScreenshot | null) => void;
  readClipboardText: () => Promise<string>;
  readClipboardImage: () => Promise<string | null>;
  writeClipboardText: (text: string) => Promise<void>;
};
