"use server";

import { expenseInputSchema, myanmarDate, uuidSchema, type PaymentRecord } from "@ocean/contracts";
import { getExpenses, getOrders, getPayments, getShop, saveExpense as repoSaveExpense, getDb } from "@/lib/db";
import { getCurrentSession, verifyShopMembership, getUserAuthorizedShops } from "@/lib/auth/session";
import type { BusinessSnapshot } from "./types";

export async function loadLiveBusiness(shop?: string): Promise<{ data?: BusinessSnapshot; error?: string; status?: number }> {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return { error: "Authentication required: Sign in to view workspace.", status: 401 };
    }

    let targetShopId = shop;
    if (!targetShopId || !uuidSchema.safeParse(targetShopId).success) {
      const authorizedShops = getUserAuthorizedShops(session.userId);
      if (authorizedShops.length === 0) {
        return { error: "No authorized shop found for this account.", status: 403 };
      }
      targetShopId = authorizedShops[0]!.shop_id;
    }

    const membership = verifyShopMembership(session.userId, targetShopId);
    if (!membership.authorized) {
      return { error: "Authorization denied: You do not have permission to view this shop.", status: 403 };
    }

    const shopInfo = getShop(targetShopId);
    const orders = getOrders(targetShopId, undefined, session.userId);
    const expenses = getExpenses(targetShopId, session.userId);
    const paymentsRaw = getPayments(targetShopId, session.userId);

    // Map payments to PaymentRecord format expected by contracts
    const payments: PaymentRecord[] = paymentsRaw.map((p) => ({
      id: p.id,
      order_id: p.order_id,
      received_on: (p.verified_at || p.created_at).slice(0, 10),
      amount_mmk: p.amount_mmk,
      status: "confirmed" as const,
    }));

    // Calculate product costs from known product items
    const db = getDb();
    const costRows = db.prepare("SELECT name, cost_price_mmk FROM products WHERE shop_id = ?").all(targetShopId) as Array<{
      name: string;
      cost_price_mmk: number;
    }>;
    const costMap = new Map(costRows.map((r) => [r.name.toLowerCase(), r.cost_price_mmk]));

    const productCosts: Record<string, number> = {};
    for (const order of orders) {
      let costSum = 0;
      for (const item of order.order_items) {
        const unitCost = costMap.get(item.product_name.toLowerCase()) ?? Math.round(item.unit_price_mmk * 0.55);
        costSum += item.quantity * unitCost;
      }
      productCosts[order.id] = costSum;
    }

    return {
      data: {
        source: shopInfo.is_sample ? "sample" : "live",
        shopId: targetShopId,
        shopName: shopInfo.name,
        today: myanmarDate(new Date().toISOString()),
        orders,
        expenses,
        payments,
        productCosts,
        limitations: shopInfo.is_sample ? ["Sample Workspace — Synthetic demonstration data."] : [],
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Live records could not be loaded.",
      status: 500,
    };
  }
}

export async function saveLiveExpense(shopId: string, input: unknown, id?: string) {
  const session = await getCurrentSession();
  if (!session) {
    return { error: "Authentication required: Sign in to save expenses.", status: 401 };
  }

  const membership = verifyShopMembership(session.userId, shopId);
  if (!membership.authorized) {
    return { error: "Authorization denied: You do not have permission to record expenses for this shop.", status: 403 };
  }

  const parsed = expenseInputSchema.safeParse(input);
  if (!parsed.success || (id && !uuidSchema.safeParse(id).success)) {
    return { error: "Check the expense fields and try again.", status: 400 };
  }

  try {
    const expense = repoSaveExpense(shopId, parsed.data, id, session.userId);
    return { expense };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Expense could not be saved.", status: 500 };
  }
}
