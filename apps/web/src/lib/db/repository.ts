import {
  calculateOrderTotals,
  expenseSchema,
  orderDetailsSchema,
  orderItemSchema,
  localPaymentEvidenceReadbackSchema,
  screenshotExtractionSchema,
  uuidSchema,
  type Expense,
  type ExpenseInput,
  type OrderDetails,
  type SaveOrderInput,
  type ScreenshotExtraction,
} from "@ocean/contracts";
import {
  matchScreenshotOrders,
  type ExistingPaymentEvidence,
  type MatchableOrder,
} from "@ocean/core";
import { getDb, LIVE_SHOP_ID, SAMPLE_SHOP_ID, DEFAULT_SHOP_ID, DEFAULT_USER_ID, STAFF_USER_ID } from "./sqlite.ts";
import { verifyShopMembership } from "../auth/token.ts";

export { LIVE_SHOP_ID, SAMPLE_SHOP_ID, DEFAULT_SHOP_ID, DEFAULT_USER_ID, STAFF_USER_ID };

export function getShop(shopId?: string) {
  const db = getDb();
  const targetId = shopId || DEFAULT_SHOP_ID;
  const shop = db.prepare("SELECT id, name, currency, is_sample FROM shops WHERE id = ?").get(targetId) as
    | { id: string; name: string; currency: string; is_sample: number }
    | undefined;
  return shop
    ? { id: shop.id, name: shop.name, currency: shop.currency, is_sample: Boolean(shop.is_sample) }
    : { id: DEFAULT_SHOP_ID, name: "May Thu's Boutique", currency: "MMK", is_sample: false };
}

export function listShops(userId?: string) {
  const db = getDb();
  if (userId && uuidSchema.safeParse(userId).success) {
    return db.prepare(`
      SELECT s.id, s.name, s.currency, s.is_sample
      FROM shops s
      JOIN shop_memberships sm ON s.id = sm.shop_id
      WHERE sm.user_id = ?
      ORDER BY s.is_sample ASC, (SELECT COUNT(*) FROM orders o WHERE o.shop_id = s.id) DESC, s.created_at ASC
    `).all(userId) as Array<{
      id: string;
      name: string;
      currency: string;
      is_sample: number;
    }>;
  }
  return db.prepare("SELECT id, name, currency, is_sample FROM shops ORDER BY is_sample ASC, (SELECT COUNT(*) FROM orders o WHERE o.shop_id = id) DESC, created_at ASC").all() as Array<{
    id: string;
    name: string;
    currency: string;
    is_sample: number;
  }>;
}

/**
 * Retrieve shop orders. Enforces membership verification when userId is provided.
 */
export function getOrders(shopId: string, query?: string, userId?: string): OrderDetails[] {
  if (userId) {
    const membership = verifyShopMembership(userId, shopId);
    if (!membership.authorized) {
      throw new Error(`Unauthorized: User does not have access to shop ${shopId}.`);
    }
  }

  const db = getDb();
  const sql = `
    SELECT o.*,
           c.name as customer_name,
           c.phone as customer_phone
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.shop_id = ?
    ORDER BY o.created_at DESC
    LIMIT 200
  `;
  const rows = db.prepare(sql).all(shopId) as Array<{
    id: string;
    shop_id: string;
    customer_id: string | null;
    order_status: "draft" | "confirmed" | "cancelled";
    payment_status: "unpaid" | "partially_paid" | "paid" | "refunded";
    fulfillment_status: "unfulfilled" | "processing" | "shipped" | "delivered" | "cancelled";
    subtotal_mmk: number;
    delivery_fee_mmk: number;
    discount_mmk: number;
    total_mmk: number;
    delivery_address: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    customer_name: string | null;
    customer_phone: string | null;
  }>;

  const itemStmt = db.prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC");

  const results: OrderDetails[] = [];
  for (const row of rows) {
    const items = itemStmt.all(row.id) as Array<{
      id: string;
      shop_id: string;
      order_id: string;
      product_name: string;
      quantity: number;
      unit_price_mmk: number;
      line_total_mmk: number;
      created_at: string;
    }>;

    const parsed = orderDetailsSchema.safeParse({
      id: row.id,
      shop_id: row.shop_id,
      customer_id: row.customer_id,
      order_status: row.order_status,
      payment_status: row.payment_status,
      fulfillment_status: row.fulfillment_status,
      subtotal_mmk: row.subtotal_mmk,
      delivery_fee_mmk: row.delivery_fee_mmk,
      discount_mmk: row.discount_mmk,
      total_mmk: row.total_mmk,
      delivery_address: row.delivery_address,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      customers: row.customer_name ? { name: row.customer_name, phone: row.customer_phone } : null,
      order_items: items.map((i) => orderItemSchema.parse(i)),
    });

    if (parsed.success) {
      if (!query || JSON.stringify(parsed.data).toLowerCase().includes(query.toLowerCase())) {
        results.push(parsed.data);
      }
    }
  }

  return results;
}

