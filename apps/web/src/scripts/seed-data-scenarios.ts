import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";

function getDbPath(): string {
  let dir = process.cwd();
  if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
    dir = path.join(dir, "data");
  } else if (fs.existsSync(path.join(dir, "..", "..", "pnpm-workspace.yaml"))) {
    dir = path.join(dir, "..", "..", "data");
  } else {
    dir = path.join(dir, "data");
  }
  return path.join(dir, "salesayar.db");
}

export function seedMerchantScenarios(targetShopId = "b3465366-e46d-44b4-a1a5-6e6b7cac332c") {
  const dbPath = getDbPath();
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");

  const shopRow = db.prepare("SELECT id, name FROM shops WHERE id = ?").get(targetShopId) as { id: string; name: string } | undefined;
  if (!shopRow) {
    console.error(`Shop ${targetShopId} not found in database.`);
    return;
  }

  console.log(`Seeding realistic Myanmar seller data scenarios for: ${shopRow.name} (${targetShopId})...`);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10);
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000).toISOString().slice(0, 10);

  // 1. Products
  const products = [
    { name: "Pure Silk Mandalay Htamein", unit_price: 45000, cost_price: 24000 },
    { name: "Embroidered Silk Shawl", unit_price: 15000, cost_price: 8000 },
    { name: "Shwe Pyi Nann Thanaka Skincare Set", unit_price: 28000, cost_price: 14000 },
    { name: "Shan Special Roasted Tea Leaves", unit_price: 12000, cost_price: 6000 },
    { name: "Handwoven Rattan Handbag", unit_price: 38000, cost_price: 20000 },
    { name: "Premium Cotton Longyi", unit_price: 16000, cost_price: 8500 },
    { name: "Natural Herbal Hair Oil", unit_price: 18000, cost_price: 9000 },
    { name: "Silk Longyi", unit_price: 36000, cost_price: 19000 },
    { name: "Traditional Cotton Shirt", unit_price: 24000, cost_price: 12000 },
    { name: "TikTok Live Special Combo Set", unit_price: 55000, cost_price: 28000 },
  ];

  const insertProduct = db.prepare(`
    INSERT OR REPLACE INTO products (id, shop_id, name, unit_price_mmk, cost_price_mmk, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const p of products) {
    const existing = db.prepare("SELECT id FROM products WHERE shop_id = ? AND name = ?").get(targetShopId, p.name) as { id: string } | undefined;
    const prodId = existing?.id ?? crypto.randomUUID();
    insertProduct.run(prodId, targetShopId, p.name, p.unit_price, p.cost_price, now.toISOString());
  }

  // 2. Customers
  const customerList = [
    { name: "Daw Khin Marlar", phone: "09450012345", address: "No. 42, Inya Road, Bahan Township, Yangon", notes: "VIP Customer - prefers afternoon delivery" },
    { name: "Ko Aung Kyaw", phone: "09798112233", address: "73rd Street, Between 30th & 31st, Chanmyathazi, Mandalay", notes: "Mandalay pickup or Royal Express" },
    { name: "Ma Su Mon", phone: "09254119988", address: "No. 18, Lower Main Road, Mawlamyine", notes: "Cash on delivery customer" },
    { name: "Daw San San", phone: "09971234567", address: "Room 4B, Parami Condominium, Hlaing Township, Yangon", notes: "Regular Facebook live viewer" },
    { name: "Ko Zin Myo", phone: "09421098765", address: "Circular Road, Near Botanical Gardens, Pyin Oo Lwin", notes: "Prefers Wave Money" },
    { name: "Ma Hnin Yu", phone: "09778899001", address: "Pyidaungsu Road, Taunggyi", notes: "Frequent Shan snacks buyer" },
    { name: "Daw Thin Thin", phone: "09401122334", address: "Building 12, Hledan Center, Kamayut Township, Yangon", notes: "TikTok live buyer" },
    { name: "Ko Min Thu", phone: "09250088112", address: "No. 104, Thitsar Road, South Okkalapa, Yangon", notes: "Call before dispatch" },
    { name: "Ma Ei Ei Khin", phone: "09443322110", address: "No. 88, Sanchaung Street, Sanchaung, Yangon", notes: "Live stream order today" },
  ];

  const insertCust = db.prepare(`
    INSERT OR REPLACE INTO customers (id, shop_id, name, phone, address, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const customerMap = new Map<string, string>();
  for (const c of customerList) {
    const existing = db.prepare("SELECT id FROM customers WHERE shop_id = ? AND name = ?").get(targetShopId, c.name) as { id: string } | undefined;
    const custId = existing?.id ?? crypto.randomUUID();
    customerMap.set(c.name, custId);
    insertCust.run(custId, targetShopId, c.name, c.phone, c.address, c.notes, now.toISOString(), now.toISOString());
  }

  // 3. Orders, Items, Payments & Payment Evidence
  const orderScenarios = [
    {
      customerName: "Ma Ei Ei Khin",
      date: `${today}T08:30:00.000Z`,
      status: "confirmed",
      paymentStatus: "paid",
      fulfillmentStatus: "processing",
      items: [{ name: "Silk Longyi", qty: 2, price: 36000 }],
      deliveryFee: 2500,
      payment: { method: "KBZPay", ref: `KPay-${today.replace(/-/g, "")}-9941`, date: `${today}T08:35:00.000Z` },
      notes: "Live stream morning flash sale bundle",
    },
    {
      customerName: "Daw Khin Marlar",
      date: `${today}T05:15:00.000Z`,
      status: "confirmed",
      paymentStatus: "paid",
      fulfillmentStatus: "shipped",
      items: [
        { name: "Pure Silk Mandalay Htamein", qty: 1, price: 45000 },
        { name: "Embroidered Silk Shawl", qty: 1, price: 15000 },
      ],
      deliveryFee: 2500,
      payment: { method: "KBZPay", ref: `KPay-${today.replace(/-/g, "")}-8124`, date: `${today}T05:20:00.000Z` },
      notes: "Packed with gift ribbon. Dispatched via Royal Express #RY-8921",
    },
    {
      customerName: "Ko Aung Kyaw",
      date: `${yesterday}T10:20:00.000Z`,
      status: "confirmed",
      paymentStatus: "paid",
      fulfillmentStatus: "shipped",
      items: [{ name: "Shwe Pyi Nann Thanaka Skincare Set", qty: 2, price: 28000 }],
      deliveryFee: 3000,
      payment: { method: "WavePay", ref: `WP-98214012`, date: `${yesterday}T10:25:00.000Z` },
      notes: "Mandalay branch dispatch via Kerry Express #KE-1029",
    },
    {
      customerName: "Daw San San",
      date: `${yesterday}T14:40:00.000Z`,
      status: "confirmed",
      paymentStatus: "pending_review",
      fulfillmentStatus: "unfulfilled",
      items: [{ name: "Handwoven Rattan Handbag", qty: 1, price: 38000 }],
      deliveryFee: 2000,
      evidence: { provider: "KBZPay", ref: `KPay-${yesterday.replace(/-/g, "")}-7788`, amount: 40000 },
      notes: "Slip uploaded via Facebook chat, pending merchant verification",
    },
    {
      customerName: "Ma Su Mon",
      date: `${twoDaysAgo}T09:10:00.000Z`,
      status: "confirmed",
      paymentStatus: "unpaid",
      fulfillmentStatus: "processing",
      items: [{ name: "Shan Special Roasted Tea Leaves", qty: 3, price: 12000 }],
      deliveryFee: 3500,
      notes: "Cash on delivery (COD) Mawlamyine via Ninja Van #NV-8821",
    },
    {
      customerName: "Ko Zin Myo",
      date: `${twoDaysAgo}T16:30:00.000Z`,
      status: "confirmed",
      paymentStatus: "paid",
      fulfillmentStatus: "delivered",
      items: [{ name: "Premium Cotton Longyi", qty: 2, price: 16000 }],
      deliveryFee: 3000,
      payment: { method: "KBZPay", ref: `KPay-${twoDaysAgo.replace(/-/g, "")}-4912`, date: `${twoDaysAgo}T16:35:00.000Z` },
      notes: "Delivered safely. Customer confirmed received",
    },
    {
      customerName: "Ma Hnin Yu",
      date: `${threeDaysAgo}T11:00:00.000Z`,
      status: "confirmed",
      paymentStatus: "paid",
      fulfillmentStatus: "delivered",
      items: [{ name: "Natural Herbal Hair Oil", qty: 2, price: 18000 }],
      deliveryFee: 3500,
      payment: { method: "WavePay", ref: `WP-87123910`, date: `${threeDaysAgo}T11:05:00.000Z` },
      notes: "Delivered to Taunggyi. Customer gave 5-star rating",
    },
    {
      customerName: "Ko Min Thu",
      date: `${threeDaysAgo}T15:20:00.000Z`,
      status: "confirmed",
      paymentStatus: "paid",
      fulfillmentStatus: "delivered",
      items: [{ name: "Traditional Cotton Shirt", qty: 1, price: 24000 }],
      deliveryFee: 2000,
      payment: { method: "KBZPay", ref: `KPay-${threeDaysAgo.replace(/-/g, "")}-3192`, date: `${threeDaysAgo}T15:25:00.000Z` },
      notes: "South Okkalapa hand-delivered by shop rider",
    },
    {
      customerName: "Daw Thin Thin",
      date: `${fiveDaysAgo}T13:10:00.000Z`,
      status: "confirmed",
      paymentStatus: "unpaid",
      fulfillmentStatus: "processing",
      items: [{ name: "TikTok Live Special Combo Set", qty: 1, price: 55000 }],
      deliveryFee: 2000,
      notes: "COD Kamayut parcel scheduled for morning delivery",
    },
  ];

  const insertOrder = db.prepare(`
    INSERT INTO orders (id, shop_id, customer_id, order_status, payment_status, fulfillment_status, subtotal_mmk, delivery_fee_mmk, discount_mmk, total_mmk, delivery_address, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (id, shop_id, order_id, product_name, quantity, unit_price_mmk, line_total_mmk, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPayment = db.prepare(`
    INSERT INTO payments (id, shop_id, order_id, amount_mmk, payment_method, reference_number, verified_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEvidence = db.prepare(`
    INSERT INTO payment_evidence (id, shop_id, order_id, amount_mmk, provider, reference_number, image_data, image_sha256, status, extracted, seller_reviewed, created_by, revision, verified_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const s of orderScenarios) {
    const custId = customerMap.get(s.customerName) ?? null;
    const custAddress = customerList.find((c) => c.name === s.customerName)?.address ?? "";
    const orderId = crypto.randomUUID();

    let subtotal = 0;
    for (const item of s.items) {
      subtotal += item.qty * item.price;
    }
    const total = subtotal + s.deliveryFee;

    insertOrder.run(
      orderId,
      targetShopId,
      custId,
      s.status,
      s.paymentStatus,
      s.fulfillmentStatus,
      subtotal,
      s.deliveryFee,
      0,
      total,
      custAddress,
      s.notes,
      s.date,
      s.date
    );

    for (const item of s.items) {
      insertOrderItem.run(
        crypto.randomUUID(),
        targetShopId,
        orderId,
        item.name,
        item.qty,
        item.price,
        item.qty * item.price,
        s.date
      );
    }

    if (s.payment) {
      const paymentId = crypto.randomUUID();
      insertPayment.run(
        paymentId,
        targetShopId,
        orderId,
        total,
        s.payment?.method ?? "KBZPay",
        s.payment?.ref ?? null,
        s.payment?.date ?? s.date,
        s.payment?.date ?? s.date
      );
    }

    if (s.evidence) {
      const evidenceId = crypto.randomUUID();
      const extractedObj = {
        amount_mmk: s.evidence.amount,
        sender_account: "Daw San San (KBZPay 09971234567)",
        receiver_account: "Daw Thuzar Shop (KBZPay 09451122334)",
        transaction_reference: s.evidence.ref,
        confidence_score: 0.96,
        transferred_at: s.date,
      };
      insertEvidence.run(
        evidenceId,
        targetShopId,
        orderId,
        s.evidence.amount,
        s.evidence.provider,
        s.evidence.ref,
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        crypto.createHash("sha256").update(evidenceId).digest("hex"),
        "pending_review",
        JSON.stringify(extractedObj),
        JSON.stringify(extractedObj),
        "system",
        1,
        null,
        s.date,
        s.date
      );
    }
  }

  // 4. Expenses
  const expenses = [
    {
      desc: "Bubble wrap mailers & eco boxes (500 pcs batch)",
      amount: 35000,
      category: "Packaging",
      date: today,
      notes: "Bought from Mingalar Market packaging supplier",
    },
    {
      desc: "Royal Express & Ninja Van postage vouchers (Batch 14)",
      amount: 48000,
      category: "Delivery",
      date: yesterday,
      notes: "Prepaid delivery sticker vouchers for week orders",
    },
    {
      desc: "Facebook Live Broadcast Page Boost Ad (3 days)",
      amount: 55000,
      category: "Marketing",
      date: yesterday,
      notes: "Boosted live sales event post reaching Yangon/Mandalay",
    },
    {
      desc: "Mandalay Silk workshop wholesale restock batch",
      amount: 220000,
      category: "Product costs",
      date: threeDaysAgo,
      notes: "Wholesale longyi & htamein fabric batch payment",
    },
    {
      desc: "Thermal barcode sticker printer paper (5 rolls)",
      amount: 15000,
      category: "Other",
      date: twoDaysAgo,
      notes: "Thermal receipt rolls for shipping label printer",
    },
    {
      desc: "TikTok Shop campaign banner design & promo clips",
      amount: 25000,
      category: "Marketing",
      date: fiveDaysAgo,
      notes: "Social media creative asset booster",
    },
  ];

  const insertExpense = db.prepare(`
    INSERT INTO expenses (id, shop_id, description, amount_mmk, category, expense_date, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const e of expenses) {
    insertExpense.run(
      crypto.randomUUID(),
      targetShopId,
      e.desc,
      e.amount,
      e.category,
      e.date,
      e.notes,
      now.toISOString(),
      now.toISOString()
    );
  }

  console.log("Successfully seeded rich Myanmar seller scenarios!");
}

if (process.argv[1]?.endsWith("seed-data-scenarios.ts") || process.argv[1]?.endsWith("seed-data-scenarios.js")) {
  seedMerchantScenarios();
}
