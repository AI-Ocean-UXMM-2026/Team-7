import {
  screenshotAnalyzeRequestSchema,
  screenshotExtractionSchema,
  type ScreenshotExtraction,
} from "@ocean/contracts";
import { matchScreenshotOrders } from "@ocean/core";
import { NextResponse } from "next/server";
import { reserveProviderUsage, MAX_PROVIDER_OUTPUT_BYTES, MAX_PROVIDER_OUTPUT_TOKENS } from "../chat-to-order/guard";
import { authorizeLocalScreenshotShop, authorizeScreenshotShop, loadScreenshotMatchContext } from "@/lib/ai/screenshot-server";
import { matchScreenshot } from "@/lib/db/repository";
import {
  ImageValidationError,
  RequestTooLargeError,
  imageDataUrl,
  readBoundedRequestBody,
  validateImageBytes,
} from "./image";
import { normalizeVisionExtraction } from "./normalize-extraction";

export const runtime = "nodejs";

const emptyExtraction: ScreenshotExtraction = {
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
};

const visionPrompt = `You extract payment-transfer details from a seller-provided screenshot for review.
Recognize Myanmar mobile wallets and bank transfer receipts:
1. A+ Wallet / A+ Pay: Purple theme, stylized "A+" logo, green checkmark. Payer is the top card above the arrow. Payee is the card below the down arrow (↓). Reference is labeled "Transaction ID". Date/time appears near top right (e.g. "03 Dec 2024, 01:02:31"). Provider is "A+ Pay".
2. KBZ Bank / KBZPay E-Receipt: Red triangle KBZ Bank logo, blue "KBZPay" badge at footer. Negative amount (e.g. "-62,400.00 Ks") indicates sent funds; report positive whole integer (62400). Reference is labeled "Transaction No" (preserving leading zeros). "Transfer To: Name (******1234)" contains payee_name ("Name") and payee_account ("******1234"). Date format is DD/MM/YYYY HH:MM:SS. Provider is "KBZPay".
3. WavePay: Yellow background / yellow screen, blue "_ks" icon, "Successful". Amount in Ks. "To: Name Phone" is payee_name and payee_account. Reference is labeled "Transaction ID". Date & time e.g. "18 April 2024 • 3:06 PM". Provider is "WavePay".
4. AYA Pay E-Receipt: Red curved logo, "AYA Pay", "SUCCESS" icon. Reference is labeled "Transaction Code". "Sender Name" / "Sender Phone" are payer. "Receiver Name" / "Receiver Phone" are payee_name and payee_account. Date and time e.g. "1 October 2026, 3:16 PM". Provider is "AYA Pay".
5. CB Pay, uabpay, OK$, and other Myanmar banks: Read printed labels and arrows for payer/payee.

Rules:
- Distinguish the receipt's printed transaction date from the phone status bar clock at the very top.
- Read the transaction reference exactly as printed, preserving leading zeros.
- A leading minus sign indicates outgoing transfer; report its absolute whole-MMK amount.
- For outgoing transfers, the displayed recipient is the payee; leave payer_name null unless a sender is visibly named.
- Return the visibly printed recipient account or phone (including masking) as payee_account; never complete masked digits.
- Ignore decorative text, fees, QR codes, battery/wifi icons, and phone status bars.
- A success label or QR code is not proof of received funds or image authenticity.
- Convert date to YYYY-MM-DD. Convert time to 24-hour HH:MM or HH:MM:SS.

Return JSON only with exactly these keys:
{
  "amount_mmk": number | null,
  "transaction_reference": string | null,
  "provider": string | null,
  "transaction_date": string | null,
  "transaction_time": string | null,
  "transaction_time_uncertain": boolean,
  "payer_name": string | null,
  "payee_name": string | null,
  "payee_account": string | null,
  "missing_fields": string[],
  "uncertain_fields": string[]
}
Use null for every unreadable or absent field. Never invent or guess missing numbers or names.`;

type ProviderResponse = { choices?: Array<{ message?: { content?: unknown } }> };

class VisionProviderError extends Error {
  constructor(message: string) { super(message); }
}

function providerFailureMessage(error: unknown) {
  if (error instanceof VisionProviderError) return error.message;
  if (error instanceof Error && error.name === "AbortError") return "Image reading timed out. Try again with a smaller, clear screenshot.";
  if (error instanceof Error && error.message === "vision-provider-response-empty") return "The vision provider returned no readable fields. Try again with a clearer screenshot.";
  if (error instanceof Error && error.message === "vision-provider-response-invalid") return "The vision provider returned fields in an unsupported format. Enter only details you can read from the receipt.";
  return "The vision provider could not read this image. Check the connection or try a clearer screenshot.";
}

