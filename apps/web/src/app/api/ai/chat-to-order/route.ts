import { chatOrderExtractionSchema, chatOrderRequestSchema } from "@ocean/contracts";
import { parseSimulatedChat } from "@ocean/core";
import { NextResponse } from "next/server";
import { getCurrentSession, verifyShopMembership } from "@/lib/auth/session";
import {
  MAX_PROVIDER_CHAT_CHARACTERS,
  MAX_PROVIDER_OUTPUT_BYTES,
  MAX_PROVIDER_OUTPUT_TOKENS,
  MAX_PROVIDER_REQUEST_BYTES,
  providerBoundaryDecision,
  reserveProviderUsage,
} from "./guard";

const providerPrompt = `You are an expert order extraction AI for Myanmar social commerce sellers (Facebook Messenger, TikTok, Viber).
Extract customer orders from messy customer conversations or seller shorthand notes.
Return JSON only with exactly these keys:
- customer_name: English or Burmese name (e.g. "Aye Aye", "Daw Khin Khin", "ကိုမျိုး", "မစုစု"). Strip honorifics/greetings if separate.
- customer_phone: One or more Myanmar phone numbers (e.g. "09 777 222 111" or "09111222 / 09333444"). If multiple numbers exist, join them with " / ".
- delivery_address: Full street, township, and city in English or Burmese (e.g. "အမှတ် ၁၂၊ ဗဟိုလမ်း၊ ကမာရွတ်", "Kamayut, Yangon").
- notes: Special instructions or delivery notes if explicitly stated; use null if none (notes are optional).
- delivery_fee_mmk: Whole integer MMK if specified (e.g. delivery fee, ပို့ခ), else 0 or null.
- discount_mmk: Whole integer MMK if specified (e.g. discount, လျှော့ပေး), else 0 or null.
- items: Array of one or more items [{ product_name, quantity, unit_price_mmk }].
  * product_name: Extract ONLY the clean product name without greetings or filler words.
    NEVER include conversational words like "မင်္ဂလာပါ", "ယူမယ်", "မှာပါမယ်", "ပို့ပေးပါ", "အစ်မ", "ရမလား", "Hi", "Please", "Thanks".
  * quantity: Integer quantity. Parse English (1, 2, 3), Burmese digits (၁, ၂, ၃), or Burmese quantity words (တစ်ခု, ၂ ထည်, ၃ ဘူး). Default 1 if item clearly ordered.
  * unit_price_mmk: Whole integer MMK per unit if mentioned; use null if unstated. Never invent prices.
- missing_fields: Array of paths needing seller review (e.g. ["customer_phone"] if phone is missing).
Keep all money amounts as whole integer MMK. Return pure JSON only.`;

type ProviderResponse = {
  choices?: Array<{ message?: { content?: unknown } }>;
};

function textFromProvider(payload: ProviderResponse) {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.filter((part): part is { text: string } => Boolean(part && typeof part === "object" && "text" in part && typeof part.text === "string"))
      .map((part) => part.text).join("\n");
  }
  return null;
}

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  return JSON.parse(cleaned) as unknown;
}

function simulationResponse(chat: string, message: string) {
  return NextResponse.json({ mode: "simulation", extraction: parseSimulatedChat(chat), message });
}

class RequestTooLargeError extends Error {}

async function readBoundedText(input: Request | Response, maxBytes: number) {
  const declaredLength = Number(input.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new RequestTooLargeError();
  const body = input.body;
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new RequestTooLargeError();
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function readJsonBody(request: Request) {
  const text = await readBoundedText(request, MAX_PROVIDER_REQUEST_BYTES);
  return JSON.parse(text) as unknown;
}

async function authorizeShop(shopId: string) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return { available: true as const, authenticated: false as const, authorizedShop: false as const };
    }
    const membership = verifyShopMembership(session.userId, shopId);
    if (!membership.authorized) {
      return { available: true as const, authenticated: true as const, authorizedShop: false as const, userId: session.userId };
    }
    return { available: true as const, authenticated: true as const, authorizedShop: true as const, userId: session.userId };
  } catch {
    return { available: false as const };
  }
}

function boundaryError(decision: Exclude<ReturnType<typeof providerBoundaryDecision>, { ok: true }>) {
  return NextResponse.json({ error: decision.message }, { status: decision.status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    if (error instanceof RequestTooLargeError) return NextResponse.json({ error: "The request is too large." }, { status: 413 });
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
  }

  const parsed = chatOrderRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Chat text must be between 1 and 20,000 characters." }, { status: 400 });

  if (parsed.data.chat.length > MAX_PROVIDER_CHAT_CHARACTERS) {
    return boundaryError(providerBoundaryDecision({
      chatLength: parsed.data.chat.length,
      shopId: parsed.data.shop_id,
      authenticated: false,
      authorizedShop: false,
      usageAllowed: true,
    }) as Exclude<ReturnType<typeof providerBoundaryDecision>, { ok: true }>);
  }

  if (!parsed.data.shop_id) {
    return boundaryError(providerBoundaryDecision({
      chatLength: parsed.data.chat.length,
      authenticated: false,
      authorizedShop: false,
      usageAllowed: true,
    }) as Exclude<ReturnType<typeof providerBoundaryDecision>, { ok: true }>);
  }

  const authorization = await authorizeShop(parsed.data.shop_id);
  if (!authorization.available) return NextResponse.json({ error: "Live AI extraction is unavailable until the seller workspace is configured." }, { status: 503 });
  const preliminary = providerBoundaryDecision({
    chatLength: parsed.data.chat.length,
    shopId: parsed.data.shop_id,
    authenticated: authorization.authenticated,
    authorizedShop: authorization.authenticated && authorization.authorizedShop,
    usageAllowed: true,
  });
  if (!preliminary.ok) return boundaryError(preliminary);

  const apiKey = process.env.AI_CHAT_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || process.env.AI_API_KEY?.trim();
  if (!apiKey) return simulationResponse(parsed.data.chat, "Simulation mode: no server-side AI key is configured. Review every extracted field.");
  if (!reserveProviderUsage(`${authorization.userId}:${parsed.data.shop_id}`)) {
    return boundaryError(providerBoundaryDecision({
      chatLength: parsed.data.chat.length,
      shopId: parsed.data.shop_id,
      authenticated: true,
      authorizedShop: true,
      usageAllowed: false,
    }) as Exclude<ReturnType<typeof providerBoundaryDecision>, { ok: true }>);
  }

  const url = process.env.AI_CHAT_API_URL?.trim() || "https://api.openai.com/v1/chat/completions";
  const model = process.env.AI_CHAT_MODEL?.trim() || "gpt-4o-mini";
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
          { role: "system", content: providerPrompt },
          { role: "user", content: parsed.data.chat },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error("provider-request-failed");
    const payload = JSON.parse(await readBoundedText(response, MAX_PROVIDER_OUTPUT_BYTES)) as ProviderResponse;
    const text = textFromProvider(payload);
    if (!text) throw new Error("provider-response-empty");
    const extraction = chatOrderExtractionSchema.safeParse(parseJson(text));
    if (!extraction.success) throw new Error("provider-response-invalid");
    return NextResponse.json({ mode: "live", extraction: extraction.data, message: "AI extraction complete. Review every field before saving." });
  } catch {
    return NextResponse.json({
      mode: "error",
      fallback: parseSimulatedChat(parsed.data.chat),
      error: "The AI service did not return a valid order. A clearly marked simulation is shown for review; no order was saved.",
    }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
