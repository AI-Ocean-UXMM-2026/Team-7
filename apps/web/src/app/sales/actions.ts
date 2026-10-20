"use server";

import { orderDetailsSchema, saveOrderSchema, uuidSchema, type OrderDetails } from "@ocean/contracts";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const selection = "*, customers(name, phone), order_items(*)";
export type OrdersResult = { orders?: OrderDetails[]; error?: string };

export async function loadOrders(shopId: string): Promise<OrdersResult> {
  if (!uuidSchema.safeParse(shopId).success || !isSupabaseConfigured()) return { error: "Shop setup is unavailable. Open your workspace and try again." };
  try {
    const db = await createClient();
    const { data: auth } = await db.auth.getClaims();
    if (!auth?.claims?.sub) return { error: "Your session expired. Sign in again to load orders." };
    const { data: member, error: memberError } = await db.from("shop_memberships").select("shop_id").eq("shop_id", shopId).eq("user_id", auth.claims.sub).maybeSingle();
    if (memberError || !member) return { error: "Shop access could not be verified. Open your workspace and try again." };
    // Explicit shop scope supplements database RLS. Range is deliberate and disclosed.
    const { data, error } = await db.from("orders").select(selection).eq("shop_id", shopId).order("created_at", { ascending: false }).limit(501);
    if (error) return { error: "Orders could not be loaded. Check the connection and database migrations, then retry." };
    const orders: OrderDetails[] = [];
    for (const row of data ?? []) {
      const parsed = orderDetailsSchema.safeParse(row);
      if (!parsed.success) return { error: "An order has unsupported data. Contact your shop administrator before editing." };
      orders.push(parsed.data);
    }
    return { orders };
  } catch { return { error: "Orders could not be loaded. Check your connection and retry." }; }
}

export async function saveOrder(input: unknown): Promise<{ order?: OrderDetails; error?: string }> {
  const parsed = saveOrderSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the highlighted order fields and try again." };
  if (!isSupabaseConfigured()) return { error: "Supabase setup is incomplete." };
  try {
    const db = await createClient();
    const { data: auth } = await db.auth.getClaims();
    if (!auth?.claims?.sub) return { error: "Your session expired. Sign in again before saving." };
    const { data: member, error: memberError } = await db.from("shop_memberships").select("shop_id").eq("shop_id", parsed.data.shop_id).eq("user_id", auth.claims.sub).maybeSingle();
    if (memberError || !member) return { error: "You no longer have access to this shop." };
    const { error } = await db.rpc("save_shop_order", { p_input: parsed.data });
    if (error) {
      if (error.code === "40001") return { error: "This order changed in another session, or an earlier save already completed. Reload orders and reopen it before saving." };
      if (["PGRST202", "42883"].includes(error.code)) return { error: "Order saving is not installed in this database. Apply the Milestone 2A.2 migration, then retry." };
      return { error: "Order could not be saved. Check your connection and shop access, then retry. Orders with payment records need payment adjustment review." };
    }
    const { data, error: readError } = await db.from("orders").select(selection).eq("shop_id", parsed.data.shop_id).eq("id", parsed.data.id).single();
    const saved = orderDetailsSchema.safeParse(data);
    if (readError || !saved.success) return { error: "The save was sent, but could not be read back. Reload orders before retrying to avoid a duplicate." };
    return { order: saved.data };
  } catch { return { error: "Connection interrupted. Reload orders before retrying; the save may already have completed." }; }
}