function providerText(payload: ProviderResponse) {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.filter((part): part is { text: string } => Boolean(part && typeof part === "object" && "text" in part && typeof part.text === "string")).map(part => part.text).join("\n");
  return null;
}

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    }
    throw new Error("vision-provider-response-invalid");
  }
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

  const localAuthorization = await authorizeLocalScreenshotShop(requestInput.data.shop_id);
  let source: "local" | "hosted";
  let localUserId: string | null = null;
  let hostedAuthorization: Awaited<ReturnType<typeof authorizeScreenshotShop>> | null = null;
  if (localAuthorization.sessionPresent) {
    if (!localAuthorization.authorizedShop) {
      const { getUserAuthorizedShops } = await import("@/lib/auth/session");
      const userShops = getUserAuthorizedShops(localAuthorization.userId);
      const activeShop = userShops.find((s) => !s.is_sample) || userShops[0];
      if (activeShop) {
        requestInput.data.shop_id = activeShop.shop_id;
        localAuthorization.authorizedShop = true;
      }
    }
    if (!localAuthorization.authorizedShop) return jsonError("You are not authorized to use screenshot matching for this shop.", 403);
    source = "local";
    localUserId = localAuthorization.userId;
  } else {
    hostedAuthorization = await authorizeScreenshotShop(requestInput.data.shop_id);
    if (!hostedAuthorization.available) return jsonError("Screenshot matching is unavailable until the seller workspace is configured.", 503);
    if (!hostedAuthorization.authenticated) return jsonError("Sign in to an authorized seller workspace before using screenshot matching.", 401);
    if (!hostedAuthorization.authorizedShop) return jsonError("You are not authorized to use screenshot matching for this shop.", 403);
    source = "hosted";
  }

  const apiKey = process.env.AI_VISION_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || process.env.AI_API_KEY?.trim();
  if (!apiKey) {
    try {
      if (source === "local") {
        const matched = matchScreenshot(requestInput.data.shop_id, emptyExtraction, image.sha256, localUserId!);
        return NextResponse.json({
          mode: "manual", extraction: emptyExtraction, ...matched, image_sha256: image.sha256,
          evidence_schema_available: true, verification_available: true,
          message: "Manual review is ready because no vision provider key is configured. The image was validated, not sent to an AI provider, and no payment decision was made. Enter readable details to refresh shop candidates.",
        });
      }
      const hostedContext = await loadScreenshotMatchContext(hostedAuthorization!.db, requestInput.data.shop_id);
      if (!hostedContext.ok) return jsonError(hostedContext.message, 503);
      const matched = matchScreenshotOrders(hostedContext.context.orders, emptyExtraction, hostedContext.context.existing, image.sha256);
      return NextResponse.json({
        mode: "manual", extraction: emptyExtraction, ...matched, image_sha256: image.sha256,
        evidence_schema_available: hostedContext.context.evidenceSchemaAvailable, verification_available: false,
        message: "Manual review is ready because no vision provider key is configured. The image was validated, not sent to an AI provider, and no payment decision was made. Enter readable details to refresh shop candidates.",
      });
    } catch {
      return jsonError("Authorized shop data could not be loaded for manual matching. No payment decision was made; retry when the database is available.", 503);
    }
  }

  const providerUserId = source === "local" ? localUserId! : hostedAuthorization!.userId;
  if (!reserveProviderUsage(`vision:${providerUserId}:${requestInput.data.shop_id}`)) return jsonError("Live screenshot matching is temporarily rate-limited. Try again later.", 429);

  const url = process.env.AI_VISION_API_URL?.trim() || "https://api.openai.com/v1/chat/completions";
  const configuredModel = process.env.AI_VISION_MODEL?.trim() || "gemini-3.5-flash-lite";
  const isGemini = URL.canParse(url) && new URL(url).hostname === "generativelanguage.googleapis.com";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);

  const modelsToTry = [configuredModel];
  if (isGemini) {
    if (configuredModel === "gemini-3.5-flash-lite") modelsToTry.push("gemini-3.5-flash");
    else if (configuredModel === "gemini-3.5-flash") modelsToTry.push("gemini-3.5-flash-lite");
  }

  try {
    let response: Response | null = null;
    let lastError: unknown = null;

    modelLoop: for (const currentModel of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          response = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: currentModel,
              temperature: 0,
              max_tokens: isGemini ? 1800 : MAX_PROVIDER_OUTPUT_TOKENS,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: visionPrompt },
                { role: "user", content: [{ type: "text", text: "Read this image only. Do not infer unreadable payment details." }, { type: "image_url", image_url: { url: imageDataUrl(image), detail: "high" } }] },
              ],
            }),
            signal: controller.signal,
            cache: "no-store",
          });
          if (response.ok) break modelLoop;
          if ((response.status === 503 || response.status === 429) && attempt === 1) {
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          }
          break;
        } catch (err) {
          lastError = err;
          if (err instanceof Error && err.name === "AbortError") throw err;
          if (attempt === 1) {
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          }
          break;
        }
      }
    }

    if (!response || !response.ok) {
      if (response?.status === 401 || response?.status === 403) throw new VisionProviderError("The vision provider rejected its API key. Check the server's vision key and provider settings.");
      if (response?.status === 429) throw new VisionProviderError("The vision provider is rate-limited or its free quota is exhausted. Try again after the quota resets.");
      if (response?.status === 400 || response?.status === 404) throw new VisionProviderError("The vision provider rejected the model or request format. Check the server's vision model and API URL.");
      if (lastError && !response) throw lastError;
      throw new VisionProviderError("The vision provider is unavailable right now. Try again later.");
    }
    const text = providerText(JSON.parse(await readBoundedProviderOutput(response)) as ProviderResponse);
    if (!text) throw new Error("vision-provider-response-empty");
    const extraction = normalizeVisionExtraction(parseJson(text));
    if (!extraction) throw new Error("vision-provider-response-invalid");
    let matched: ReturnType<typeof matchScreenshotOrders>;
    let evidenceSchemaAvailable: boolean;
    if (source === "local") {
      matched = matchScreenshot(requestInput.data.shop_id, extraction, image.sha256, localUserId!);
      evidenceSchemaAvailable = true;
    } else {
      const context = await loadScreenshotMatchContext(hostedAuthorization!.db, requestInput.data.shop_id);
      if (!context.ok) return jsonError(context.message, 503);
      matched = matchScreenshotOrders(context.context.orders, extraction, context.context.existing, image.sha256);
      evidenceSchemaAvailable = context.context.evidenceSchemaAvailable;
    }
    return NextResponse.json({
      mode: "live",
      extraction,
      ...matched,
      image_sha256: image.sha256,
      evidence_schema_available: evidenceSchemaAvailable,
      verification_available: source === "local",
      message: source === "local"
        ? "AI extracted a review draft from the local image. Correct every field, compare advisory candidates, and verify funds only against a trusted merchant or bank record."
        : evidenceSchemaAvailable
        ? "AI extracted a review draft. Compare the candidates, correct every field, and choose pending review or rejection."
        : "AI extracted a review draft. Evidence persistence is not installed yet, so no image can be saved.",
    });
  } catch (error) {
    try {
      const matched = source === "local"
        ? matchScreenshot(requestInput.data.shop_id, emptyExtraction, image.sha256, localUserId!)
        : null;
      const hostedContext = source === "hosted" ? await loadScreenshotMatchContext(hostedAuthorization!.db, requestInput.data.shop_id) : null;
      if (hostedContext && !hostedContext.ok) return jsonError(hostedContext.message, 503);
      const manualMatch = matched ?? matchScreenshotOrders(hostedContext!.context.orders, emptyExtraction, hostedContext!.context.existing, image.sha256);
      return NextResponse.json({
        mode: "manual",
        extraction: emptyExtraction,
        ...manualMatch,
        image_sha256: image.sha256,
        evidence_schema_available: source === "local" ? true : hostedContext!.context.evidenceSchemaAvailable,
        verification_available: source === "local",
        message: `${providerFailureMessage(error)} No fields were accepted and no payment decision was made.`,
      });
    } catch {
      return NextResponse.json({
        mode: "error",
        extraction: emptyExtraction,
        candidates: [],
        duplicate_warnings: [],
        image_sha256: image.sha256,
        evidence_schema_available: false,
        verification_available: source === "local",
        error: "The vision provider and authorized order data are unavailable. No extraction or payment decision was saved; retry when the connection is available.",
      }, { status: 503 });
    }
  } finally {
    clearTimeout(timeout);
  }
}
