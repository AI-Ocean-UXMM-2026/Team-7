import { screenshotMatchRequestSchema } from "@ocean/contracts";
import { matchScreenshotOrders } from "@ocean/core";
import { NextResponse } from "next/server";
import { authorizeScreenshotShop, loadScreenshotMatchContext } from "@/lib/ai/screenshot-server";
import { RequestTooLargeError, readBoundedRequestBody } from "../../ai/screenshot-to-order/image";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    const raw = await readBoundedRequestBody(request, 100_000);
    body = JSON.parse(new TextDecoder().decode(raw)) as unknown;
  } catch (error) {
    return NextResponse.json({ error: error instanceof RequestTooLargeError ? "The matching request is too large." : "Send a valid matching request." }, { status: error instanceof RequestTooLargeError ? 413 : 400 });
  }
  const parsed = screenshotMatchRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "The editable screenshot fields are invalid. Review the values and retry." }, { status: 400 });

  const authorization = await authorizeScreenshotShop(parsed.data.shop_id);
  if (!authorization.available) return NextResponse.json({ error: "Live screenshot matching is unavailable until the seller workspace is configured." }, { status: 503 });
  if (!authorization.authenticated) return NextResponse.json({ error: "Sign in to an authorized seller workspace before rematching." }, { status: 401 });
  if (!authorization.authorizedShop) return NextResponse.json({ error: "You are not authorized to rematch evidence for this shop." }, { status: 403 });
  const context = await loadScreenshotMatchContext(authorization.db, parsed.data.shop_id);
  if (!context.ok) return NextResponse.json({ error: context.message }, { status: 503 });
  const matched = matchScreenshotOrders(context.context.orders, parsed.data.extraction, context.context.existing, parsed.data.image_sha256 ?? null);
  return NextResponse.json({
    mode: "live-match",
    ...matched,
    image_sha256: parsed.data.image_sha256 ?? null,
    evidence_schema_available: context.context.evidenceSchemaAvailable,
    message: context.context.evidenceSchemaAvailable ? "Candidates refreshed from the authorized shop." : "Candidates refreshed. Evidence persistence is not installed yet, so saving remains unavailable.",
  });
}
