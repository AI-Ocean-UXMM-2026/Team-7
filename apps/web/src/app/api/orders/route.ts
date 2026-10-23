import { saveOrder } from "@/app/sales/actions";
import { NextResponse } from "next/server";
import { getCurrentSession, verifyShopMembership, getUserAuthorizedShops, getAuthorizedShopSession } from "@/lib/auth/session";
import { getOrders } from "@/lib/db";
import { uuidSchema } from "@ocean/contracts";

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedShop = searchParams.get("shop");
    const authSession = await getAuthorizedShopSession(requestedShop || undefined);
    if (!authSession) {
      return NextResponse.json({ error: "No authorized shop found" }, { status: 403 });
    }
    const targetShopId = authSession.shop.id;

    const query = searchParams.get("q")?.toLowerCase();
    const status = searchParams.get("status");

    let orders = getOrders(targetShopId, undefined, session.userId);

    if (status) {
      orders = orders.filter((o) => o.order_status === status);
    }

    if (query) {
      orders = orders.filter((o) => {
        const idMatch = o.id.toLowerCase().includes(query);
        const nameMatch = o.customers?.name?.toLowerCase().includes(query);
        const phoneMatch = o.customers?.phone?.includes(query);
        const itemMatch = o.order_items?.some((i) => i.product_name.toLowerCase().includes(query));
        return idMatch || nameMatch || phoneMatch || itemMatch;
      });
    }

    return NextResponse.json({
      shopId: targetShopId,
      total: orders.length,
      orders,
      timestamp: new Date().toISOString(),
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to load orders"
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid JSON order." }, { status: 400 });
  }

  const result = await saveOrder(body);
  if (result.error) {
    const status = /session|access|sign in|shop/i.test(result.error) ? 401 : 400;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { status: 200 });
}
