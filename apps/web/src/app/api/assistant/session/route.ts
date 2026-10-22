import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentSession();
  return NextResponse.json({ connected: Boolean(user) }, {
    status: user ? 200 : 401,
    headers: { "cache-control": "no-store" },
  });
}
