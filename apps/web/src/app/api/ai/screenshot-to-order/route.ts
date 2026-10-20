import {
  screenshotAnalyzeRequestSchema,
  screenshotExtractionSchema,
} from "@ocean/contracts";
import { matchScreenshotOrders } from "@ocean/core";
import { NextResponse } from "next/server";
import { reserveProviderUsage, MAX_PROVIDER_OUTPUT_BYTES, MAX_PROVIDER_OUTPUT_TOKENS } from "../chat-to-order/guard";
import { authorizeScreenshotShop, loadScreenshotMatchContext } from "@/lib/ai/screenshot-server";
import {
  ImageValidationError,
  RequestTooLargeError,
  imageDataUrl,
  readBoundedRequestBody,
  validateImageBytes,
} from "./image";

export const runtime = "nodejs";

const emptyExtraction = {
  amount_mmk: null,
  transaction_reference: null,
  provider: null,
  transaction_date: null,
  transaction_time: null,
  transaction_time_uncertain: true,
  payer_name: null,
  payee_name: null,
  missing_fields: ["amount_mmk", "transaction_reference", "provider", "transaction_date", "transaction_time", "payer_name", "payee_name"],
  uncertain_fields: [],
} as const;

const visionPrompt = `You extract payment-transfer details from a seller-provided screenshot for review.
Return JSON only with exactly these keys: amount_mmk, transaction_reference, provider, transaction_date,
transaction_time, transaction_time_uncertain, payer_name, payee_name, missing_fields, uncertain_fields.
Use null for every unreadable, absent, or ambiguous field. Never infer or complete a value from context.
amount_mmk must be a whole integer MMK amount only when visibly readable. transaction_date must be YYYY-MM-DD.
transaction_time must be HH:MM or HH:MM:SS only when visible; set transaction_time_uncertain true when the
visible time is incomplete, unclear, or timezone/locale is not explicit. missing_fields lists missing paths;
uncertain_fields lists paths whose visible value needs seller review. Do not return confidence percentages.`;

type ProviderResponse = { choices?: Array<{ message?: { content?: unknown } }> };

function providerText(payload: ProviderResponse) {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.filter((part): part is { text: string } => Boolean(part && typeof part === "object" && "text" in part && typeof part.text === "string")).map(part => part.text).join("\n");
  return null;
}

function parseJson(text: string) {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "")) as unknown;
}

async function readBoundedProviderOutput(response: Response) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_OUTPUT_BYTES) throw new Error("vision-provider-response-too-large");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > MAX_PROVIDER_OUTPUT_BYTES) {
        await reader.cancel();
        throw new Error("vision-provider-response-too-large");
      }
      text += decoder.decode(next.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function jsonError(message: string, status: 400 | 413 | 401 | 403 | 429 | 503) {
  return NextResponse.json({ error: message }, { status });
}

function simulationResponse(imageSha256: string | null) {
  return NextResponse.json({
    mode: "simulation",
    extraction: emptyExtraction,
    candidates: [],
    duplicate_warnings: [],
    image_sha256: imageSha256,
    evidence_schema_available: false,
    message: "Simulation only: no server-side vision key is configured. The image was received for local validation but was not stored or sent to an AI provider; no orders were queried, and no payment decision was made.",
  });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    const body = await readBoundedRequestBody(request);
    const formRequest = new Request(request.url, { method: "POST", headers: request.headers, body });
    form = await formRequest.formData();
  } catch (error) {
    if (error instanceof RequestTooLargeError) return jsonError("The image request is too large.", 413);
    return jsonError("Send a multipart request with one local image file.", 400);
  }

  const requestInput = screenshotAnalyzeRequestSchema.safeParse({
    shop_id: form.get("shop_id"),
    evidence_id: typeof form.get("evidence_id") === "string" ? form.get("evidence_id") : undefined,
  });
  if (!requestInput.success) return jsonError("Select an authorized shop before analyzing the image.", 400);
  if (typeof form.get("image_url") === "string") return jsonError("Remote image URLs are not accepted. Choose a local JPEG, PNG, or WebP file.", 400);
  if (form.getAll("file").length !== 1) return jsonError("Choose exactly one local JPEG, PNG, or WebP image.", 400);
  const file = form.get("file");
  if (typeof file === "string" || !file || !("arrayBuffer" in file) || typeof file.arrayBuffer !== "function") return jsonError("Choose one local JPEG, PNG, or WebP image.", 400);

  let image;
  try {
    image = validateImageBytes(new Uint8Array(await file.arrayBuffer()), "type" in file && typeof file.type === "string" ? file.type : "");
  } catch (error) {
    if (error instanceof ImageValidationError) return jsonError(error.message, 400);
    return jsonError("The image could not be read safely.", 400);
  }

  const apiKey = process.env.AI_VISION_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || process.env.AI_API_KEY?.trim();
  if (!apiKey) return simulationResponse(image.sha256);

  const authorization = await authorizeScreenshotShop(requestInput.data.shop_id);
  if (!authorization.available) return jsonError("Live screenshot matching is unavailable until the seller workspace is configured.", 503);
  if (!authorization.authenticated) return jsonError("Sign in to an authorized seller workspace before using live screenshot matching.", 401);
  if (!authorization.authorizedShop) return jsonError("You are not authorized to use live screenshot matching for this shop.", 403);
  if (!reserveProviderUsage(`vision:${authorization.userId}:${requestInput.data.shop_id}`)) return jsonError("Live screenshot matching is temporarily rate-limited. Try again later.", 429);

  const url = process.env.AI_VISION_API_URL?.trim() || "https://api.openai.com/v1/chat/completions";
  const model = process.env.AI_VISION_MODEL?.trim() || "gpt-4o-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: MAX_PROVIDER_OUTPUT_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: visionPrompt },
          { role: "user", content: [{ type: "text", text: "Read this image only. Do not infer unreadable payment details." }, { type: "image_url", image_url: { url: imageDataUrl(image), detail: "low" } }] },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error("vision-provider-request-failed");
    const text = providerText(JSON.parse(await readBoundedProviderOutput(response)) as ProviderResponse);
    if (!text) throw new Error("vision-provider-response-empty");
    const extraction = screenshotExtractionSchema.safeParse(parseJson(text));
    if (!extraction.success) throw new Error("vision-provider-response-invalid");
    const context = await loadScreenshotMatchContext(authorization.db, requestInput.data.shop_id);
    if (!context.ok) return jsonError(context.message, 503);
    const matched = matchScreenshotOrders(context.context.orders, extraction.data, context.context.existing, image.sha256);
    return NextResponse.json({
      mode: "live",
      extraction: extraction.data,
      ...matched,
      image_sha256: image.sha256,
      evidence_schema_available: context.context.evidenceSchemaAvailable,
      message: context.context.evidenceSchemaAvailable
        ? "AI extracted a review draft. Compare the candidates, correct every field, and choose pending review or rejection."
        : "AI extracted a review draft. Evidence persistence is not installed yet, so no image can be saved.",
    });
  } catch {
    return NextResponse.json({
      mode: "error",
      extraction: emptyExtraction,
      candidates: [],
      duplicate_warnings: [],
      image_sha256: image.sha256,
      evidence_schema_available: false,
      error: "The vision service did not return a valid extraction. No order match or payment decision was made; retry when the provider is available.",
    }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
