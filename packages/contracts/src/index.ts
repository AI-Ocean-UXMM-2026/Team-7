import { z } from "zod";

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

export const signInSchema = z.object({
  email: z.email().trim().max(254),
  password: z.string().min(8).max(128),
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
