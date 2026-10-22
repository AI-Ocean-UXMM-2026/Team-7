import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

let dbInstance: DatabaseSync | null = null;

export const LIVE_SHOP_ID = "10000000-0000-4000-8000-000000000001";
export const SAMPLE_SHOP_ID = "00000000-0000-4000-8000-000000000001";
export const DEFAULT_SHOP_ID = LIVE_SHOP_ID;
export const DEFAULT_USER_ID = "00000000-0000-4000-8000-000000000001";
export const STAFF_USER_ID = "00000000-0000-4000-8000-000000000002";

export function resolveDbPath(): string {
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

function getDbPath(): string {
  if (process.env.SALESAYAR_DB_PATH) {
    return process.env.SALESAYAR_DB_PATH;
  }
  // On Vercel / AWS Lambda, the root filesystem is read-only.
  // /tmp is the only writable directory for SQLite databases.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDir = process.platform === "win32" ? (process.env.TEMP || "C:\\temp") : "/tmp";
    return path.join(tmpDir, "salesayar.db");
  }
  try {
    const dbPath = resolveDbPath();
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dbPath;
  } catch {
    const tmpDir = process.platform === "win32" ? (process.env.TEMP || "C:\\temp") : "/tmp";
    return path.join(tmpDir, "salesayar.db");
  }
}

export function setDb(db: DatabaseSync | null): void {
  dbInstance = db;
}

export function resetDbForTesting(db?: DatabaseSync): DatabaseSync {
  const testDb = db || new DatabaseSync(":memory:");
  testDb.exec("PRAGMA foreign_keys = ON;");
  initSchema(testDb);
  seedInitialData(testDb);
  dbInstance = testDb;
  return testDb;
}

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const dbPath = getDbPath();
  const db = new DatabaseSync(dbPath);

  // Enable WAL mode and foreign keys for high reliability and concurrency
  if (dbPath !== ":memory:") {
    try {
      db.exec("PRAGMA journal_mode = WAL;");
    } catch {
      try {
        db.exec("PRAGMA journal_mode = DELETE;");
      } catch {
        // Fallback for memory or restricted disk
      }
    }
  }
  db.exec("PRAGMA foreign_keys = ON;");

  initSchema(db);
  seedInitialData(db);

  dbInstance = db;
  return db;
}

