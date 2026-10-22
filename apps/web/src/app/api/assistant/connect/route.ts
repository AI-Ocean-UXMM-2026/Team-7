import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { acceptAssistantChallenge } from "@/lib/auth/assistant-pairing";
import { sameOriginMutation } from "@/lib/auth/request-origin";

import { getDb } from "@/lib/db/sqlite";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sameOriginMutation(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const user = await getCurrentSession();
  if (!user) return NextResponse.json({ error: "Sign in to connect the assistant." }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const challenge = form?.get("challenge");
  if (typeof challenge !== "string" || !/^[a-f0-9]{64}$/u.test(challenge)) return NextResponse.json({ error: "Connection request is invalid." }, { status: 400 });
  const port = form?.get("port");
  const portParam = typeof port === "string" && /^\d{4,5}$/.test(port) ? `&port=${port}` : "";
  if (!acceptAssistantChallenge(challenge, user.userId)) {
    const db = getDb();
    const existing = db.prepare("SELECT user_id FROM assistant_pairings WHERE challenge = ?").get(challenge) as { user_id: string } | undefined;
    if (existing?.user_id === user.userId) {
      return NextResponse.redirect(new URL(`/assistant/connect?challenge=${challenge}&done=1${portParam}`, request.url), { status: 303 });
    }
    return NextResponse.json({ error: "This connection request was already used. Start again from the assistant." }, { status: 409 });
  }
  return NextResponse.redirect(new URL(`/assistant/connect?challenge=${challenge}&done=1${portParam}`, request.url), { status: 303 });
}
