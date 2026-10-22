"use server";

import { saveOrderSchema, uuidSchema, type OrderDetails } from "@ocean/contracts";
import { getOrders, saveOrder as repoSaveOrder } from "@/lib/db";
import { getCurrentSession, verifyShopMembership } from "@/lib/auth/session";

export type OrdersResult = { orders?: OrderDetails[]; error?: string; status?: number };

export async function loadOrders(shopId: string): Promise<OrdersResult> {
  if (!uuidSchema.safeParse(shopId).success) {
    return { error: "Shop setup is unavailable. Please check the shop ID.", status: 400 };
  }

  const session = await getCurrentSession();
  if (!session) {
    return { error: "Sign in to view orders.", status: 401 };
  }

  const membership = verifyShopMembership(session.userId, shopId);
  if (!membership.authorized) {
    return { error: "You are not authorized to view orders for this shop.", status: 403 };
  }

  try {
    const orders = getOrders(shopId, undefined, session.userId);
    return { orders };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Orders could not be loaded. Please retry.", status: 500 };
  }
}

export async function saveOrder(input: unknown): Promise<{ order?: OrderDetails; error?: string; status?: number }> {
  const parsed = saveOrderSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Check the highlighted order fields and try again.", status: 400 };
  }

  const session = await getCurrentSession();
  if (!session) {
    return { error: "Sign in to save orders.", status: 401 };
  }

  const membership = verifyShopMembership(session.userId, parsed.data.shop_id);
  if (!membership.authorized) {
    return { error: "You are not authorized to save orders in this shop.", status: 403 };
  }

  try {
    const order = repoSaveOrder(parsed.data, { userId: session.userId });
    return { order };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Order could not be saved. Please retry.", status: 500 };
  }
}