export function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      email TEXT,
      display_name TEXT,
      role TEXT DEFAULT 'owner',
      password_hash TEXT,
      session_revoked_at TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS shops (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      currency TEXT DEFAULT 'MMK',
      is_sample INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS shop_memberships (
      shop_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'owner',
      created_at TEXT,
      PRIMARY KEY (shop_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS shop_invitations (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      created_at TEXT NOT NULL,
      created_by TEXT,
      UNIQUE(shop_id, email)
    );

    CREATE TABLE IF NOT EXISTS shop_receiving_accounts (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      account_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(shop_id, provider, account_number)
    );

    CREATE TABLE IF NOT EXISTS assistant_pairings (
      challenge TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      name TEXT NOT NULL,
      unit_price_mmk INTEGER NOT NULL,
      cost_price_mmk INTEGER NOT NULL,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      customer_id TEXT,
      order_status TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      fulfillment_status TEXT NOT NULL,
      subtotal_mmk INTEGER NOT NULL,
      delivery_fee_mmk INTEGER NOT NULL DEFAULT 0,
      discount_mmk INTEGER NOT NULL DEFAULT 0,
      total_mmk INTEGER NOT NULL,
      delivery_address TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price_mmk INTEGER NOT NULL,
      line_total_mmk INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_revisions (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      revision_number INTEGER NOT NULL,
      snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS voucher_versions (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      voucher_data TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      description TEXT NOT NULL,
      amount_mmk INTEGER NOT NULL,
      category TEXT NOT NULL,
      expense_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_evidence (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      order_id TEXT,
      amount_mmk INTEGER,
      provider TEXT,
      reference_number TEXT,
      image_data TEXT,
      image_sha256 TEXT,
      status TEXT NOT NULL DEFAULT 'pending_review',
      extracted TEXT,
      seller_reviewed TEXT,
      created_by TEXT,
      revision INTEGER NOT NULL DEFAULT 0,
      payment_id TEXT REFERENCES payments(id),
      verified_at TEXT,
      verified_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      amount_mmk INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      reference_number TEXT,
      verified_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_evidence_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id TEXT NOT NULL,
      evidence_id TEXT NOT NULL,
      actor_id TEXT,
      action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'rejected', 'verified')),
      before_order_id TEXT,
      after_order_id TEXT,
      before_status TEXT,
      after_status TEXT NOT NULL,
      before_revision INTEGER,
      after_revision INTEGER NOT NULL,
      before_reviewed TEXT,
      after_reviewed TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (shop_id, evidence_id) REFERENCES payment_evidence(shop_id, id)
    );
  `);

  // Non-destructive schema migrations for existing databases
  try {
    db.exec("ALTER TABLE shops ADD COLUMN is_sample INTEGER DEFAULT 0;");
  } catch {
    // Column already exists
  }

  try {
    db.exec("ALTER TABLE payment_evidence ADD COLUMN extracted TEXT;");
  } catch {
    // Column already exists
  }

  for (const migration of [
    "ALTER TABLE payment_evidence ADD COLUMN created_by TEXT;",
    "ALTER TABLE payment_evidence ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;",
    "ALTER TABLE payment_evidence ADD COLUMN payment_id TEXT REFERENCES payments(id);",
    "ALTER TABLE payment_evidence ADD COLUMN verified_at TEXT;",
    "ALTER TABLE payment_evidence ADD COLUMN verified_by TEXT;",
  ]) {
    try { db.exec(migration); } catch { /* Existing databases already have this column. */ }
  }

  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS payment_evidence_shop_id_unique ON payment_evidence(shop_id, id);");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS payment_evidence_payment_unique ON payment_evidence(payment_id) WHERE payment_id IS NOT NULL;");
  db.exec("CREATE INDEX IF NOT EXISTS payment_evidence_shop_review_idx ON payment_evidence(shop_id, status, updated_at DESC);");
  db.exec("CREATE INDEX IF NOT EXISTS payment_evidence_event_lookup_idx ON payment_evidence_events(shop_id, evidence_id, after_revision, created_at);");
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS payment_evidence_original_immutable
    BEFORE UPDATE OF extracted, image_sha256, image_data ON payment_evidence
    WHEN OLD.extracted IS NOT NULL AND (
      NEW.extracted IS NOT OLD.extracted OR NEW.image_sha256 IS NOT OLD.image_sha256 OR NEW.image_data IS NOT OLD.image_data
    )
    BEGIN SELECT RAISE(ABORT, 'Original payment evidence is immutable'); END;

    CREATE TRIGGER IF NOT EXISTS payment_evidence_verified_immutable
    BEFORE UPDATE ON payment_evidence
    WHEN OLD.status = 'verified'
    BEGIN SELECT RAISE(ABORT, 'Verified payment evidence is immutable'); END;

    CREATE TRIGGER IF NOT EXISTS payment_evidence_event_no_update
    BEFORE UPDATE ON payment_evidence_events
    BEGIN SELECT RAISE(ABORT, 'Payment evidence events are append-only'); END;

    CREATE TRIGGER IF NOT EXISTS payment_evidence_event_no_delete
    BEFORE DELETE ON payment_evidence_events
    BEGIN SELECT RAISE(ABORT, 'Payment evidence events are append-only'); END;
  `);

  try {
    db.exec("ALTER TABLE profiles ADD COLUMN password_hash TEXT;");
  } catch {
    // Column already exists
  }

  try {
    db.exec("ALTER TABLE profiles ADD COLUMN session_revoked_at TEXT;");
  } catch {
    // Column already exists
  }

  try {
    db.exec("ALTER TABLE profiles ADD COLUMN status TEXT DEFAULT 'active';");
  } catch {
    // Column already exists
  }
}

export function seedInitialData(db: DatabaseSync) {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // Sample Shop (is_sample = 1) - Dedicated isolated sample demonstration workspace.
  // Preserved strictly as a standalone demonstration fixture with zero live access,
  // no seeded user credentials, and no default memberships.
  // Live accounts and shops are created only via authenticated merchant signup/onboarding.
  const sampleShopCount = (db.prepare("SELECT COUNT(*) as count FROM shops WHERE id = ?").get(SAMPLE_SHOP_ID) as { count: number }).count;
  if (sampleShopCount === 0) {
    db.prepare(`
      INSERT INTO shops (id, name, currency, is_sample, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(SAMPLE_SHOP_ID, "May Thu’s Sample Boutique", "MMK", 1, now, now);

    // Synthetic demo orders
    const sampleCustId = "20000000-0000-4000-8000-000000000099";
    db.prepare(`
      INSERT INTO customers (id, shop_id, name, phone, address, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sampleCustId, SAMPLE_SHOP_ID, "Sample Customer", "09 123 4567", "Yangon Sample St", "Synthetic record for UI demo only", now, now);

    const sOrder1 = "40000000-0000-4000-8000-000000000091";
    db.prepare(`
      INSERT INTO orders (id, shop_id, customer_id, order_status, payment_status, fulfillment_status, subtotal_mmk, delivery_fee_mmk, discount_mmk, total_mmk, delivery_address, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sOrder1, SAMPLE_SHOP_ID, sampleCustId, "confirmed", "paid", "delivered", 45000, 3000, 0, 48000, "Yangon Sample St", "Synthetic sample demonstration order", `${today}T10:00:00Z`, `${today}T10:00:00Z`);

    db.prepare(`
      INSERT INTO order_items (id, shop_id, order_id, product_name, quantity, unit_price_mmk, line_total_mmk, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run("50000000-0000-4000-8000-000000000091", SAMPLE_SHOP_ID, sOrder1, "Sample Tote Bag", 2, 22500, 45000, `${today}T10:00:00Z`);

    // Simulated payment in sample shop is explicitly marked as Simulated Sample Record
    db.prepare(`
      INSERT INTO payments (id, shop_id, order_id, amount_mmk, payment_method, reference_number, verified_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run("60000000-0000-4000-8000-000000000091", SAMPLE_SHOP_ID, sOrder1, 48000, "Simulated KPay (Sample)", "SAMPLE-TXN849201", `${today}T10:15:00Z`, `${today}T10:15:00Z`);

    // Sample expenses
    db.prepare(`
      INSERT INTO expenses (id, shop_id, description, amount_mmk, category, expense_date, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run("70000000-0000-4000-8000-000000000091", SAMPLE_SHOP_ID, "Sample Packaging", 15000, "Packaging", today, "Synthetic sample expense", now, now);
  }
}
