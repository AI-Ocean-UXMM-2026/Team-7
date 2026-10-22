import { NextResponse } from "next/server";
import { getCurrentSession, verifyShopMembership, getUserAuthorizedShops } from "@/lib/auth/session";
import { getExpenses } from "@/lib/db";
import { saveLiveExpense } from "@/lib/business/live-actions";
import { uuidSchema } from "@ocean/contracts";

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let targetShopId = searchParams.get("shop");

    if (!targetShopId || !uuidSchema.safeParse(targetShopId).success) {
      const authorizedShops = getUserAuthorizedShops(session.userId);
      if (authorizedShops.length === 0) {
        return NextResponse.json({ error: "No authorized shop found" }, { status: 403 });
      }
      targetShopId = authorizedShops[0]!.shop_id;
    }

    const membership = verifyShopMembership(session.userId, targetShopId);
    if (!membership.authorized) {
      return NextResponse.json({ error: "Authorization denied" }, { status: 403 });
    }

    const category = searchParams.get("category");
    let expenses = getExpenses(targetShopId, session.userId);

    if (category) {
      expenses = expenses.filter((e) => e.category === category);
    }

    return NextResponse.json({
      shopId: targetShopId,
      total: expenses.length,
      expenses,
      timestamp: new Date().toISOString(),
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to load expenses"
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const shopId = body.shopId || searchParams.get("shop");

    if (!shopId) {
      return NextResponse.json({ error: "Shop ID is required" }, { status: 400 });
    }

    const result = await saveLiveExpense(shopId, body.input || body, body.id);
    if (!result.expense) {
      return NextResponse.json({ error: result.error ?? "Failed to save expense" }, { status: result.status ?? 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Invalid expense payload"
    }, { status: 400 });
  }
}
