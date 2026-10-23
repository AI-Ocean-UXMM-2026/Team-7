import { screenshotMatchRequestSchema } from "@ocean/contracts";
import { matchScreenshotOrders } from "@ocean/core";
import { NextResponse } from "next/server";
import { authorizeLocalScreenshotShop, authorizeScreenshotShop, loadScreenshotMatchContext } from "@/lib/ai/screenshot-server";
import { matchScreenshot } from "@/lib/db/repository";
import { RequestTooLargeError, readBoundedRequestBody } from "../../ai/screenshot-to-order/image";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    const raw = await readBoundedRequestBody(request, 100_000);
    body = JSON.parse(new TextDecoder().decode(raw)) as unknown;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof RequestTooLargeError ? "The matching request is too large." : "Send a valid matching request." },
      { status: error instanceof RequestTooLargeError ? 413 : 400 }
    );
  }
  const parsed = screenshotMatchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "The editable screenshot fields are invalid. Review the values and retry." }, { status: 400 });
  }

  const localAuthorization = await authorizeLocalScreenshotShop(parsed.data.shop_id);
  if (localAuthorization.sessionPresent) {
    let effectiveShopId = parsed.data.shop_id;
    if (!localAuthorization.authorizedShop) {
      const { getUserAuthorizedShops } = await import("@/lib/auth/session");
      const userShops = getUserAuthorizedShops(localAuthorization.userId);
      const activeShop = userShops.find((s) => !s.is_sample) || userShops[0];
      if (activeShop) {
        effectiveShopId = activeShop.shop_id;
        localAuthorization.authorizedShop = true;
      }
    }
    if (!localAuthorization.authorizedShop) return NextResponse.json({ error: "You are not authorized to rematch evidence for this shop." }, { status: 403 });
    const { getDb } = await import("@/lib/db/sqlite");
    const count = (getDb().prepare("SELECT COUNT(*) as count FROM orders WHERE shop_id = ?").get(effectiveShopId) as { count: number } | undefined)?.count ?? 0;
    if (count === 0) {
      const { getUserAuthorizedShops } = await import("@/lib/auth/session");
      const userShops = getUserAuthorizedShops(localAuthorization.userId);
      const bestShop = userShops.find((s) => !s.is_sample);
      if (bestShop) effectiveShopId = bestShop.shop_id;
    }
    try {
      const matched = matchScreenshot(effectiveShopId, parsed.data.extraction, parsed.data.image_sha256 ?? null, localAuthorization.userId);

      return NextResponse.json({
        mode: "live-match", ...matched, image_sha256: parsed.data.image_sha256 ?? null,
        evidence_schema_available: true, verification_available: true,
        message: "Candidates refreshed from this authorized local shop. Signals are advisory only.",
      });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Authorized shop data could not be matched safely." }, { status: 503 });
    }
  }

  const authorization = await authorizeScreenshotShop(parsed.data.shop_id);
  if (!authorization.available) return NextResponse.json({ error: "Authorization service is unavailable. Check the database configuration and retry." }, { status: 503 });
  if (!authorization.authenticated) return NextResponse.json({ error: "Sign in to an authorized seller workspace before rematching." }, { status: 401 });
  if (!authorization.authorizedShop) return NextResponse.json({ error: "You are not authorized to rematch evidence for this shop." }, { status: 403 });
  const context = await loadScreenshotMatchContext(authorization.db, parsed.data.shop_id);
  if (!context.ok) return NextResponse.json({ error: context.message }, { status: 503 });
  const matched = matchScreenshotOrders(context.context.orders, parsed.data.extraction, context.context.existing, parsed.data.image_sha256 ?? null);
  return NextResponse.json({
    mode: "live-match", ...matched, image_sha256: parsed.data.image_sha256 ?? null,
    evidence_schema_available: context.context.evidenceSchemaAvailable, verification_available: false,
    message: "Candidates refreshed from the authorized hosted shop. Signals are advisory only.",
  });
}
