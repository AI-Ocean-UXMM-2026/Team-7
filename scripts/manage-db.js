const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const dbPath = path.resolve('data', 'salesayar.db');
const db = new DatabaseSync(dbPath);
const now = new Date().toISOString();

console.log('Connecting to database:', dbPath);

// Find profiles
const testSeller = db.prepare("SELECT id FROM profiles WHERE email = 'testseller8899@gmail.com'").get();
if (testSeller) {
  db.prepare("INSERT OR REPLACE INTO shop_memberships (shop_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)").run('74198df3-5985-44b2-9b64-cb349f18bed7', testSeller.id, now);
  db.prepare("INSERT OR REPLACE INTO shop_memberships (shop_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)").run('10000000-0000-4000-8000-000000000001', testSeller.id, now);
  console.log('Linked testseller8899@gmail.com to yoon and May Thu boutique');
}

const staff = db.prepare("SELECT id FROM profiles WHERE email = 'staff@salesayar.com'").get();
if (staff) {
  db.prepare("INSERT OR REPLACE INTO shop_memberships (shop_id, user_id, role, created_at) VALUES (?, ?, 'staff', ?)").run('74198df3-5985-44b2-9b64-cb349f18bed7', staff.id, now);
  db.prepare("INSERT OR REPLACE INTO shop_memberships (shop_id, user_id, role, created_at) VALUES (?, ?, 'staff', ?)").run('10000000-0000-4000-8000-000000000001', staff.id, now);
  console.log('Linked staff@salesayar.com to yoon and May Thu boutique');
}

const anonymousMerchant = db.prepare("SELECT id FROM profiles WHERE id = 'a0000000-0000-4000-8000-000000000099'").get();
if (anonymousMerchant) {
  db.prepare("INSERT OR REPLACE INTO shop_memberships (shop_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)").run('74198df3-5985-44b2-9b64-cb349f18bed7', anonymousMerchant.id, now);
  console.log('Linked anonymous merchant to yoon');
}

console.log('--- UPDATED SHOP MEMBERSHIPS ---');
const members = db.prepare(`
  SELECT sm.shop_id, s.name as shop_name, sm.user_id, p.email, sm.role
  FROM shop_memberships sm
  JOIN shops s ON sm.shop_id = s.id
  JOIN profiles p ON sm.user_id = p.id
  WHERE sm.shop_id IN ('74198df3-5985-44b2-9b64-cb349f18bed7', '10000000-0000-4000-8000-000000000001')
`).all();
console.table(members);