export function getOrder(shopId: string, orderId: string, userId?: string): OrderDetails | null {
  const orders = getOrders(shopId, undefined, userId);
  return orders.find((o) => o.id === orderId) ?? null;
}

export interface SaveOrderOptions {
  userId?: string;
  originalExtraction?: unknown;
  sellerCorrections?: unknown;
}

/**
 * Save an order with authorization check, deterministic MMK calculations, and revision history.
 */
export function saveOrder(input: SaveOrderInput, options?: SaveOrderOptions): OrderDetails {
  if (options?.userId) {
    const membership = verifyShopMembership(options.userId, input.shop_id);
    if (!membership.authorized) {
      throw new Error(`Unauthorized: User does not have permission to save orders in shop ${input.shop_id}.`);
    }
  }

  const db = getDb();
  const now = new Date().toISOString();

  // 1. Calculate totals deterministically with integer MMK
  const totals = calculateOrderTotals(input.items, input.delivery_fee_mmk, input.discount_mmk);

  // 2. Customer resolution or creation
  let customerId: string | null = null;
  if (input.customer_name && input.customer_name.trim()) {
    const existingCustomer = db.prepare(
      "SELECT id FROM customers WHERE shop_id = ? AND name = ? LIMIT 1"
    ).get(input.shop_id, input.customer_name.trim()) as { id: string } | undefined;

    if (existingCustomer) {
      customerId = existingCustomer.id;
      db.prepare(`
        UPDATE customers
        SET phone = COALESCE(?, phone),
            address = COALESCE(?, address),
            updated_at = ?
        WHERE id = ?
      `).run(input.customer_phone ?? null, input.delivery_address ?? null, now, customerId);
    } else {
      customerId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO customers (id, shop_id, name, phone, address, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(customerId, input.shop_id, input.customer_name.trim(), input.customer_phone ?? null, input.delivery_address ?? null, null, now, now);
    }
  }

  // Check if order exists to preserve payment_status and created_at
  const existingOrder = db.prepare("SELECT * FROM orders WHERE id = ?").get(input.id) as
    | { created_at: string; payment_status: string; shop_id: string }
    | undefined;

  if (existingOrder && existingOrder.shop_id !== input.shop_id) {
    throw new Error("Cannot reassign an existing order to a different shop.");
  }

  const paymentStatus = existingOrder ? existingOrder.payment_status : "unpaid";
  const createdAt = existingOrder ? existingOrder.created_at : now;

  // 3. Upsert order
  db.prepare(`
    INSERT INTO orders (
      id, shop_id, customer_id, order_status, payment_status, fulfillment_status,
      subtotal_mmk, delivery_fee_mmk, discount_mmk, total_mmk,
      delivery_address, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      customer_id = excluded.customer_id,
      order_status = excluded.order_status,
      fulfillment_status = excluded.fulfillment_status,
      subtotal_mmk = excluded.subtotal_mmk,
      delivery_fee_mmk = excluded.delivery_fee_mmk,
      discount_mmk = excluded.discount_mmk,
      total_mmk = excluded.total_mmk,
      delivery_address = excluded.delivery_address,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `).run(
    input.id,
    input.shop_id,
    customerId,
    input.order_status,
    paymentStatus,
    input.fulfillment_status,
    totals.subtotal_mmk,
    input.delivery_fee_mmk,
    input.discount_mmk,
    totals.total_mmk,
    input.delivery_address ?? null,
    input.notes ?? null,
    createdAt,
    now
  );

  // 4. Replace items
  db.prepare("DELETE FROM order_items WHERE order_id = ?").run(input.id);
  const insertItemStmt = db.prepare(`
    INSERT INTO order_items (id, shop_id, order_id, product_name, quantity, unit_price_mmk, line_total_mmk, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const createdItems = input.items.map((item) => {
    const itemId = crypto.randomUUID();
    const lineTotal = item.quantity * item.unit_price_mmk;
    insertItemStmt.run(
      itemId,
      input.shop_id,
      input.id,
      item.product_name,
      item.quantity,
      item.unit_price_mmk,
      lineTotal,
      now
    );
    return {
      id: itemId,
      shop_id: input.shop_id,
      order_id: input.id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price_mmk: item.unit_price_mmk,
      line_total_mmk: lineTotal,
      created_at: now,
    };
  });

  // 5. Record revision preserving original extraction separately from seller corrections
  const revCount = (db.prepare("SELECT COUNT(*) as count FROM order_revisions WHERE order_id = ?").get(input.id) as { count: number }).count;
  const revisionSnapshot = {
    input,
    totals,
    original_extraction: options?.originalExtraction ?? null,
    seller_corrections: options?.sellerCorrections ?? null,
    saved_by: options?.userId ?? null,
    saved_at: now,
  };

  db.prepare(`
    INSERT INTO order_revisions (id, order_id, revision_number, snapshot, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), input.id, revCount + 1, JSON.stringify(revisionSnapshot), now);

  return orderDetailsSchema.parse({
    id: input.id,
    shop_id: input.shop_id,
    customer_id: customerId,
    order_status: input.order_status,
    payment_status: paymentStatus as "unpaid" | "partially_paid" | "paid" | "refunded",
    fulfillment_status: input.fulfillment_status,
    subtotal_mmk: totals.subtotal_mmk,
    delivery_fee_mmk: input.delivery_fee_mmk,
    discount_mmk: input.discount_mmk,
    total_mmk: totals.total_mmk,
    delivery_address: input.delivery_address ?? null,
    notes: input.notes ?? null,
    created_at: createdAt,
    updated_at: now,
    customers: input.customer_name ? { name: input.customer_name, phone: input.customer_phone ?? null } : null,
    order_items: createdItems,
  });
}

export function getExpenses(shopId: string, userId?: string): Expense[] {
  if (userId) {
    const membership = verifyShopMembership(userId, shopId);
    if (!membership.authorized) {
      throw new Error(`Unauthorized: User does not have access to expenses in shop ${shopId}.`);
    }
  }

  const db = getDb();
  const rows = db.prepare("SELECT * FROM expenses WHERE shop_id = ? ORDER BY expense_date DESC, created_at DESC").all(shopId);
  return rows.map((r) => expenseSchema.parse(r));
}

export function saveExpense(shopId: string, input: ExpenseInput, id?: string, userId?: string): Expense {
  if (userId) {
    const membership = verifyShopMembership(userId, shopId);
    if (!membership.authorized) {
      throw new Error(`Unauthorized: User cannot save expenses in shop ${shopId}.`);
    }
  }

  const db = getDb();
  const now = new Date().toISOString();
  const targetId = id || crypto.randomUUID();

  db.prepare(`
    INSERT INTO expenses (id, shop_id, description, amount_mmk, category, expense_date, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      description = excluded.description,
      amount_mmk = excluded.amount_mmk,
      category = excluded.category,
      expense_date = excluded.expense_date,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `).run(
    targetId,
    shopId,
    input.description,
    input.amount_mmk,
    input.category,
    input.expense_date,
    input.notes ?? null,
    now,
    now
  );

  const row = db.prepare("SELECT * FROM expenses WHERE id = ?").get(targetId);
  return expenseSchema.parse(row);
}

export function getPayments(shopId: string, userId?: string) {
  if (userId) {
    const membership = verifyShopMembership(userId, shopId);
    if (!membership.authorized) {
      throw new Error(`Unauthorized: User cannot view payments in shop ${shopId}.`);
    }
  }

  const db = getDb();
  const rows = db.prepare(`
    SELECT p.*, o.total_mmk as order_total, c.name as customer_name, pe.id as evidence_id
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN payment_evidence pe ON pe.payment_id = p.id
    WHERE p.shop_id = ?
    ORDER BY p.verified_at DESC
  `).all(shopId) as Array<{
    id: string;
    shop_id: string;
    order_id: string;
    amount_mmk: number;
    payment_method: string;
    reference_number: string | null;
    verified_at: string;
    created_at: string;
    order_total: number;
    customer_name: string | null;
    evidence_id: string | null;
  }>;
  return rows.map((r) => ({ ...r }));
}

const GENERIC_PAYMENT_REFERENCES = new Set([
  "", "-", "--", "---", "n/a", "na", "none", "null", "cash", "direct", "paid", "ok", "kpay", "kbz", "wave", "wavepay", "0", "0000", "nil", "slip"
]);

/**
 * Securely record a verified payment transaction.
 * Enforces:
 * - Caller authorization
 * - Positive integer MMK validation
 * - Atomic database transaction
 * - Prevention of duplicate reference numbers for the same provider
 * - Prevention of excessive payment allocation exceeding order balance
 * - Status isolation: updates payment_status, promotes draft order to confirmed upon payment.
 */
export function recordPayment(
  shopId: string,
  userId: string,
  input: {
    order_id: string;
    amount_mmk: number;
    payment_method: string;
    reference_number?: string | null;
    evidence_id?: string;
    expected_evidence_revision?: number;
    trusted_record_confirmed?: boolean;
  }
): { paymentId: string; payment_status: "unpaid" | "partially_paid" | "paid" | "refunded"; total_paid_mmk: number; idempotent: boolean } {
  // 1. Authorize user for shop
  let effectiveShopId = shopId;
  let membership = verifyShopMembership(userId, effectiveShopId);

  const db = getDb();

  // If not authorized for shopId, check if order exists in another shop authorized for this user
  if (!membership.authorized) {
    const orderProbe = db.prepare("SELECT shop_id FROM orders WHERE id = ?").get(input.order_id) as { shop_id: string } | undefined;
    if (orderProbe && verifyShopMembership(userId, orderProbe.shop_id).authorized) {
      effectiveShopId = orderProbe.shop_id;
      membership = verifyShopMembership(userId, effectiveShopId);
    }
  }

  if (!membership.authorized) {
    throw new Error(`Unauthorized: User cannot record payments for shop ${shopId}.`);
  }

  // 2. Validate amount as integer MMK
  if (!Number.isSafeInteger(input.amount_mmk) || input.amount_mmk <= 0) {
    throw new Error("Payment amount must be a positive whole MMK integer.");
  }
  if (typeof input.payment_method !== "string" || !input.payment_method.trim() || input.payment_method.trim().length > 80) {
    throw new Error("Enter the payment provider or method from the trusted record.");
  }
  if (input.evidence_id && (input.trusted_record_confirmed !== true || (input.expected_evidence_revision !== undefined && (!Number.isInteger(input.expected_evidence_revision) || input.expected_evidence_revision < 0)))) {
    throw new Error("A saved evidence review and explicit trusted-record confirmation are required.");
  }

  // 3. Run within atomic transaction
  db.exec("BEGIN IMMEDIATE");
  try {
    // Check order exists in effectiveShopId
    type TargetOrderRow = {
      id: string;
      shop_id: string;
      total_mmk: number;
      order_status: string;
      payment_status: string;
      fulfillment_status: string;
    };

    let order = db.prepare(`
      SELECT id, shop_id, total_mmk, order_status, payment_status, fulfillment_status
      FROM orders
      WHERE id = ? AND shop_id = ?
    `).get(input.order_id, effectiveShopId) as TargetOrderRow | undefined;

    // Cross-shop self-healing for authorized team members
    if (!order) {
      const anyOrder = db.prepare("SELECT id, shop_id, total_mmk, order_status, payment_status, fulfillment_status FROM orders WHERE id = ?").get(input.order_id) as TargetOrderRow | undefined;
      if (anyOrder && verifyShopMembership(userId, anyOrder.shop_id).authorized) {
        order = anyOrder;
        effectiveShopId = anyOrder.shop_id;
      }
    }

    if (!order) {
      throw new Error("The specified order does not exist in this shop.");
    }

    if (order.order_status === "cancelled") {
      throw new Error("Payments cannot be recorded for cancelled orders.");
    }

    let evidence: {
      id: string;
      shop_id: string;
      order_id: string | null;
      status: string;
      extracted: string | null;
      seller_reviewed: string | null;
      revision: number;
      payment_id: string | null;
    } | undefined;

    if (input.evidence_id) {
      evidence = db.prepare(`
        SELECT id, shop_id, order_id, status, extracted, seller_reviewed, revision, payment_id
        FROM payment_evidence
        WHERE id = ? AND (shop_id = ? OR shop_id = ?)
      `).get(input.evidence_id, effectiveShopId, shopId) as typeof evidence;

      if (!evidence) {
        evidence = db.prepare(`
          SELECT pe.id, pe.shop_id, pe.order_id, pe.status, pe.extracted, pe.seller_reviewed, pe.revision, pe.payment_id
          FROM payment_evidence pe
          JOIN shop_memberships sm ON pe.shop_id = sm.shop_id
          WHERE pe.id = ? AND sm.user_id = ?
        `).get(input.evidence_id, userId) as typeof evidence;
      }

      if (!evidence) throw new Error("The saved payment evidence was not found in this shop.");

      // If already verified to this order with a matching payment, return idempotent result
      if (evidence.status === "verified" && evidence.payment_id) {
        const priorPayment = db.prepare("SELECT * FROM payments WHERE id = ?").get(evidence.payment_id) as {
          id: string; shop_id: string; order_id: string; amount_mmk: number; payment_method: string;
          reference_number: string | null; verified_at: string; created_at: string;
        } | undefined;

        if (priorPayment && priorPayment.order_id === input.order_id) {
          const totalPaid = (db.prepare("SELECT COALESCE(SUM(amount_mmk), 0) as total_paid FROM payments WHERE order_id = ?").get(input.order_id) as { total_paid: number }).total_paid;
          db.exec("COMMIT");
          return {
            paymentId: priorPayment.id,
            payment_status: order.payment_status as "unpaid" | "partially_paid" | "paid" | "refunded",
            total_paid_mmk: totalPaid,
            idempotent: true
          };
        } else if (priorPayment && priorPayment.order_id !== input.order_id) {
          throw new Error("This evidence already has a different verified payment. Reload the payment record before retrying.");
        }
      }

      // If evidence had a different order attached and was already verified to that other order, disallow
      if (evidence.status === "verified" && evidence.order_id && evidence.order_id !== input.order_id) {
        throw new Error("The saved evidence is already verified for another order.");
      }
    }

    const cleanRef = input.reference_number?.trim() || null;
    const isGenericRef = !cleanRef || GENERIC_PAYMENT_REFERENCES.has(cleanRef.toLowerCase());

    // Check duplicate reference in this shop if provided and not generic
    if (cleanRef && !isGenericRef) {
      const existingRef = db.prepare(`
        SELECT id, order_id, amount_mmk, payment_method, reference_number FROM payments
        WHERE shop_id = ? AND lower(trim(payment_method)) = lower(trim(?))
          AND lower(trim(reference_number)) = lower(trim(?))
      `).get(effectiveShopId, input.payment_method.trim(), cleanRef) as {
        id: string; order_id: string; amount_mmk: number; payment_method: string; reference_number: string | null;
      } | undefined;

      if (existingRef) {
        if (existingRef.order_id === input.order_id && existingRef.amount_mmk === input.amount_mmk && existingRef.payment_method === input.payment_method.trim()) {
          // Idempotent retry on the same order with identical payment amount and method!
          const totalPaid = (db.prepare("SELECT COALESCE(SUM(amount_mmk), 0) as total_paid FROM payments WHERE order_id = ?").get(input.order_id) as { total_paid: number }).total_paid;
          if (evidence && evidence.status === "pending_review") {
            const nextRev = evidence.revision + 1;
            db.prepare(`
              UPDATE payment_evidence
              SET status = 'verified', payment_id = ?, verified_at = datetime('now'), verified_by = ?, revision = ?, order_id = ?, updated_at = datetime('now')
              WHERE id = ?
            `).run(existingRef.id, userId, nextRev, input.order_id, evidence.id);
          }
          db.exec("COMMIT");
          return {
            paymentId: existingRef.id,
            payment_status: order.payment_status as "unpaid" | "partially_paid" | "paid" | "refunded",
            total_paid_mmk: totalPaid,
            idempotent: true
          };
        }
        throw new Error(`A payment with provider '${input.payment_method}' and reference '${cleanRef}' already exists in this shop.`);
      }
    }

    // Check existing payments on this order
    const paidRow = db.prepare(`
      SELECT COALESCE(SUM(amount_mmk), 0) as total_paid
      FROM payments
      WHERE order_id = ?
    `).get(input.order_id) as { total_paid: number };

    const totalPaidBefore = paidRow.total_paid;
    const remainingBalance = order.total_mmk - totalPaidBefore;

    // If order is already paid
    if (order.payment_status === "paid" || order.payment_status === "refunded") {
      const existingMatchingPayment = db.prepare(`
        SELECT id FROM payments
        WHERE order_id = ? AND amount_mmk = ? AND lower(trim(payment_method)) = lower(trim(?))
      `).get(input.order_id, input.amount_mmk, input.payment_method.trim()) as { id: string } | undefined;

      if (existingMatchingPayment) {
        db.exec("COMMIT");
        return {
          paymentId: existingMatchingPayment.id,
          payment_status: order.payment_status as "unpaid" | "partially_paid" | "paid" | "refunded",
          total_paid_mmk: totalPaidBefore,
          idempotent: true
        };
      }
      throw new Error("This order is already fully paid or refunded.");
    }

    if (input.amount_mmk > remainingBalance) {
      throw new Error(`Payment amount of ${input.amount_mmk} MMK exceeds remaining order balance of ${remainingBalance} MMK.`);
    }

    const newTotalPaid = totalPaidBefore + input.amount_mmk;
    const now = new Date().toISOString();
    const paymentId = crypto.randomUUID();

    // Insert payment record
    db.prepare(`
      INSERT INTO payments (id, shop_id, order_id, amount_mmk, payment_method, reference_number, verified_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(paymentId, effectiveShopId, input.order_id, input.amount_mmk, input.payment_method.trim(), cleanRef, now, now);

    // Update payment_status (and promote draft order to confirmed)
    const newPaymentStatus = newTotalPaid >= order.total_mmk ? "paid" : "partially_paid";
    const newOrderStatus = order.order_status === "draft" ? "confirmed" : order.order_status;

    db.prepare(`
      UPDATE orders
      SET payment_status = ?, order_status = ?, updated_at = ?
      WHERE id = ? AND shop_id = ?
    `).run(newPaymentStatus, newOrderStatus, now, input.order_id, effectiveShopId);

    if (evidence) {
      const nextRevision = evidence.revision + 1;
      const updatedReviewed = {
        amount_mmk: input.amount_mmk,
        provider: input.payment_method.trim(),
        transaction_reference: cleanRef,
        payer_name: null,
        payee_name: null,
        payee_account: null,
        transaction_date: null,
        transaction_time: null,
        transaction_time_uncertain: false,
        missing_fields: [],
        uncertain_fields: [],
      };
      if (evidence.seller_reviewed) {
        try {
          const parsedPrev = JSON.parse(evidence.seller_reviewed);
          Object.assign(updatedReviewed, parsedPrev, {
            amount_mmk: input.amount_mmk,
            provider: input.payment_method.trim(),
            transaction_reference: cleanRef,
          });
        } catch {}
      }

      const updatedEvidence = db.prepare(`
        UPDATE payment_evidence
        SET status = 'verified', payment_id = ?, verified_at = ?, verified_by = ?, revision = ?,
            order_id = ?, seller_reviewed = ?, amount_mmk = ?, provider = ?, reference_number = ?, updated_at = ?
        WHERE id = ? AND status = 'pending_review'
      `).run(
        paymentId, now, userId, nextRevision,
        input.order_id, JSON.stringify(updatedReviewed), input.amount_mmk, input.payment_method.trim(), cleanRef, now,
        evidence.id
      );

      if (Number(updatedEvidence.changes) === 1) {
        db.prepare(`
          INSERT INTO payment_evidence_events (
            shop_id, evidence_id, actor_id, action, before_order_id, after_order_id,
            before_status, after_status, before_revision, after_revision, before_reviewed, after_reviewed, created_at
          ) VALUES (?, ?, ?, 'verified', ?, ?, 'pending_review', 'verified', ?, ?, ?, ?, ?)
        `).run(
          effectiveShopId, evidence.id, userId, evidence.order_id, input.order_id,
          evidence.revision, nextRevision, evidence.seller_reviewed ?? "null", JSON.stringify(updatedReviewed), now
        );
      }
    }

    db.exec("COMMIT");

    return {
      paymentId,
      payment_status: newPaymentStatus,
      total_paid_mmk: newTotalPaid,
      idempotent: false,
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Advisory screenshot matching. Generates candidate match proposals only.
 * NEVER alters order payment status.
 */
export function matchScreenshot(
  shopId: string,
  extraction: ScreenshotExtraction,
  imageSha256?: string | null,
  userId?: string,
  excludedEvidenceId?: string | null
) {
  if (userId) {
    const membership = verifyShopMembership(userId, shopId);
    if (!membership.authorized) {
      throw new Error(`Unauthorized: User cannot match evidence for shop ${shopId}.`);
    }
  }

  const db = getDb();
  const orderCount = (db.prepare("SELECT COUNT(*) as count FROM orders WHERE shop_id = ?").get(shopId) as { count: number }).count;
  if (orderCount > 200) throw new Error("Matching is unavailable because this shop has more than 200 orders. The full shop scope could not be checked safely.");
  const orders = getOrders(shopId);
  const existing = db.prepare(`
    SELECT id, order_id, status, seller_reviewed, image_sha256
    FROM payment_evidence
    WHERE shop_id = ? AND (? IS NULL OR id <> ?)
    LIMIT 201
  `).all(shopId, excludedEvidenceId ?? null, excludedEvidenceId ?? null) as Array<{
    id: string;
    order_id: string | null;
    status: string;
    seller_reviewed: string | null;
    image_sha256: string | null;
  }>;
  if (existing.length > 200) throw new Error("Matching is unavailable because this shop has more than 200 evidence records. The full duplicate scope could not be checked safely.");

  const candidateContext: ExistingPaymentEvidence[] = existing.map((row) => ({
    sha256: row.image_sha256,
    status: (row.status === "verified" ? "verified" : row.status === "rejected" ? "rejected" : "pending_review") as ExistingPaymentEvidence["status"],
    seller_reviewed: row.seller_reviewed ? JSON.parse(row.seller_reviewed) : null,
  }));

  const matchableOrders: MatchableOrder[] = orders.map((o) => ({
    id: o.id,
    customer_name: o.customers?.name ?? null,
    customer_phone: o.customers?.phone ?? null,
    total_mmk: o.total_mmk,
    order_status: o.order_status,
    payment_status: o.payment_status,
    fulfillment_status: o.fulfillment_status,
  }));

  return matchScreenshotOrders(matchableOrders, extraction, candidateContext, imageSha256 ?? null);
}

/**
 * Record payment evidence review. Status may only be "pending_review" or "rejected".
 * NEVER modifies order payment status. Retains immutable extraction separately from seller corrections.
 */
export function savePaymentEvidenceRecord(
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
    expected_revision?: number;
  },
  userId?: string
) {
  if (userId) {
    const membership = verifyShopMembership(userId, shopId);
    if (!membership.authorized) {
      throw new Error(`Unauthorized: User cannot save evidence for shop ${shopId}.`);
    }
  }

  // Security constraint: Evidence can NEVER directly confirm payment
  if (evidence.status !== "pending_review" && evidence.status !== "rejected") {
    throw new Error("Invalid evidence status: Payment evidence can only be saved as pending_review or rejected.");
  }

  if (!uuidSchema.safeParse(evidence.id).success) throw new Error("The evidence ID is invalid.");
  if (evidence.expected_revision !== undefined && (!Number.isInteger(evidence.expected_revision) || evidence.expected_revision < 0 || evidence.expected_revision > 1_000_000)) {
    throw new Error("The evidence revision is invalid. Reload the review and retry.");
  }
  const extracted = screenshotExtractionSchema.safeParse(evidence.extracted);
  const sellerReviewed = screenshotExtractionSchema.safeParse(evidence.seller_reviewed);
  if (!extracted.success || !sellerReviewed.success) throw new Error("Review the supported transaction fields before saving evidence.");
  if (evidence.image_sha256 && !/^[a-f0-9]{64}$/u.test(evidence.image_sha256)) throw new Error("The evidence image hash is invalid.");

  const db = getDb();
  const now = new Date().toISOString();
  const expectedRevision = evidence.expected_revision ?? 0;
  const amount = sellerReviewed.data.amount_mmk;
  const provider = sellerReviewed.data.provider;
  const reference = sellerReviewed.data.transaction_reference;
  db.exec("BEGIN IMMEDIATE");
  try {
    if (evidence.order_id) {
      const order = db.prepare("SELECT order_status, payment_status FROM orders WHERE id = ? AND shop_id = ?").get(evidence.order_id, shopId) as { order_status: string; payment_status: string } | undefined;
      if (!order) throw new Error("The selected order is not in this shop.");
      if (order.order_status !== "confirmed" && order.order_status !== "draft") {
        throw new Error("Only confirmed or draft orders that are still unpaid or partially paid can receive pending evidence review.");
      }
      if (!["unpaid", "partially_paid"].includes(order.payment_status)) {
        throw new Error("Only orders that are still unpaid or partially paid can receive pending evidence review.");
      }
    }

    const existing = db.prepare("SELECT * FROM payment_evidence WHERE id = ?").get(evidence.id) as {
      id: string; shop_id: string; order_id: string | null; image_data: string | null; image_sha256: string | null;
      status: string; extracted: string | null; seller_reviewed: string | null; created_by: string | null;
      revision: number; payment_id: string | null; verified_at: string | null;
    } | undefined;

    if (existing) {
      if (existing.shop_id !== shopId || (existing.image_sha256 && evidence.image_sha256 && existing.image_sha256 !== evidence.image_sha256)) {
        throw new Error("This evidence ID belongs to different private evidence. Start a new review instead of overwriting it.");
      }
      if (existing.status === "verified" || existing.payment_id) throw new Error("Verified evidence is immutable. Start a new review for a different image.");
      if (existing.revision !== expectedRevision) throw new Error("This evidence review changed in another session. Reload it before saving.");
      if (existing.extracted) {
        const original = screenshotExtractionSchema.safeParse(JSON.parse(existing.extracted) as unknown);
        if (!original.success || JSON.stringify(original.data) !== JSON.stringify(extracted.data)) {
          throw new Error("The original screenshot extraction is immutable. Start a new review to analyze a different image.");
        }
      }
      const existingReviewed = existing.seller_reviewed ? screenshotExtractionSchema.safeParse(JSON.parse(existing.seller_reviewed) as unknown) : null;
      if (existing.order_id === (evidence.order_id ?? null) && existing.status === evidence.status
        && existingReviewed?.success && JSON.stringify(existingReviewed.data) === JSON.stringify(sellerReviewed.data)
        && (!evidence.image_data || existing.image_data === evidence.image_data)) {
        db.exec("COMMIT");
        return { id: evidence.id, status: evidence.status, revision: existing.revision };
      }

      const nextRevision = existing.revision + 1;
      db.prepare(`
        UPDATE payment_evidence
        SET order_id = ?, amount_mmk = ?, provider = ?, reference_number = ?,
            image_data = COALESCE(image_data, ?), image_sha256 = COALESCE(image_sha256, ?),
            status = ?, extracted = COALESCE(extracted, ?), seller_reviewed = ?,
            created_by = COALESCE(created_by, ?), revision = ?, updated_at = ?
        WHERE id = ? AND shop_id = ? AND revision = ?
      `).run(evidence.order_id ?? null, amount, provider, reference, evidence.image_data ?? null, evidence.image_sha256 ?? null,
        evidence.status, JSON.stringify(extracted.data), JSON.stringify(sellerReviewed.data), userId ?? null, nextRevision, now,
        evidence.id, shopId, existing.revision);
      const action = evidence.status === "rejected" ? "rejected" : "updated";
      db.prepare(`
        INSERT INTO payment_evidence_events (
          shop_id, evidence_id, actor_id, action, before_order_id, after_order_id,
          before_status, after_status, before_revision, after_revision, before_reviewed, after_reviewed, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(shopId, evidence.id, userId ?? existing.created_by, action, existing.order_id, evidence.order_id ?? null,
        existing.status, evidence.status, existing.revision, nextRevision, existing.seller_reviewed ?? "null", JSON.stringify(sellerReviewed.data), now);
      db.exec("COMMIT");
      return { id: evidence.id, status: evidence.status, revision: nextRevision };
    }

    if (expectedRevision !== 0) throw new Error("Evidence is unavailable at this revision. Reload the review and retry.");
    db.prepare(`
      INSERT INTO payment_evidence (
        id, shop_id, order_id, amount_mmk, provider, reference_number, image_data, image_sha256,
        status, extracted, seller_reviewed, created_by, revision, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(evidence.id, shopId, evidence.order_id ?? null, amount, provider, reference, evidence.image_data ?? null,
      evidence.image_sha256 ?? null, evidence.status, JSON.stringify(extracted.data), JSON.stringify(sellerReviewed.data), userId ?? null, now, now);
    db.prepare(`
      INSERT INTO payment_evidence_events (
        shop_id, evidence_id, actor_id, action, before_order_id, after_order_id,
        before_status, after_status, before_revision, after_revision, before_reviewed, after_reviewed, created_at
      ) VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, NULL, 0, NULL, ?, ?)
    `).run(shopId, evidence.id, userId ?? null, evidence.status === "rejected" ? "rejected" : "created",
      evidence.order_id ?? null, evidence.status, JSON.stringify(sellerReviewed.data), now);
    db.exec("COMMIT");
    return { id: evidence.id, status: evidence.status, revision: 0 };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function getLocalPaymentEvidenceReadback(shopId: string, evidenceId: string, userId?: string) {
  if (userId && !verifyShopMembership(userId, shopId).authorized) throw new Error("Unauthorized: User cannot view evidence in this shop.");
  const row = getDb().prepare(`
    SELECT id, shop_id, order_id, image_data, image_sha256, extracted, seller_reviewed, status, payment_id,
      verified_at, created_by, created_at, updated_at, revision
    FROM payment_evidence WHERE shop_id = ? AND id = ?
  `).get(shopId, evidenceId) as Record<string, unknown> | undefined;
  if (!row) return null;
  const rawImage = typeof row.image_data === "string" && row.image_data.trim() ? row.image_data.trim() : null;
  const imageDataUrl = rawImage ? (rawImage.startsWith("data:") ? rawImage : `data:image/png;base64,${rawImage}`) : null;
  const parsed = localPaymentEvidenceReadbackSchema.safeParse({
    ...row,
    image_data: imageDataUrl,
    extracted: typeof row.extracted === "string" ? JSON.parse(row.extracted) as unknown : null,
    seller_reviewed: typeof row.seller_reviewed === "string" ? JSON.parse(row.seller_reviewed) as unknown : null,
  });
  if (!parsed.success) throw new Error("The saved evidence readback has unsupported review data.");
  return parsed.data;
}

export function getPaymentEvidenceReviews(shopId: string, userId?: string) {
  if (userId && !verifyShopMembership(userId, shopId).authorized) throw new Error(`Unauthorized: User cannot view evidence in shop ${shopId}.`);
  const rows = getDb().prepare(`
    SELECT e.id, e.shop_id, e.order_id, e.image_sha256, e.extracted, e.seller_reviewed, e.status,
      e.payment_id, e.verified_at, e.created_by, e.created_at, e.updated_at, e.revision,
      e.amount_mmk, e.provider, e.reference_number, o.total_mmk as order_total_mmk, c.name as customer_name
    FROM payment_evidence e
    LEFT JOIN orders o ON o.id = e.order_id AND o.shop_id = e.shop_id
    LEFT JOIN customers c ON c.id = o.customer_id AND c.shop_id = e.shop_id
    WHERE e.shop_id = ?
    ORDER BY e.updated_at DESC
    LIMIT 200
  `).all(shopId) as Array<Record<string, unknown>>;
  return rows.flatMap(row => {
    if (typeof row.id !== "string" || typeof row.shop_id !== "string"
      || !["pending_review", "rejected", "verified"].includes(String(row.status))) return [];
    let sellerReviewed: ScreenshotExtraction | null = null;
    if (typeof row.seller_reviewed === "string") {
      try {
        const parsed = screenshotExtractionSchema.safeParse(JSON.parse(row.seller_reviewed) as unknown);
        if (parsed.success) sellerReviewed = parsed.data;
      } catch { /* Legacy evidence is still listed, with its details marked incomplete. */ }
    }
    return [{
      id: row.id,
      shop_id: row.shop_id,
      order_id: typeof row.order_id === "string" ? row.order_id : null,
      status: row.status as "pending_review" | "rejected" | "verified",
      seller_reviewed: sellerReviewed,
      payment_id: typeof row.payment_id === "string" ? row.payment_id : null,
      verified_at: typeof row.verified_at === "string" ? row.verified_at : null,
      created_at: String(row.created_at ?? ""),
      updated_at: String(row.updated_at ?? ""),
      revision: typeof row.revision === "number" ? row.revision : 0,
      amount_mmk: typeof row.amount_mmk === "number" ? row.amount_mmk : null,
      provider: typeof row.provider === "string" ? row.provider : null,
      reference_number: typeof row.reference_number === "string" ? row.reference_number : null,
      order_total_mmk: typeof row.order_total_mmk === "number" ? row.order_total_mmk : null,
      customer_name: typeof row.customer_name === "string" ? row.customer_name : null,
    }];
  });
}
