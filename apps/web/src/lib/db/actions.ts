"use server";

import { recordPayment, savePaymentEvidenceRecord } from "./repository";
import { getCurrentSession, verifyShopMembership } from "@/lib/auth/session";

export async function recordPaymentAction(
  shopId: string,
  orderId: string,
  amountMmk: number,
  paymentMethod: string = "KBZPay",
  referenceNumber: string = ""
) {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Authentication required: Sign in to record payments.");
  }

  const membership = verifyShopMembership(session.userId, shopId);
  if (!membership.authorized) {
    throw new Error("Authorization denied: You do not have permission to record payments for this shop.");
  }

  return recordPayment(shopId, session.userId, {
    order_id: orderId,
    amount_mmk: amountMmk,
    payment_method: paymentMethod,
    reference_number: referenceNumber,
  });
}

export async function saveEvidenceAction(
  shopId: string,
  evidence: {
    id: string;
    order_id?: string | null;
    amount_mmk?: number | null;
    provider?: string | null;
    reference_number?: string | null;
    status: "pending_review" | "rejected";
    image_data?: string | null;
    image_sha256?: string | null;
    extracted?: unknown;
    seller_reviewed?: unknown;
  }
) {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Authentication required: Sign in to save evidence reviews.");
  }

  const membership = verifyShopMembership(session.userId, shopId);
  if (!membership.authorized) {
    throw new Error("Authorization denied: You do not have permission to save evidence for this shop.");
  }

  // Security constraint: Evidence reviews can only be saved as pending_review or rejected
  if (evidence.status !== "pending_review" && evidence.status !== "rejected") {
    throw new Error("Invalid evidence status: Evidence can only be recorded as pending_review or rejected.");
  }

  return savePaymentEvidenceRecord(shopId, evidence, session.userId);
}
