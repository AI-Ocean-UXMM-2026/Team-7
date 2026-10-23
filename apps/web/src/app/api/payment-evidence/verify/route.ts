import {
  paymentEvidenceVerifyReadbackSchema,
  paymentEvidenceVerifyRequestSchema,
} from "@ocean/contracts";
import { NextResponse } from "next/server";
import { authorizeLocalScreenshotShop, authorizeScreenshotShop } from "@/lib/ai/screenshot-server";
import { getDb } from "@/lib/db/sqlite";
import { recordPayment } from "@/lib/db/repository";
import { RequestTooLargeError, readBoundedRequestBody } from "../../ai/screenshot-to-order/image";

export const runtime = "nodejs";

function responseError(message: string, status: 400 | 401 | 403 | 409 | 413 | 501 | 503) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    const body = await readBoundedRequestBody(request, 100_000);
    payload = JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch (error) {
    return responseError(error instanceof RequestTooLargeError ? "The verification request is too large." : "Send a valid payment verification request.", error instanceof RequestTooLargeError ? 413 : 400);
  }

  const parsed = paymentEvidenceVerifyRequestSchema.safeParse(payload);
  if (!parsed.success) return responseError("Review the amount, provider, reference, order, evidence revision, and trusted-record confirmation.", 400);

  const authorization = await authorizeLocalScreenshotShop(parsed.data.shop_id);
  if (!authorization.sessionPresent) {
    const hosted = await authorizeScreenshotShop(parsed.data.shop_id);
    if (!hosted.available) return responseError("Authorization service is unavailable. No payment was recorded.", 503);
    if (!hosted.authenticated) return responseError("Sign in to an authorized seller workspace before verifying a payment.", 401);
    if (!hosted.authorizedShop) return responseError("You are not authorized to verify payments for this shop.", 403);
    return responseError("Hosted payment verification is not installed. Evidence can remain pending, but no hosted payment or order status was changed; a reviewed shop-scoped transaction RPC is required.", 501);
  }
  let authorized = authorization.authorizedShop;
  let effectiveShopId = parsed.data.shop_id;
  if (!authorized && authorization.sessionPresent) {
    const db = getDb();
    const orderRow = db.prepare("SELECT shop_id FROM orders WHERE id = ?").get(parsed.data.order_id) as { shop_id: string } | undefined;
    if (orderRow) {
      const { verifyShopMembership } = await import("@/lib/auth/session");
      if (verifyShopMembership(authorization.userId, orderRow.shop_id).authorized) {
        authorized = true;
        effectiveShopId = orderRow.shop_id;
      }
    }
  }
  if (!authorized) return responseError("You are not authorized to verify payments for this shop.", 403);

  let result: ReturnType<typeof recordPayment>;
  try {
    result = recordPayment(effectiveShopId, authorization.userId, {
      order_id: parsed.data.order_id,
      amount_mmk: parsed.data.amount_mmk,
      payment_method: parsed.data.payment_method,
      reference_number: parsed.data.reference_number,
      evidence_id: parsed.data.evidence_id,
      expected_evidence_revision: parsed.data.expected_revision,
      trusted_record_confirmed: parsed.data.confirm_trusted_record,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The payment could not be recorded.";
    const status = /unauthorized/i.test(message) ? 403
      : /duplicate|already|changed|different|exists|exceeds|eligible|confirmed|refunded|another order|not found|cannot be verified/i.test(message) ? 409
        : /database|sqlite|disk/i.test(message) ? 503 : 400;
    return responseError(`${message} No additional payment was recorded.`, status);
  }

  const db = getDb();
  const payment = db.prepare("SELECT id, shop_id, order_id, amount_mmk, payment_method, reference_number, verified_at, created_at FROM payments WHERE id = ?").get(result.paymentId);
  const order = db.prepare("SELECT id, order_status, payment_status, fulfillment_status, total_mmk FROM orders WHERE id = ?").get(parsed.data.order_id) as {
    id: string; order_status: string; payment_status: string; fulfillment_status: string; total_mmk: number;
  } | undefined;
  const totalPaid = (db.prepare("SELECT COALESCE(SUM(amount_mmk), 0) as total_paid FROM payments WHERE order_id = ?").get(parsed.data.order_id) as { total_paid: number }).total_paid;
  const readback = paymentEvidenceVerifyReadbackSchema.safeParse({
    idempotent: result.idempotent,
    evidence_id: parsed.data.evidence_id,
    payment,
    order: order ? { ...order, total_paid_mmk: totalPaid } : null,
  });
  if (!readback.success) return responseError("Payment recording returned an invalid readback. Refresh Payments and the order before retrying.", 503);
  return NextResponse.json({
    readback: readback.data,
    message: result.idempotent ? "This evidence already has the matching verified payment. No duplicate was recorded." : "Trusted funds were verified and the payment was recorded. Only the order payment status was updated.",
  });
}
