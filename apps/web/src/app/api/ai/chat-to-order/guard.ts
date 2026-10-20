export const MAX_PROVIDER_CHAT_CHARACTERS = 12_000;
export const MAX_PROVIDER_REQUEST_BYTES = 100_000;
export const MAX_PROVIDER_OUTPUT_BYTES = 48_000;
export const MAX_PROVIDER_OUTPUT_TOKENS = 900;
export const PROVIDER_USAGE_WINDOW_MS = 10 * 60 * 1000;
export const MAX_PROVIDER_CALLS_PER_WINDOW = 10;

type UsageEntry = { windowStartedAt: number; count: number };

const usage = new Map<string, UsageEntry>();

export type ProviderBoundaryInput = {
  chatLength: number;
  shopId?: string;
  authenticated: boolean;
  authorizedShop: boolean;
  usageAllowed: boolean;
};

export type ProviderBoundaryDecision =
  | { ok: true }
  | { ok: false; status: 400 | 401 | 403 | 413 | 429; message: string };

export function providerBoundaryDecision(input: ProviderBoundaryInput): ProviderBoundaryDecision {
  if (input.chatLength > MAX_PROVIDER_CHAT_CHARACTERS) {
    return { ok: false, status: 413, message: "Shorten the conversation before using live AI extraction." };
  }
  if (!input.shopId) {
    return { ok: false, status: 400, message: "Select an authorized shop before using live AI extraction." };
  }
  if (!input.authenticated) {
    return { ok: false, status: 401, message: "Sign in to an authorized seller workspace before using live AI extraction." };
  }
  if (!input.authorizedShop) {
    return { ok: false, status: 403, message: "You are not authorized to use live AI extraction for this shop." };
  }
  if (!input.usageAllowed) {
    return { ok: false, status: 429, message: "Live AI extraction is temporarily rate-limited. Try again later." };
  }
  return { ok: true };
}

export function reserveProviderUsage(key: string, now = Date.now()) {
  const current = usage.get(key);
  if (!current || now - current.windowStartedAt >= PROVIDER_USAGE_WINDOW_MS) {
    usage.set(key, { windowStartedAt: now, count: 1 });
    return true;
  }
  if (current.count >= MAX_PROVIDER_CALLS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}
