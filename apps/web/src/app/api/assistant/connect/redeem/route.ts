import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { redeemAssistantVerifier } from "@/lib/auth/assistant-pairing";
import { signSessionToken } from "@/lib/auth/token";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text().catch(() => "");
  if (body.length > 200) return NextResponse.json({ error: "Invalid connection request." }, { status: 400 });
  let verifier: unknown;
  try { verifier = (JSON.parse(body) as { verifier?: unknown }).verifier; } catch { return NextResponse.json({ error: "Invalid connection request." }, { status: 400 }); }
  if (typeof verifier !== "string") return NextResponse.json({ error: "Invalid connection request." }, { status: 400 });
  const userId = redeemAssistantVerifier(verifier);
  if (!userId) return NextResponse.json({ ready: false }, { headers: { "cache-control": "no-store" } });
  const now = Date.now();
  const token = signSessionToken({ sub: userId, iat: now, exp: now + 7 * 24 * 60 * 60 * 1000, nonce: crypto.randomBytes(8).toString("hex") });
  return NextResponse.json({ ready: true, token }, { headers: { "cache-control": "no-store" } });
}
