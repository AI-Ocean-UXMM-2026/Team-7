import crypto from "node:crypto";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";
import { signSessionToken } from "@/lib/auth/token";
import { getDb } from "@/lib/db/sqlite";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Connect assistant · တူတူတွက်မယ်" };

export const dynamic = "force-dynamic";

export default async function ConnectAssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string; done?: string; port?: string }>;
}) {
  const { challenge, done, port } = await searchParams;
  if (!challenge || !/^[a-f0-9]{64}$/u.test(challenge)) redirect("/assistant");

  const user = await getCurrentSession();
  if (!user) {
    const nextPath = `/assistant/connect?challenge=${challenge}${done === "1" ? "&done=1" : ""}${port ? `&port=${port}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  let isConsumed = false;
  try {
    const db = getDb();
    const pairing = db
      .prepare("SELECT consumed_at FROM assistant_pairings WHERE challenge = ?")
      .get(challenge) as { consumed_at: number | null } | undefined;
    if (pairing && pairing.consumed_at !== null) {
      isConsumed = true;
    }
  } catch {
    // Optional check fallback
  }

  const isConnected = done === "1" || isConsumed;
  const directToken = isConnected
    ? signSessionToken({
        sub: user.userId,
        iat: Date.now(),
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
        nonce: crypto.randomBytes(8).toString("hex"),
      })
    : null;

  return (
    <main className="assistant-connect-page">
      <section className="assistant-connect-card">
        <span className="eyebrow">တူတူတွက်မယ် · Floating Assistant</span>
        <h1>Connect your floating assistant</h1>
        {isConnected ? (
          <>
            <div className="assistant-connect-success" role="status">
              <span style={{ fontSize: "1.25rem", lineHeight: 1 }}>✓</span>
              <span>Assistant Connected · ချိတ်ဆက်ပြီးပါပြီ</span>
            </div>
            {port && directToken && (
              <img
                src={`http://127.0.0.1:${port}/pair?token=${encodeURIComponent(directToken)}`}
                style={{ display: "none" }}
                alt=""
              />
            )}
            <p>
              Your floating assistant is connected and ready. You can close this browser tab and return to the floating window to review orders and payments.
            </p>
            <div className="assistant-connect-actions">
              <Link href="/" className="btn-secondary">
                Open Dashboard
              </Link>
            </div>
          </>
        ) : (
          <>
            <p>
              Continue as <strong>{user.displayName || user.email || "your signed-in account"}</strong>. This connects this device once, so you can review orders and payments without entering your password again.
            </p>
            <form method="post" action="/api/assistant/connect">
              <input type="hidden" name="challenge" value={challenge} />
              {port && <input type="hidden" name="port" value={port} />}
              <button type="submit">Connect assistant</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

