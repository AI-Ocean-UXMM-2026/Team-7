import { Buffer } from "node:buffer";
import {
  paymentEvidenceReadbackSchema,
  paymentEvidenceSaveSchema,
} from "@ocean/contracts";
import { NextResponse } from "next/server";
import { authorizeScreenshotShop, isMissingEvidenceSchema, missingEvidenceSetupMessage } from "@/lib/ai/screenshot-server";
import {
  ImageValidationError,
  RequestTooLargeError,
  readBoundedRequestBody,
  validateImageBytes,
} from "../ai/screenshot-to-order/image";

export const runtime = "nodejs";

function responseError(message: string, status: 400 | 401 | 403 | 409 | 413 | 503) {
  return NextResponse.json({ error: message }, { status });
}

function missingSchema(error: { code?: string; message?: string } | null | undefined) {
  return isMissingEvidenceSchema(error) || Boolean(error && /storage.*(bucket|not found)|bucket.*not found/i.test(error.message ?? ""));
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
  if (form.getAll("file").length !== 1) return responseError("Choose exactly one original local JPEG, PNG, or WebP image.", 400);
  const file = form.get("file");
  if (typeof file === "string" || !file || !("arrayBuffer" in file) || typeof file.arrayBuffer !== "function") return responseError("Choose the original local JPEG, PNG, or WebP image again.", 400);

  let image;
  try {
    image = validateImageBytes(new Uint8Array(await file.arrayBuffer()), "type" in file && typeof file.type === "string" ? file.type : "");
  } catch (error) {
    return responseError(error instanceof ImageValidationError ? error.message : "The image could not be read safely.", 400);
  }

  const authorization = await authorizeScreenshotShop(parsed.data.shop_id);
  if (!authorization.available) return responseError("Evidence persistence is unavailable until the seller workspace is configured.", 503);
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

  const storageObjectPath = `${parsed.data.shop_id}/${parsed.data.evidence_id}/${image.sha256}.${image.extension}`;
  const { data: existing, error: existingError } = await db.from("payment_evidence").select("id,shop_id,storage_object_path,sha256").eq("shop_id", parsed.data.shop_id).eq("id", parsed.data.evidence_id).maybeSingle();
  if (existingError) return responseError("The stable evidence ID could not be checked. No image was saved; retry safely.", 503);
  if (existing && (existing.storage_object_path !== storageObjectPath || existing.sha256 !== image.sha256)) return responseError("This evidence ID belongs to different private evidence. Start a new review instead of overwriting it.", 409);

  if (!existing) {
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
    sha256: image.sha256,
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
