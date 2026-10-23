import {
  orderDetailsSchema,
  screenshotExtractionSchema,
} from "@ocean/contracts";
import { type ExistingPaymentEvidence, type MatchableOrder } from "@ocean/core";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentSession, verifyShopMembership, getUserAuthorizedShops } from "@/lib/auth/session";
import { completeMatchScope, MATCH_CONTEXT_LIMIT } from "./screenshot-scope";

export type ScreenshotDbClient = Awaited<ReturnType<typeof createClient>>;

export type AuthorizationResult =
  | { available: false; db?: undefined; userId?: undefined }
  | { available: true; authenticated: false; db: ScreenshotDbClient; userId?: undefined; authorizedShop?: false }
  | { available: true; authenticated: true; authorizedShop: boolean; db: ScreenshotDbClient; userId: string };

export type LocalScreenshotAuthorization =
  | { sessionPresent: false }
  | { sessionPresent: true; authorizedShop: boolean; userId: string };

export async function authorizeLocalScreenshotShop(shopId: string): Promise<LocalScreenshotAuthorization> {
  const session = await getCurrentSession();
  if (!session) return { sessionPresent: false };
  const directMembership = verifyShopMembership(session.userId, shopId);
  if (directMembership.authorized) {
    return {
      sessionPresent: true,
      authorizedShop: true,
      userId: session.userId,
    };
  }
  const shops = getUserAuthorizedShops(session.userId);
  return {
    sessionPresent: true,
    authorizedShop: shops.length > 0,
    userId: session.userId,
  };
}


export async function authorizeScreenshotShop(shopId: string): Promise<AuthorizationResult> {
  if (!isSupabaseConfigured()) return { available: false };
  try {
    const db = await createClient();
    const { data: auth } = await db.auth.getClaims();
    const userId = auth?.claims?.sub;
    if (typeof userId !== "string") return { available: true, authenticated: false, db };
    const { data: membership, error } = await db
      .from("shop_memberships")
      .select("shop_id")
      .eq("shop_id", shopId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { available: false };
    return { available: true, authenticated: true, authorizedShop: Boolean(membership), db, userId };
  } catch {
    return { available: false };
  }
}

export function isMissingEvidenceSchema(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST202" || error.code === "PGRST205" || /payment_evidence|relation .* does not exist|function .*save_payment_evidence/i.test(error.message ?? "")));
}

type MatchContext = {
  orders: MatchableOrder[];
  existing: ExistingPaymentEvidence[];
  evidenceSchemaAvailable: boolean;
};

const orderSelection = "*, customers(name, phone), order_items(*)";

export async function loadScreenshotMatchContext(
  db: ScreenshotDbClient,
  shopId: string,
  excludedEvidenceId?: string,
): Promise<{ ok: true; context: MatchContext } | { ok: false; message: string }> {
  const { data: orderRows, error: orderError } = await db
    .from("orders")
    .select(orderSelection)
    .eq("shop_id", shopId)
    .order("updated_at", { ascending: false })
    .limit(MATCH_CONTEXT_LIMIT + 1);
  if (orderError) return { ok: false, message: "Authorized orders could not be loaded for matching. Check the database connection and retry." };
  const orderScope = completeMatchScope(orderRows);
  if (!orderScope.complete) return { ok: false, message: `Matching is unavailable because this shop has more than ${MATCH_CONTEXT_LIMIT} orders. The complete shop scope could not be checked safely, so no candidate or payment decision was made.` };
  const orders: MatchableOrder[] = [];
  for (const row of orderScope.rows) {
    const parsed = orderDetailsSchema.safeParse(row);
    if (!parsed.success) return { ok: false, message: "An authorized order has unsupported data, so matching was stopped without a payment decision." };
    orders.push({
      id: parsed.data.id,
      customer_name: parsed.data.customers?.name ?? null,
      customer_phone: parsed.data.customers?.phone ?? null,
      total_mmk: parsed.data.total_mmk,
      order_status: parsed.data.order_status,
      payment_status: parsed.data.payment_status,
      fulfillment_status: parsed.data.fulfillment_status,
    });
  }

  const { data: evidenceRows, error: evidenceError } = await db
    .from("payment_evidence")
    .select("id,sha256,status,seller_reviewed")
    .eq("shop_id", shopId)
    .limit(MATCH_CONTEXT_LIMIT + 1);
  if (evidenceError && !isMissingEvidenceSchema(evidenceError)) return { ok: false, message: "Same-shop evidence could not be checked. No payment decision was made; retry after the connection is available." };
  const filteredEvidenceRows = excludedEvidenceId ? (evidenceRows ?? []).filter(row => row.id !== excludedEvidenceId) : evidenceRows;
  const evidenceScope = completeMatchScope(filteredEvidenceRows);
  if (!evidenceError && !evidenceScope.complete) return { ok: false, message: `Matching is unavailable because this shop has more than ${MATCH_CONTEXT_LIMIT} evidence records. The complete duplicate scope could not be checked safely, so no candidate or payment decision was made.` };
  const existing: ExistingPaymentEvidence[] = [];
  for (const row of (!evidenceError && evidenceScope.complete ? evidenceScope.rows : [])) {
    const parsed = screenshotExtractionSchema.safeParse(row.seller_reviewed);
    if (!parsed.success || !["pending_review", "rejected", "verified"].includes(row.status)) return { ok: false, message: "A same-shop evidence record has unsupported review data, so duplicate checking was stopped without a payment decision." };
    existing.push({ id: row.id, sha256: typeof row.sha256 === "string" ? row.sha256 : null, status: row.status as ExistingPaymentEvidence["status"], seller_reviewed: parsed.data });
  }
  return { ok: true, context: { orders, existing, evidenceSchemaAvailable: !evidenceError } };
}

export function missingEvidenceSetupMessage() {
  return "Pending evidence review is not installed in this database. Apply the unapplied Milestone 2B.3 migration and private storage bucket policies, then retry.";
}
