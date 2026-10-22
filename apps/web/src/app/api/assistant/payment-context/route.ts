import { NextResponse } from "next/server";
import { getAuthorizedShopSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getAuthorizedShopSession();
  if (!session) return NextResponse.json({ error: "Sign in to a seller workspace before reviewing a payment." }, { status: 401 });

  return NextResponse.json({ shop_id: session.shop.id, shop_name: session.shop.name }, {
    headers: { "cache-control": "no-store" },
  });
}
