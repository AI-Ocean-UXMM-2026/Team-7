import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { uuidSchema, receivingAccountInputSchema, receivingAccountDeleteSchema } from "@ocean/contracts";
import { getCurrentSession, verifyShopMembership } from "@/lib/auth/session";
import { getDb } from "@/lib/db/sqlite";
import { authorizeScreenshotShop } from "@/lib/ai/screenshot-server";
import { sameOriginMutation } from "@/lib/auth/request-origin";

export const runtime = "nodejs";


function publicAccount(row: { id: string; provider: string; account_name: string; account_number: string }) {
  return { id: row.id, provider: row.provider, account_name: row.account_name, last_four: row.account_number.replace(/\D/gu, "").slice(-4) };
}

async function access(shopId: string) {
  const session = await getCurrentSession();
  if (session) {
    const membership = verifyShopMembership(session.userId, shopId);
    return membership.authorized ? { kind: "local" as const, owner: membership.role === "owner" } : null;
  }
  const hosted = await authorizeScreenshotShop(shopId);
  if (!hosted.available || !hosted.authenticated || !hosted.authorizedShop) return null;
  const { data, error } = await hosted.db.from("shop_memberships").select("role").eq("shop_id", shopId).eq("user_id", hosted.userId).single();
  if (error) return null;
  return { kind: "hosted" as const, db: hosted.db, owner: data.role === "owner" };
}

export async function GET(request: Request) {
  const shopId = new URL(request.url).searchParams.get("shop_id");
  if (!uuidSchema.safeParse(shopId).success) return NextResponse.json({ error: "Choose a shop." }, { status: 400 });
  const scope = await access(shopId!);
  if (!scope) return NextResponse.json({ error: "Shop access denied." }, { status: 403 });
  if (scope.kind === "local") {
    const rows = getDb().prepare("SELECT id, provider, account_name, account_number FROM shop_receiving_accounts WHERE shop_id = ? ORDER BY created_at").all(shopId) as Array<{ id: string; provider: string; account_name: string; account_number: string }>;
    return NextResponse.json({ accounts: rows.map(publicAccount) });
  }
  const { data, error } = await scope.db.from("shop_receiving_accounts").select("id,provider,account_name,account_number").eq("shop_id", shopId).order("created_at");
  if (error) return NextResponse.json({ error: "Receiving accounts are unavailable. Apply the latest migration." }, { status: 503 });
  return NextResponse.json({ accounts: (data ?? []).map(publicAccount) });
}

export async function POST(request: Request) {
  if (!sameOriginMutation(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const parsed = receivingAccountInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a provider, account name, and account number." }, { status: 400 });
  const scope = await access(parsed.data.shop_id);
  if (!scope?.owner) return NextResponse.json({ error: "Only the shop owner can manage receiving accounts." }, { status: 403 });
  const account = { id: crypto.randomUUID(), ...parsed.data, created_at: new Date().toISOString() };
  if (scope.kind === "local") {
    try { getDb().prepare("INSERT INTO shop_receiving_accounts (id,shop_id,provider,account_name,account_number,created_at) VALUES (?,?,?,?,?,?)").run(account.id, account.shop_id, account.provider, account.account_name, account.account_number, account.created_at); }
    catch { return NextResponse.json({ error: "This receiving account may already be saved." }, { status: 409 }); }
  } else {
    const { error } = await scope.db.from("shop_receiving_accounts").insert(account);
    if (error) return NextResponse.json({ error: "The receiving account could not be saved. Check for a duplicate or missing migration." }, { status: 409 });
  }
  return NextResponse.json({ account: publicAccount(account) }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!sameOriginMutation(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const parsed = receivingAccountDeleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a receiving account." }, { status: 400 });
  const scope = await access(parsed.data.shop_id);
  if (!scope?.owner) return NextResponse.json({ error: "Only the shop owner can manage receiving accounts." }, { status: 403 });
  if (scope.kind === "local") getDb().prepare("DELETE FROM shop_receiving_accounts WHERE id = ? AND shop_id = ?").run(parsed.data.id, parsed.data.shop_id);
  else {
    const { error } = await scope.db.from("shop_receiving_accounts").delete().eq("id", parsed.data.id).eq("shop_id", parsed.data.shop_id);
    if (error) return NextResponse.json({ error: "The receiving account could not be removed." }, { status: 503 });
  }
  return NextResponse.json({ removed: true });
}
