import { Buffer } from "node:buffer";
import {
  paymentEvidenceReadbackSchema,
  paymentEvidenceResumeResponseSchema,
  paymentEvidenceSaveSchema,
  screenshotAnalyzeRequestSchema,
} from "@ocean/contracts";
import { matchScreenshotOrders } from "@ocean/core";
import { NextResponse } from "next/server";
import { authorizeLocalScreenshotShop, authorizeScreenshotShop, isMissingEvidenceSchema, loadScreenshotMatchContext, missingEvidenceSetupMessage } from "@/lib/ai/screenshot-server";
import { getLocalPaymentEvidenceReadback, matchScreenshot, savePaymentEvidenceRecord } from "@/lib/db/repository";
import { getDb } from "@/lib/db/sqlite";
import {
  ImageValidationError,
  RequestTooLargeError,
  readBoundedRequestBody,
  validateImageBytes,
} from "../ai/screenshot-to-order/image";

export const runtime = "nodejs";

function responseError(message: string, status: 400 | 401 | 403 | 404 | 409 | 413 | 503) {
  return NextResponse.json({ error: message }, { status });
}

function missingSchema(error: { code?: string; message?: string } | null | undefined) {
  return isMissingEvidenceSchema(error) || Boolean(error && /storage.*(bucket|not found)|bucket.*not found/i.test(error.message ?? ""));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = screenshotAnalyzeRequestSchema.safeParse({ shop_id: url.searchParams.get("shop_id"), evidence_id: url.searchParams.get("evidence_id") });
  if (!parsed.success || !parsed.data.evidence_id) return responseError("A valid shop and evidence ID are required.", 400);

  const localAuthorization = await authorizeLocalScreenshotShop(parsed.data.shop_id);
  if (localAuthorization.sessionPresent) {
    if (!localAuthorization.authorizedShop) return responseError("You are not authorized to view evidence for this shop.", 403);
    try {
      const evidence = getLocalPaymentEvidenceReadback(parsed.data.shop_id, parsed.data.evidence_id, localAuthorization.userId);
      if (!evidence) return responseError("This payment evidence is no longer available in this shop.", 404);
      const matched = matchScreenshot(parsed.data.shop_id, evidence.seller_reviewed, evidence.image_sha256, localAuthorization.userId, evidence.id);
      const response = paymentEvidenceResumeResponseSchema.safeParse({
        evidence, ...matched, image_sha256: evidence.image_sha256, evidence_schema_available: true,
        verification_available: true, message: "Saved evidence and authorized candidates were loaded. Verify funds only from a trusted bank or merchant record.",
      });
      if (!response.success) return responseError("The saved local evidence returned unsupported review data.", 503);
      return NextResponse.json(response.data);
    } catch (error) {
      return responseError(error instanceof Error ? error.message : "The saved local evidence could not be loaded.", 503);
    }
  }

  const authorization = await authorizeScreenshotShop(parsed.data.shop_id);
  if (!authorization.available) return responseError("Authorization service is unavailable. Check the database configuration and retry.", 503);
  if (!authorization.authenticated) return responseError("Sign in to an authorized seller workspace before viewing evidence.", 401);
  if (!authorization.authorizedShop) return responseError("You are not authorized to view evidence for this shop.", 403);
  const { data: row, error: readError } = await authorization.db.from("payment_evidence")
    .select("id,shop_id,order_id,storage_object_path,sha256,extracted,seller_reviewed,status,created_by,created_at,updated_at,revision")
    .eq("shop_id", parsed.data.shop_id).eq("id", parsed.data.evidence_id).maybeSingle();
  if (readError) return responseError(missingSchema(readError) ? missingEvidenceSetupMessage() : "The saved hosted evidence could not be loaded.", 503);
  if (!row) return responseError("This payment evidence is no longer available in this shop.", 404);
  const evidence = paymentEvidenceReadbackSchema.safeParse(row);
  if (!evidence.success) return responseError("The saved hosted evidence returned unsupported review data.", 503);
  const context = await loadScreenshotMatchContext(authorization.db, parsed.data.shop_id, evidence.data.id);
  if (!context.ok) return responseError(context.message, 503);
  const matched = matchScreenshotOrders(context.context.orders, evidence.data.seller_reviewed, context.context.existing, evidence.data.sha256);
  const response = paymentEvidenceResumeResponseSchema.safeParse({
    evidence: evidence.data, ...matched, image_sha256: evidence.data.sha256,
    evidence_schema_available: context.context.evidenceSchemaAvailable, verification_available: false,
    message: "Saved hosted evidence and authorized candidates were loaded. Payment verification is not available in this hosted workflow.",
  });
  if (!response.success) return responseError("The saved hosted evidence returned unsupported review data.", 503);
  return NextResponse.json(response.data);
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    const body = await readBoundedRequestBody(request);
    form = await new Request(request.url, { method: "POST", headers: request.headers, body }).formData();
  } catch (error) {
    if (error instanceof RequestTooLargeError) return responseError("The evidence request is too large.", 413);
    return responseError("Send a multipart request with an image and review payload.", 400);
  }
  const rawPayload = form.get("payload");
  if (typeof rawPayload !== "string") return responseError("The review payload is missing.", 400);
  let payload: unknown;
  try { payload = JSON.parse(rawPayload) as unknown; } catch { return responseError("The review payload is not valid JSON.", 400); }
  const parsed = paymentEvidenceSaveSchema.safeParse(payload);
  if (!parsed.success) return responseError("Review every extracted field before saving pending evidence or rejecting it.", 400);
  const rawFile = form.get("file");
  const hasFile = rawFile && typeof rawFile !== "string" && "arrayBuffer" in rawFile && typeof rawFile.arrayBuffer === "function";

  let image: { bytes: Uint8Array; mime: string; sha256: string } | null = null;
  if (hasFile) {
    try {
      image = validateImageBytes(new Uint8Array(await rawFile.arrayBuffer()), "type" in rawFile && typeof rawFile.type === "string" ? rawFile.type : "");
    } catch (error) {
      return responseError(error instanceof ImageValidationError ? error.message : "The image could not be read safely.", 400);
    }
  }

  const localAuthorization = await authorizeLocalScreenshotShop(parsed.data.shop_id);
  if (localAuthorization.sessionPresent) {
    if (!localAuthorization.authorizedShop && parsed.data.order_id) {
      const db = getDb();
      const orderRow = db.prepare("SELECT shop_id FROM orders WHERE id = ?").get(parsed.data.order_id) as { shop_id: string } | undefined;
      if (orderRow) {
        const { verifyShopMembership } = await import("@/lib/auth/session");
        if (verifyShopMembership(localAuthorization.userId, orderRow.shop_id).authorized) {
          localAuthorization.authorizedShop = true;
          parsed.data.shop_id = orderRow.shop_id;
        }
      }
    }
    if (!localAuthorization.authorizedShop) return responseError("You are not authorized to save evidence for this shop.", 403);

    if (!image) {
      const db = getDb();
      const existing = db.prepare("SELECT id, image_data, image_sha256 FROM payment_evidence WHERE id = ? AND shop_id = ?").get(parsed.data.evidence_id, parsed.data.shop_id) as { id: string; image_data: string | null; image_sha256: string | null } | undefined;
      if (!existing) {
        return responseError("Choose exactly one original local JPEG, PNG, or WebP image.", 400);
      }
    }

    try {
      savePaymentEvidenceRecord(parsed.data.shop_id, {
        id: parsed.data.evidence_id,
        order_id: parsed.data.order_id,
        status: parsed.data.status,
        image_data: image ? Buffer.from(image.bytes).toString("base64") : null,
        image_sha256: image ? image.sha256 : null,
        extracted: parsed.data.extraction,
        seller_reviewed: parsed.data.seller_reviewed,
        expected_revision: parsed.data.expected_revision,
      }, localAuthorization.userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The local evidence review could not be saved.";
      const status = /unauthorized/i.test(message) ? 403 : /changed|different private evidence|immutable|revision|already/i.test(message) ? 409 : /database|disk|sqlite/i.test(message) ? 503 : 400;
      return responseError(message, status);
    }
    let readback;
    try { readback = getLocalPaymentEvidenceReadback(parsed.data.shop_id, parsed.data.evidence_id, localAuthorization.userId); }
    catch { return responseError("The local evidence save completed without a valid readback. Reload evidence before retrying.", 503); }
    if (!readback) return responseError("The local evidence save completed without a readback. Reload evidence before retrying.", 503);
    return NextResponse.json({
      evidence: readback,
      verification_available: true,
      message: parsed.data.status === "pending_review" ? "Evidence saved as pending review and read back. No payment status was changed." : "Evidence was rejected and recorded for audit. No payment status was changed.",
    });
  }

  const authorization = await authorizeScreenshotShop(parsed.data.shop_id);
  if (!authorization.available) return responseError("Authorization service is unavailable. Check the database configuration and retry.", 503);
  if (!authorization.authenticated) return responseError("Sign in to an authorized seller workspace before saving evidence.", 401);
  if (!authorization.authorizedShop) return responseError("You are not authorized to save evidence for this shop.", 403);

  const { db } = authorization;
  const { error: schemaProbeError } = await db.from("payment_evidence").select("id").eq("shop_id", parsed.data.shop_id).limit(1);
  if (schemaProbeError) return responseError(missingSchema(schemaProbeError) ? missingEvidenceSetupMessage() : "Evidence persistence could not be checked. No image was saved; retry when the database is available.", 503);

  if (parsed.data.order_id) {
    const { data: order, error: orderError } = await db.from("orders").select("id,shop_id,order_status,payment_status").eq("shop_id", parsed.data.shop_id).eq("id", parsed.data.order_id).maybeSingle();
    if (orderError) return responseError("The selected order could not be checked. No evidence was saved; retry when the database is available.", 503);
    if (!order) return responseError("The selected order is not in this shop.", 403);
    if (order.order_status !== "confirmed" || !["unpaid", "partially_paid"].includes(order.payment_status)) return responseError("Only confirmed orders that are still unpaid or partially paid can receive pending evidence review.", 409);
  }

  const { data: existing, error: existingError } = await db.from("payment_evidence").select("id,shop_id,storage_object_path,sha256").eq("shop_id", parsed.data.shop_id).eq("id", parsed.data.evidence_id).maybeSingle();
  if (existingError) return responseError("The stable evidence ID could not be checked. No image was saved; retry safely.", 503);
  if (!image && !existing) return responseError("Choose exactly one original local JPEG, PNG, or WebP image.", 400);

  const ext = image ? (image.mime.split("/")[1] === "jpeg" ? "jpg" : image.mime.split("/")[1]) : "png";
  const storageObjectPath = image ? `${parsed.data.shop_id}/${parsed.data.evidence_id}/${image.sha256}.${ext}` : (existing?.storage_object_path ?? "");
  const sha256 = image ? image.sha256 : (existing?.sha256 ?? "");

  if (existing && image && (existing.storage_object_path !== storageObjectPath || existing.sha256 !== image.sha256)) return responseError("This evidence ID belongs to different private evidence. Start a new review instead of overwriting it.", 409);

  if (!existing && image) {
    const { error: uploadError } = await db.storage.from("payment-evidence").upload(storageObjectPath, Buffer.from(image.bytes), {
      contentType: image.mime,
      upsert: false,
    });
    if (uploadError && !/already exists|duplicate|conflict/i.test(uploadError.message ?? "")) {
      return responseError(missingSchema(uploadError) ? missingEvidenceSetupMessage() : "The private evidence upload did not complete. No review record was saved; retry when the connection is available.", 503);
    }
  }

  const rpcInput = {
    ...parsed.data,
    storage_object_path: storageObjectPath,
    sha256,
  };
  const { data: savedId, error: saveError } = await db.rpc("save_payment_evidence_review", { p_input: rpcInput });
  if (saveError) {
    if (isMissingEvidenceSchema(saveError)) return responseError(missingEvidenceSetupMessage(), 503);
    if (saveError.code === "40001") return responseError("This evidence review changed in another session. Reload it before retrying.", 409);
    if (saveError.code === "42501") return responseError("You are not authorized to save evidence for this shop or order.", 403);
    return responseError("The private image was received, but the review record was not saved. A private orphan may need administrator cleanup; retry with the same evidence ID when ready.", 503);
  }
  const evidenceId = typeof savedId === "string" ? savedId : parsed.data.evidence_id;
  const { data: readback, error: readbackError } = await db.from("payment_evidence").select("id,shop_id,order_id,storage_object_path,sha256,extracted,seller_reviewed,status,created_by,created_at,updated_at,revision").eq("shop_id", parsed.data.shop_id).eq("id", evidenceId).single();
  const validReadback = paymentEvidenceReadbackSchema.safeParse(readback);
  if (readbackError || !validReadback.success) return responseError("The review save completed without a valid readback. Reload evidence before retrying to avoid a duplicate.", 503);
  return NextResponse.json({ evidence: validReadback.data, message: parsed.data.status === "pending_review" ? "Evidence saved as pending review. No payment status was changed." : "Evidence was rejected and recorded for audit. No payment status was changed." });
}
