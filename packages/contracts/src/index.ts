import { z } from "zod";
export { receivingAccountInputSchema, receivingAccountDeleteSchema } from "./receiving-account.ts";
import { calculateOrderTotals } from "@ocean/core";
export { calculateOrderTotals } from "@ocean/core";
export { summarizeFinancials, financialTrend, expenseBreakdown, totalExpenseAmount, myanmarDate, shiftDate, validRange } from "@ocean/core";
export type { DateRange, FinancialData, PaymentRecord } from "@ocean/core";

export const uuidSchema = z.uuid();
export const timestampSchema = z.iso.datetime({ offset: true });
export const mmkSchema = z.number().int().safe().nonnegative();
export const positiveMmkSchema = mmkSchema.positive();
export const currencySchema = z.literal("MMK");

export const profileSchema = z.object({
  id: uuidSchema,
  display_name: z.string().trim().min(1).max(120).nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const shopSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1).max(120),
  currency: currencySchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const shopMembershipRoleSchema = z.enum(["owner", "admin", "member"]);
export const shopMembershipSchema = z.object({
  shop_id: uuidSchema,
  user_id: uuidSchema,
  role: shopMembershipRoleSchema,
  created_at: timestampSchema,
});

export const customerSchema = z.object({
  id: uuidSchema,
  shop_id: uuidSchema,
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(40).nullable(),
  address: z.string().trim().max(500).nullable(),
  notes: z.string().trim().max(2000).nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const orderStatusSchema = z.enum(["draft", "confirmed", "cancelled"]);
export const paymentStatusSchema = z.enum([
  "unpaid",
  "partially_paid",
  "paid",
  "refunded",
]);
export const fulfillmentStatusSchema = z.enum([
  "unfulfilled",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);

export const orderSchema = z.object({
  id: uuidSchema,
  shop_id: uuidSchema,
  customer_id: uuidSchema.nullable(),
  order_status: orderStatusSchema,
  payment_status: paymentStatusSchema,
  fulfillment_status: fulfillmentStatusSchema,
  subtotal_mmk: mmkSchema,
  delivery_fee_mmk: mmkSchema,
  discount_mmk: mmkSchema,
  total_mmk: mmkSchema,
  delivery_address: z.string().trim().max(500).nullable(),
  notes: z.string().trim().max(4000).nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const orderItemSchema = z.object({
  id: uuidSchema,
  shop_id: uuidSchema,
  order_id: uuidSchema,
  product_name: z.string().trim().min(1).max(200),
  quantity: z.number().int().positive().safe(),
  unit_price_mmk: mmkSchema,
  line_total_mmk: mmkSchema,
  created_at: timestampSchema,
});

export const expenseSchema = z.object({
  id: uuidSchema,
  shop_id: uuidSchema,
  description: z.string().trim().min(1).max(200),
  amount_mmk: positiveMmkSchema,
  category: z.string().trim().min(1).max(80),
  expense_date: z.iso.date(),
  notes: z.string().trim().max(2000).nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const expenseCategories = ["Product costs", "Packaging", "Delivery", "Marketing", "Other"] as const;
export const expenseInputSchema = expenseSchema.pick({ description: true, amount_mmk: true, expense_date: true, notes: true }).extend({
  category: z.enum(expenseCategories),
}).strict();
export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export const signInSchema = z.object({
  email: z.string().trim().pipe(z.email().max(254)),
  password: z.string().min(8).max(128),
});

export const recoveryEmailSchema = signInSchema.pick({ email: true });
export const resetPasswordSchema = z.object({
  password: z.string().min(8).max(128),
  confirmation: z.string(),
}).refine((value) => value.password === value.confirmation, {
  message: "Passwords must match.", path: ["confirmation"],
});

export const signUpSchema = signInSchema.extend({
  display_name: z.string().trim().min(1).max(120),
});

export const createShopSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

export type Profile = z.infer<typeof profileSchema>;
export type Shop = z.infer<typeof shopSchema>;
export type ShopMembershipRole = z.infer<typeof shopMembershipRoleSchema>;
export type ShopMembership = z.infer<typeof shopMembershipSchema>;
export type Customer = z.infer<typeof customerSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type FulfillmentStatus = z.infer<typeof fulfillmentStatusSchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type Expense = z.infer<typeof expenseSchema>;

export const orderLineInputSchema = orderItemSchema.pick({
  product_name: true, quantity: true, unit_price_mmk: true,
}).extend({
  quantity: orderItemSchema.shape.quantity.max(1000000),
  unit_price_mmk: mmkSchema.max(9007199254),
}).strict();

export const saveOrderSchema = z.object({
  shop_id: uuidSchema,
  id: uuidSchema,
  expected_updated_at: timestampSchema.nullable(),
  customer_name: customerSchema.shape.name,
  customer_phone: customerSchema.shape.phone,
  delivery_address: orderSchema.shape.delivery_address,
  notes: orderSchema.shape.notes,
  order_status: orderStatusSchema,
  fulfillment_status: fulfillmentStatusSchema,
  delivery_fee_mmk: mmkSchema,
  discount_mmk: mmkSchema,
  items: z.array(orderLineInputSchema).min(1).max(100),
}).strict().superRefine((value, ctx) => {
  if (value.delivery_address?.trim() && !value.customer_phone?.trim()) {
    ctx.addIssue({ code: "custom", path: ["customer_phone"], message: "A phone number is required when a delivery address is provided." });
  }
  try { calculateOrderTotals(value.items, value.delivery_fee_mmk, value.discount_mmk); }
  catch { ctx.addIssue({ code: "custom", path: ["discount_mmk"], message: "Check the amounts: use safe whole MMK and a discount no greater than subtotal plus delivery." }); }
});

export const orderDetailsSchema = orderSchema.extend({
  customers: customerSchema.pick({ name: true, phone: true }).nullable(),
  order_items: z.array(orderItemSchema),
});
export type SaveOrderInput = z.infer<typeof saveOrderSchema>;
export type OrderDetails = z.infer<typeof orderDetailsSchema>;

export {
  chatOrderExtractionItemSchema,
  chatOrderExtractionSchema,
  chatOrderRequestSchema,
  chatOrderResponseSchema,
} from "./chat-to-order.ts";
export type {
  ChatOrderExtraction,
  ChatOrderExtractionItem,
  ChatOrderRequest,
  ChatOrderResponse,
} from "./chat-to-order.ts";

export {
  buildPaymentEvidenceSavePayload,
  duplicateEvidenceWarningSchema,
  localPaymentEvidenceReadbackSchema,
  paymentEvidenceReadbackSchema,
  paymentEvidenceResumeResponseSchema,
  paymentEvidenceSaveSchema,
  paymentEvidenceVerifyReadbackSchema,
  paymentEvidenceVerifyRequestSchema,
  screenshotAnalyzeRequestSchema,
  screenshotAnalyzeResponseSchema,
  screenshotCandidateSchema,
  screenshotExtractionSchema,
  screenshotFulfillmentStatusSchema,
  screenshotMatchRequestSchema,
  screenshotMatchResponseSchema,
  screenshotMimeSchema,
  screenshotOrderStatusSchema,
  screenshotPaymentStatusSchema,
} from "./screenshot-to-order.ts";
export type {
  DuplicateEvidenceWarning,
  LocalPaymentEvidenceReadback,
  PaymentEvidenceReadback,
  PaymentEvidenceResumeResponse,
  PaymentEvidenceSave,
  PaymentEvidenceVerifyReadback,
  PaymentEvidenceVerifyRequest,
  ScreenshotAnalyzeResponse,
  ScreenshotCandidate,
  ScreenshotExtraction,
  ScreenshotMime,
} from "./screenshot-to-order.ts";
