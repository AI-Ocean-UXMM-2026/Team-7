import { z } from "zod";

const nullableTextSchema = z.string().trim().max(4_000).nullable();
const nullableAmountSchema = z.number().int().safe().nonnegative().max(9007199254).nullable();

export const chatOrderRequestSchema = z.object({
  chat: z.string().trim().min(1).max(20_000),
  shop_id: z.uuid().optional(),
}).strict();

export const chatOrderExtractionItemSchema = z.object({
  product_name: z.string().trim().max(200).nullable(),
  quantity: z.number().int().positive().max(1_000_000).nullable(),
  unit_price_mmk: nullableAmountSchema,
}).strict();

export const chatOrderExtractionSchema = z.object({
  customer_name: z.string().trim().max(160).nullable(),
  customer_phone: z.string().trim().max(40).nullable(),
  delivery_address: z.string().trim().max(500).nullable(),
  notes: nullableTextSchema,
  delivery_fee_mmk: nullableAmountSchema,
  discount_mmk: nullableAmountSchema,
  items: z.array(chatOrderExtractionItemSchema).min(1).max(100),
  missing_fields: z.array(z.string().trim().min(1).max(100)).max(100),
}).strict();

const chatOrderLiveResponseSchema = z.object({
  mode: z.literal("live"),
  extraction: chatOrderExtractionSchema,
  message: z.string().trim().max(500).optional(),
}).strict();

const chatOrderSimulationResponseSchema = z.object({
  mode: z.literal("simulation"),
  extraction: chatOrderExtractionSchema,
  message: z.string().trim().max(500),
}).strict();

const chatOrderErrorResponseSchema = z.object({
  mode: z.literal("error"),
  fallback: chatOrderExtractionSchema,
  error: z.string().trim().min(1).max(500),
}).strict();

export const chatOrderResponseSchema = z.discriminatedUnion("mode", [
  chatOrderLiveResponseSchema,
  chatOrderSimulationResponseSchema,
  chatOrderErrorResponseSchema,
]);

export type ChatOrderRequest = z.infer<typeof chatOrderRequestSchema>;
export type ChatOrderExtractionItem = z.infer<typeof chatOrderExtractionItemSchema>;
export type ChatOrderExtraction = z.infer<typeof chatOrderExtractionSchema>;
export type ChatOrderResponse = z.infer<typeof chatOrderResponseSchema>;
