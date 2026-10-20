"use server";

import { expenseSchema, expenseInputSchema, myanmarDate, uuidSchema } from "@ocean/contracts";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { loadOrders } from "@/app/sales/actions";
import type { BusinessSnapshot } from "./types";

async function authorizedShop(requested?: string) {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured. Use the sample workspace or complete shop setup.");
  const db = await createClient();
  const { data: auth } = await db.auth.getClaims();
  if (!auth?.claims?.sub) throw new Error("Sign in and open your shop workspace to use live records.");
  const { data: memberships, error } = await db.from("shop_memberships").select("shop_id").eq("user_id", auth.claims.sub);
  if (error) throw new Error("Shop access could not be verified. Please retry.");
  const shopId = requested ? uuidSchema.parse(requested) : memberships?.length === 1 ? memberships[0]?.shop_id : undefined;
  if (!shopId || !memberships?.some(row => row.shop_id === shopId)) throw new Error("Choose an authorized shop in My shop first.");
  return { db, shopId };
}
export async function loadLiveBusiness(shop?: string): Promise<{ data?: BusinessSnapshot; error?: string }> {
  try {
    const { db, shopId } = await authorizedShop(shop);
    const result = await loadOrders(shopId);
    if (!result.orders) return { error: result.error ?? "Orders unavailable." };
    if (result.orders.length > 500) return { error: "This shop has more than 500 orders. Complete financial reports need a paginated provider; partial totals are not shown." };
    const [{ data: expenses, error }, { data: shopRow }] = await Promise.all([
      db.from("expenses").select("*").eq("shop_id", shopId).order("expense_date", { ascending: false }).limit(501),
      db.from("shops").select("name").eq("id", shopId).single(),
    ]);
    if (error || !expenses || expenses.length > 500) return { error: "Complete expense records could not be loaded. Check your connection and database setup, then retry." };
    return { data: { source: "live", shopId, shopName: shopRow?.name ?? "Your shop", today: myanmarDate(new Date().toISOString()),
      orders: result.orders, expenses: expenses.map(expense => expenseSchema.parse(expense)), payments: null, productCosts: null,
      limitations: ["Payment records and order product costs are not connected. Received money and estimated profit are unavailable; they are never inferred from order statuses."] } };
  } catch (error) { return { error: error instanceof Error && error.message.length < 200 ? error.message : "Live data could not be loaded. Check your session and try again." }; }
}
export async function saveLiveExpense(shopId: string, input: unknown, id?: string) {
  const parsed = expenseInputSchema.safeParse(input);
  if (!parsed.success || (id && !uuidSchema.safeParse(id).success)) return { error: "Check the expense fields and try again." };
  try {
    const { db } = await authorizedShop(shopId);
    const query = id ? db.from("expenses").update(parsed.data).eq("shop_id", shopId).eq("id", id) : db.from("expenses").insert({ ...parsed.data, shop_id: shopId });
    const { data, error } = await query.select("*").single();
    const saved = expenseSchema.safeParse(data);
    if (error || !saved.success) return { error: "The expense could not be saved and read back. Reload before retrying; a write may already have completed." };
    return { expense: saved.data };
  } catch { return { error: "Expense saving is unavailable. Check your session and shop access. Reload before retrying." }; }
}
