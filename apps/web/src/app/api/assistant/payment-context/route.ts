import { NextResponse } from "next/server";
import { getAuthorizedShopSession, getUserAuthorizedShops } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedShop = url.searchParams.get("shop_id");
  const session = await getAuthorizedShopSession(requestedShop || undefined);
  if (!session) return NextResponse.json({ error: "Sign in to a seller workspace before reviewing a payment." }, { status: 401 });

  const allShops = getUserAuthorizedShops(session.user.userId);

  const response = NextResponse.json({
    shop_id: session.shop.id,
    shop_name: session.shop.name,
    user_email: session.user.email,
    user_display_name: session.user.displayName,
    shops: allShops.map((s) => ({ shop_id: s.shop_id, shop_name: s.shop_name })),
  }, {
    headers: { "cache-control": "no-store" },
  });

  // Set active shop cookie to keep workspace in sync
  response.cookies.set("salesayar_active_shop", session.shop.id, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}

