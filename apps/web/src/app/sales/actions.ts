"use server";

import { myanmarDate, saveOrderSchema, uuidSchema, type OrderDetails } from "@ocean/contracts";
import { getOrders, saveOrder as repoSaveOrder } from "@/lib/db";
import { getCurrentSession, verifyShopMembership, getUserAuthorizedShops } from "@/lib/auth/session";
import { ensureLocalProfile } from "@/lib/auth/local-profile";
import { createSampleSnapshot } from "@/lib/business/sample-provider";

export type OrdersResult = { orders?: OrderDetails[]; error?: string; status?: number };

export async function loadOrders(shopId: string): Promise<OrdersResult> {
  if (!uuidSchema.safeParse(shopId).success) {
    return { error: "Shop setup is unavailable. Please check the shop ID.", status: 400 };
  }

  const session = await getCurrentSession();
  if (!session) {
    return { error: "Sign in to view orders.", status: 401 };
  }

  let membership = verifyShopMembership(session.userId, shopId);
  if (!membership.authorized) {
    ensureLocalProfile({
      id: session.userId,
      email: session.email,
      user_metadata: { display_name: session.displayName },
    });
    membership = verifyShopMembership(session.userId, shopId);
  }

  if (!membership.authorized) {
    return { error: "You are not authorized to view orders for this shop.", status: 403 };
  }

  try {
    if (membership.shop?.is_sample || shopId === "00000000-0000-4000-8000-000000000001") {
      const sample = createSampleSnapshot(myanmarDate(new Date().toISOString()));
      return { orders: sample.orders };
    }
    const orders = getOrders(shopId, undefined, session.userId);
    return { orders };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Orders could not be loaded. Please retry.", status: 500 };
  }
}

export async function saveOrder(input: unknown): Promise<{ order?: OrderDetails; error?: string; status?: number }> {
  const session = await getCurrentSession();
  if (!session) {
    return { error: "Sign in to save orders.", status: 401 };
  }

  // Pre-normalize payload if shop_id is missing, invalid, or belongs to another/sample shop
  let payload = input;
  if (typeof payload === "object" && payload !== null) {
    const rawShopId = (payload as { shop_id?: unknown }).shop_id;
    const isValidUuid = typeof rawShopId === "string" && uuidSchema.safeParse(rawShopId).success;

    let isAuthorized = false;
    if (isValidUuid) {
      const mem = verifyShopMembership(session.userId, rawShopId as string);
      if (mem.authorized && !mem.shop?.is_sample) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      const userShops = getUserAuthorizedShops(session.userId);
      const targetShop = userShops.find((s) => !s.is_sample) || userShops[0];
      if (targetShop) {
        payload = { ...payload, shop_id: targetShop.shop_id };
      }
    }
  }

  const parsed = saveOrderSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Check the highlighted order fields and try again.", status: 400 };
  }

  let membership = verifyShopMembership(session.userId, parsed.data.shop_id);
  if (!membership.authorized) {
    ensureLocalProfile({
      id: session.userId,
      email: session.email,
      user_metadata: { display_name: session.displayName },
    });
    membership = verifyShopMembership(session.userId, parsed.data.shop_id);
  }

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
