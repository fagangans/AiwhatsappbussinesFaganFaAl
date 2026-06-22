import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "business.db");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS dashboard_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS business_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    address TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    website TEXT DEFAULT '',
    category TEXT DEFAULT '',
    logo_url TEXT DEFAULT '',
    welcome_message TEXT DEFAULT 'Halo! Selamat datang. Ada yang bisa kami bantu?',
    away_message TEXT DEFAULT 'Maaf, saat ini kami sedang offline. Pesan Anda akan kami balas segera.',
    open_hour INTEGER DEFAULT 8,
    close_hour INTEGER DEFAULT 21,
    timezone TEXT DEFAULT 'Asia/Jakarta',
    auto_reply_enabled INTEGER DEFAULT 1,
    ai_enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(owner_id)
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL DEFAULT 1,
    bot_id TEXT DEFAULT '',
    jid TEXT NOT NULL,
    phone TEXT DEFAULT '',
    name TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    notes TEXT DEFAULT '',
    total_orders INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    satisfaction_avg REAL DEFAULT 0,
    first_contact TEXT DEFAULT (datetime('now')),
    last_contact TEXT DEFAULT (datetime('now')),
    is_blocked INTEGER DEFAULT 0,
    UNIQUE(jid, owner_id)
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL DEFAULT 1,
    sku TEXT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price REAL NOT NULL DEFAULT 0,
    discount_price REAL DEFAULT 0,
    category TEXT DEFAULT 'Umum',
    stock INTEGER DEFAULT 0,
    image_url TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(sku, owner_id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL DEFAULT 1,
    bot_id TEXT DEFAULT '',
    order_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    items TEXT NOT NULL DEFAULT '[]',
    subtotal REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'unpaid',
    payment_method TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    shipping_address TEXT DEFAULT '',
    tracking_number TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL DEFAULT 1,
    bot_id TEXT DEFAULT '',
    ticket_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    description TEXT DEFAULT '',
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open',
    assigned_agent TEXT DEFAULT '',
    resolution TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS messages_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL DEFAULT 1,
    bot_id TEXT DEFAULT '',
    customer_id INTEGER,
    direction TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    content TEXT DEFAULT '',
    timestamp TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS faq (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL DEFAULT 1,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    keywords TEXT DEFAULT '[]',
    category TEXT DEFAULT 'Umum',
    is_active INTEGER DEFAULT 1,
    hit_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'Umum',
    variables TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(name, owner_id)
  );

  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL DEFAULT 1,
    jid TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'agent',
    is_online INTEGER DEFAULT 0,
    active_chats INTEGER DEFAULT 0,
    total_handled INTEGER DEFAULT 0,
    avg_response_time REAL DEFAULT 0,
    rating_avg REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(jid, owner_id)
  );

  CREATE TABLE IF NOT EXISTS broadcasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_tags TEXT DEFAULT '[]',
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft',
    scheduled_at TEXT,
    sent_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    method TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    proof_url TEXT DEFAULT '',
    confirmed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL DEFAULT 1,
    date TEXT NOT NULL,
    messages_in INTEGER DEFAULT 0,
    messages_out INTEGER DEFAULT 0,
    new_customers INTEGER DEFAULT 0,
    orders_count INTEGER DEFAULT 0,
    revenue REAL DEFAULT 0,
    tickets_opened INTEGER DEFAULT 0,
    tickets_resolved INTEGER DEFAULT 0,
    avg_response_time REAL DEFAULT 0,
    satisfaction_avg REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS satisfaction_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    ticket_id INTEGER,
    order_id INTEGER,
    rating INTEGER NOT NULL,
    feedback TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS important_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL DEFAULT 1,
    bot_id TEXT DEFAULT '',
    customer_id INTEGER,
    customer_name TEXT DEFAULT '',
    customer_jid TEXT DEFAULT '',
    message TEXT NOT NULL,
    category TEXT DEFAULT 'umum',
    priority TEXT DEFAULT 'medium',
    is_read INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS bots (
    id TEXT PRIMARY KEY,
    owner_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bot_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL,
    client_user_id INTEGER NOT NULL,
    granted_by INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(bot_id, client_user_id)
  );

  CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    variant_name TEXT NOT NULL,
    sku TEXT,
    price_adjustment REAL DEFAULT 0,
    stock INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL DEFAULT 1,
    code TEXT NOT NULL,
    discount_type TEXT DEFAULT 'percentage',
    discount_value REAL NOT NULL DEFAULT 0,
    min_order REAL DEFAULT 0,
    max_discount REAL DEFAULT 0,
    usage_limit INTEGER DEFAULT 0,
    used_count INTEGER DEFAULT 0,
    valid_from TEXT DEFAULT (datetime('now')),
    valid_until TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(code, owner_id)
  );

  CREATE TABLE IF NOT EXISTS payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'bank_transfer',
    account_number TEXT DEFAULT '',
    account_name TEXT DEFAULT '',
    instructions TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// === MIGRATION FOR EXISTING INSTALLS ===
function addColSafe(table, col, typedef) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${typedef}`);
  }
}

const needsMigration = (() => {
  const cols = db.prepare("PRAGMA table_info(customers)").all();
  return cols.length > 0 && !cols.some(c => c.name === "owner_id");
})();

if (needsMigration) {
  console.log("[DB] Migrasi ke multi-tenant...");
  db.pragma("foreign_keys = OFF");
  // Mencegah SQLite menulis ulang FOREIGN KEY di tabel lain (orders, tickets,
  // messages_log, dst.) saat tabel customers/products/dll di-rename.
  db.pragma("legacy_alter_table = ON");

  db.exec(`
    ALTER TABLE customers RENAME TO _customers_old;
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL DEFAULT 1,
      jid TEXT NOT NULL, phone TEXT DEFAULT '', name TEXT DEFAULT '', email TEXT DEFAULT '',
      address TEXT DEFAULT '', tags TEXT DEFAULT '[]', notes TEXT DEFAULT '',
      total_orders INTEGER DEFAULT 0, total_spent REAL DEFAULT 0, satisfaction_avg REAL DEFAULT 0,
      first_contact TEXT DEFAULT (datetime('now')), last_contact TEXT DEFAULT (datetime('now')),
      is_blocked INTEGER DEFAULT 0, UNIQUE(jid, owner_id)
    );
    INSERT INTO customers (id,owner_id,jid,phone,name,email,address,tags,notes,total_orders,total_spent,satisfaction_avg,first_contact,last_contact,is_blocked)
      SELECT id,1,jid,phone,name,email,address,tags,notes,total_orders,total_spent,satisfaction_avg,first_contact,last_contact,is_blocked FROM _customers_old;
    DROP TABLE _customers_old;

    ALTER TABLE products RENAME TO _products_old;
    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL DEFAULT 1,
      sku TEXT, name TEXT NOT NULL, description TEXT DEFAULT '', price REAL NOT NULL DEFAULT 0,
      discount_price REAL DEFAULT 0, category TEXT DEFAULT 'Umum', stock INTEGER DEFAULT 0,
      image_url TEXT DEFAULT '', is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(sku, owner_id)
    );
    INSERT INTO products (id,owner_id,sku,name,description,price,discount_price,category,stock,image_url,is_active,created_at,updated_at)
      SELECT id,1,sku,name,description,price,discount_price,category,stock,image_url,is_active,created_at,updated_at FROM _products_old;
    DROP TABLE _products_old;

    ALTER TABLE templates RENAME TO _templates_old;
    CREATE TABLE templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL, content TEXT NOT NULL, category TEXT DEFAULT 'Umum',
      variables TEXT DEFAULT '[]', created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(name, owner_id)
    );
    INSERT INTO templates (id,owner_id,name,content,category,variables,created_at)
      SELECT id,1,name,content,category,variables,created_at FROM _templates_old;
    DROP TABLE _templates_old;

    ALTER TABLE agents RENAME TO _agents_old;
    CREATE TABLE agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL DEFAULT 1,
      jid TEXT NOT NULL, name TEXT NOT NULL, role TEXT DEFAULT 'agent',
      is_online INTEGER DEFAULT 0, active_chats INTEGER DEFAULT 0, total_handled INTEGER DEFAULT 0,
      avg_response_time REAL DEFAULT 0, rating_avg REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), UNIQUE(jid, owner_id)
    );
    INSERT INTO agents (id,owner_id,jid,name,role,is_online,active_chats,total_handled,avg_response_time,rating_avg,created_at)
      SELECT id,1,jid,name,role,is_online,active_chats,total_handled,avg_response_time,rating_avg,created_at FROM _agents_old;
    DROP TABLE _agents_old;

    ALTER TABLE business_profile RENAME TO _bp_old;
    CREATE TABLE business_profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL DEFAULT '', description TEXT DEFAULT '', address TEXT DEFAULT '',
      email TEXT DEFAULT '', phone TEXT DEFAULT '', website TEXT DEFAULT '', category TEXT DEFAULT '',
      logo_url TEXT DEFAULT '',
      welcome_message TEXT DEFAULT 'Halo! Selamat datang. Ada yang bisa kami bantu?',
      away_message TEXT DEFAULT 'Maaf, saat ini kami sedang offline. Pesan Anda akan kami balas segera.',
      open_hour INTEGER DEFAULT 8, close_hour INTEGER DEFAULT 21, timezone TEXT DEFAULT 'Asia/Jakarta',
      auto_reply_enabled INTEGER DEFAULT 1, ai_enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(owner_id)
    );
    INSERT INTO business_profile (id,owner_id,name,description,address,email,phone,website,category,logo_url,welcome_message,away_message,open_hour,close_hour,timezone,auto_reply_enabled,ai_enabled,created_at,updated_at)
      SELECT id,1,name,description,address,email,phone,website,category,logo_url,welcome_message,away_message,open_hour,close_hour,timezone,auto_reply_enabled,ai_enabled,created_at,updated_at FROM _bp_old;
    DROP TABLE _bp_old;
  `);

  addColSafe("orders", "owner_id", "INTEGER DEFAULT 1");
  addColSafe("tickets", "owner_id", "INTEGER DEFAULT 1");
  addColSafe("messages_log", "owner_id", "INTEGER DEFAULT 1");
  addColSafe("faq", "owner_id", "INTEGER DEFAULT 1");
  addColSafe("broadcasts", "owner_id", "INTEGER DEFAULT 1");
  addColSafe("analytics", "owner_id", "INTEGER DEFAULT 1");
  addColSafe("important_messages", "owner_id", "INTEGER DEFAULT 1");

  db.pragma("legacy_alter_table = OFF");
  db.pragma("foreign_keys = ON");
  console.log("[DB] Migrasi selesai!");
}

// Tambahkan kolom bot_id untuk pemisahan data per bot (dipakai fitur sharing akses bot ke client)
addColSafe("customers", "bot_id", "TEXT DEFAULT ''");
addColSafe("orders", "bot_id", "TEXT DEFAULT ''");
addColSafe("tickets", "bot_id", "TEXT DEFAULT ''");
addColSafe("messages_log", "bot_id", "TEXT DEFAULT ''");

// === REPAIR: perbaiki FOREIGN KEY yang nyangkut ke tabel _old hasil migrasi lama ===
// Dideteksi langsung lewat PRAGMA foreign_key_list (bukan tebak-tebakan pola teks),
// supaya tidak peduli format spasi/penulisan FK yang berbeda-beda dari versi lama.
function repairDanglingForeignKeys() {
  const existingTables = new Set(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name),
  );

  const tablesToFix = [];
  for (const tableName of existingTables) {
    const fks = db.prepare(`PRAGMA foreign_key_list(${tableName})`).all();
    const danglingRefs = fks.filter(fk => !existingTables.has(fk.table));
    if (danglingRefs.length > 0) {
      tablesToFix.push({ name: tableName, danglingRefs });
    }
  }

  if (tablesToFix.length === 0) {
    console.log("[DB] Foreign key check OK — tidak ada yang perlu diperbaiki.");
    return;
  }

  console.log("[DB] Memperbaiki foreign key yang rusak akibat migrasi sebelumnya...");
  db.pragma("foreign_keys = OFF");
  db.pragma("legacy_alter_table = ON");

  for (const { name, danglingRefs } of tablesToFix) {
    const { sql } = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
    ).get(name);

    let fixedSql = sql;
    for (const { table: refTable } of danglingRefs) {
      const target = refTable.startsWith("_bp_old")
        ? "business_profile"
        : refTable.replace(/^_/, "").replace(/_old$/, "");
      // SQLite wraps renamed identifiers in double quotes: "_customers_old"(id)
      fixedSql = fixedSql.replace(
        new RegExp(`"${refTable}"(\\s*\\()`, "g"),
        `${target}$1`,
      );
      fixedSql = fixedSql.replace(
        new RegExp(`${refTable}(\\s*\\()`, "g"),
        `${target}$1`,
      );
    }

    const backupName = `_${name}_fkbackup`;
    db.exec(`ALTER TABLE ${name} RENAME TO ${backupName};`);
    db.exec(fixedSql);
    const cols = db.prepare(`PRAGMA table_info(${name})`).all().map(c => c.name).join(",");
    db.exec(`INSERT INTO ${name} (${cols}) SELECT ${cols} FROM ${backupName};`);
    db.exec(`DROP TABLE ${backupName};`);
    console.log(`[DB] Tabel ${name} diperbaiki.`);
  }

  db.pragma("legacy_alter_table = OFF");
  db.pragma("foreign_keys = ON");
  console.log("[DB] Perbaikan foreign key selesai!");
}

repairDanglingForeignKeys();

// === NEW TABLES: Loyalty, Referral, Addresses, Bundles ===
db.exec(`
  CREATE TABLE IF NOT EXISTS loyalty_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    points INTEGER NOT NULL,
    reason TEXT DEFAULT '',
    order_id INTEGER,
    owner_id INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS loyalty_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL DEFAULT 1,
    points_per_rupiah REAL DEFAULT 0.01,
    min_redeem INTEGER DEFAULT 100,
    redeem_value REAL DEFAULT 1000,
    is_active INTEGER DEFAULT 1,
    UNIQUE(owner_id)
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER NOT NULL,
    referred_id INTEGER NOT NULL,
    referral_code TEXT NOT NULL,
    reward_given INTEGER DEFAULT 0,
    owner_id INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (referrer_id) REFERENCES customers(id),
    FOREIGN KEY (referred_id) REFERENCES customers(id),
    UNIQUE(referred_id)
  );

  CREATE TABLE IF NOT EXISTS customer_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    label TEXT DEFAULT 'Rumah',
    address TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS product_bundles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    bundle_price REAL NOT NULL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bundle_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bundle_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    qty INTEGER DEFAULT 1,
    FOREIGN KEY (bundle_id) REFERENCES product_bundles(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS broadcast_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    broadcast_id INTEGER NOT NULL,
    customer_jid TEXT NOT NULL,
    wa_message_id TEXT DEFAULT '',
    status TEXT DEFAULT 'sent',
    sent_at TEXT DEFAULT (datetime('now')),
    delivered_at TEXT,
    read_at TEXT,
    FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id)
  );

  CREATE INDEX IF NOT EXISTS idx_broadcast_msgs_bc ON broadcast_messages(broadcast_id);
  CREATE INDEX IF NOT EXISTS idx_broadcast_msgs_waid ON broadcast_messages(wa_message_id);

  CREATE TABLE IF NOT EXISTS automation_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    trigger_config TEXT DEFAULT '{}',
    action_type TEXT NOT NULL,
    action_config TEXT DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    execution_count INTEGER DEFAULT 0,
    last_executed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS automation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER NOT NULL,
    customer_jid TEXT DEFAULT '',
    result TEXT DEFAULT 'success',
    executed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (rule_id) REFERENCES automation_rules(id)
  );

  CREATE INDEX IF NOT EXISTS idx_automation_rules_owner ON automation_rules(owner_id);
  CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON automation_rules(is_active);
  CREATE INDEX IF NOT EXISTS idx_automation_log_rule ON automation_log(rule_id);

  CREATE TABLE IF NOT EXISTS chat_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL DEFAULT 1,
    bot_id TEXT DEFAULT '',
    customer_jid TEXT NOT NULL,
    customer_name TEXT DEFAULT '',
    agent_jid TEXT DEFAULT '',
    agent_name TEXT DEFAULT '',
    status TEXT DEFAULT 'unassigned',
    last_message TEXT DEFAULT '',
    last_message_at TEXT DEFAULT (datetime('now')),
    assigned_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES dashboard_users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_chat_assignments_owner ON chat_assignments(owner_id);
  CREATE INDEX IF NOT EXISTS idx_chat_assignments_agent ON chat_assignments(agent_jid);
  CREATE INDEX IF NOT EXISTS idx_chat_assignments_status ON chat_assignments(status);
  CREATE INDEX IF NOT EXISTS idx_chat_assignments_customer ON chat_assignments(customer_jid);
`);

addColSafe("customers", "loyalty_points", "INTEGER DEFAULT 0");
addColSafe("customers", "referral_code", "TEXT DEFAULT ''");
addColSafe("customers", "birthday", "TEXT DEFAULT ''");
addColSafe("customers", "lead_score", "INTEGER DEFAULT 0");
addColSafe("customers", "lead_tier", "TEXT DEFAULT 'cold'");
addColSafe("messages_log", "sentiment", "TEXT DEFAULT ''");
addColSafe("messages_log", "sentiment_score", "REAL DEFAULT NULL");

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_customers_jid_owner ON customers(jid, owner_id);
  CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(owner_id);
  CREATE INDEX IF NOT EXISTS idx_products_owner ON products(owner_id);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
  CREATE INDEX IF NOT EXISTS idx_orders_owner ON orders(owner_id);
  CREATE INDEX IF NOT EXISTS idx_tickets_customer ON tickets(customer_id);
  CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
  CREATE INDEX IF NOT EXISTS idx_tickets_number ON tickets(ticket_number);
  CREATE INDEX IF NOT EXISTS idx_tickets_owner ON tickets(owner_id);
  CREATE INDEX IF NOT EXISTS idx_messages_customer ON messages_log(customer_id);
  CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date);
  CREATE INDEX IF NOT EXISTS idx_analytics_owner ON analytics(owner_id);
  CREATE INDEX IF NOT EXISTS idx_faq_owner ON faq(owner_id);
  CREATE INDEX IF NOT EXISTS idx_templates_owner ON templates(owner_id);
  CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_id);
  CREATE INDEX IF NOT EXISTS idx_broadcasts_owner ON broadcasts(owner_id);
  CREATE INDEX IF NOT EXISTS idx_important_bot ON important_messages(bot_id);
  CREATE INDEX IF NOT EXISTS idx_important_read ON important_messages(is_read);
  CREATE INDEX IF NOT EXISTS idx_important_owner ON important_messages(owner_id);
  CREATE INDEX IF NOT EXISTS idx_bots_owner ON bots(owner_id);
  CREATE INDEX IF NOT EXISTS idx_customers_bot ON customers(bot_id);
  CREATE INDEX IF NOT EXISTS idx_orders_bot ON orders(bot_id);
  CREATE INDEX IF NOT EXISTS idx_tickets_bot ON tickets(bot_id);
  CREATE INDEX IF NOT EXISTS idx_messages_bot ON messages_log(bot_id);
  CREATE INDEX IF NOT EXISTS idx_bot_access_client ON bot_access(client_user_id);
  CREATE INDEX IF NOT EXISTS idx_bot_access_bot ON bot_access(bot_id);
  CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
  CREATE INDEX IF NOT EXISTS idx_vouchers_owner ON vouchers(owner_id);
  CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
  CREATE INDEX IF NOT EXISTS idx_payment_methods_owner ON payment_methods(owner_id);
  CREATE INDEX IF NOT EXISTS idx_loyalty_customer ON loyalty_points(customer_id);
  CREATE INDEX IF NOT EXISTS idx_loyalty_owner ON loyalty_points(owner_id);
  CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
  CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);
  CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
  CREATE INDEX IF NOT EXISTS idx_customer_addresses ON customer_addresses(customer_id);
  CREATE INDEX IF NOT EXISTS idx_bundles_owner ON product_bundles(owner_id);
  CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle ON bundle_items(bundle_id);
  CREATE INDEX IF NOT EXISTS idx_customers_lead ON customers(lead_tier);
  CREATE INDEX IF NOT EXISTS idx_messages_sentiment ON messages_log(sentiment);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS handoffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL DEFAULT 1,
    bot_id TEXT DEFAULT '',
    customer_id INTEGER,
    customer_jid TEXT NOT NULL,
    customer_name TEXT DEFAULT '',
    agent_jid TEXT NOT NULL,
    agent_name TEXT DEFAULT '',
    reason TEXT DEFAULT '',
    chat_summary TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE INDEX IF NOT EXISTS idx_handoffs_owner ON handoffs(owner_id);
  CREATE INDEX IF NOT EXISTS idx_handoffs_status ON handoffs(status);
  CREATE INDEX IF NOT EXISTS idx_handoffs_customer ON handoffs(customer_jid);
`);

addColSafe("broadcasts", "delivered_count", "INTEGER DEFAULT 0");
addColSafe("broadcasts", "read_count", "INTEGER DEFAULT 0");
addColSafe("broadcasts", "failed_count", "INTEGER DEFAULT 0");

const adminProfile = db.prepare("SELECT COUNT(*) as c FROM business_profile WHERE owner_id = 1").get();
if (adminProfile.c === 0) {
  db.prepare("INSERT INTO business_profile (owner_id) VALUES (1)").run();
}

export default db;

// === PROFILE ===
export function getProfile(ownerId = 1) {
  let p = db.prepare("SELECT * FROM business_profile WHERE owner_id = ?").get(ownerId);
  if (!p) {
    db.prepare("INSERT INTO business_profile (owner_id) VALUES (?)").run(ownerId);
    p = db.prepare("SELECT * FROM business_profile WHERE owner_id = ?").get(ownerId);
  }
  return p;
}

export function updateProfile(data, ownerId = 1) {
  const fields = Object.keys(data).filter(k => k !== "id" && k !== "owner_id");
  const sets = fields.map(f => `${f} = @${f}`).join(", ");
  data.oid = ownerId;
  return db.prepare(`UPDATE business_profile SET ${sets}, updated_at = datetime('now') WHERE owner_id = @oid`).run(data);
}

// === CUSTOMERS ===
export function getOrCreateCustomer(jid, name = "", ownerId = 1, botId = "") {
  let c = db.prepare("SELECT * FROM customers WHERE jid = ? AND owner_id = ?").get(jid, ownerId);
  if (!c) {
    const phone = jid.split("@")[0];
    db.prepare("INSERT INTO customers (jid, phone, name, owner_id, bot_id) VALUES (?, ?, ?, ?, ?)").run(jid, phone, name, ownerId, botId || "");
    c = db.prepare("SELECT * FROM customers WHERE jid = ? AND owner_id = ?").get(jid, ownerId);
  } else if (name && c.name !== name) {
    db.prepare("UPDATE customers SET name = ?, last_contact = datetime('now') WHERE jid = ? AND owner_id = ?").run(name, jid, ownerId);
    c.name = name;
  } else {
    db.prepare("UPDATE customers SET last_contact = datetime('now') WHERE jid = ? AND owner_id = ?").run(jid, ownerId);
  }
  return c;
}

export function getCustomer(jid, ownerId = null, botId = null) {
  let sql = "SELECT * FROM customers WHERE jid = ?";
  const p = [jid];
  if (ownerId) { sql += " AND owner_id = ?"; p.push(ownerId); }
  if (botId) { sql += " AND bot_id = ?"; p.push(botId); }
  return db.prepare(sql).get(...p);
}

export function updateCustomer(id, data) {
  const fields = Object.keys(data).filter(k => k !== "id" && k !== "owner_id");
  const sets = fields.map(f => `${f} = @${f}`).join(", ");
  data.id = id;
  return db.prepare(`UPDATE customers SET ${sets} WHERE id = @id`).run(data);
}

export function getAllCustomers(limit = 100, offset = 0, ownerId = null, botId = null) {
  let sql = "SELECT * FROM customers WHERE 1=1";
  const p = [];
  if (ownerId) { sql += " AND owner_id = ?"; p.push(ownerId); }
  if (botId) { sql += " AND bot_id = ?"; p.push(botId); }
  sql += " ORDER BY last_contact DESC LIMIT ? OFFSET ?";
  p.push(limit, offset);
  return db.prepare(sql).all(...p);
}

export function searchCustomers(query, ownerId = null, botId = null) {
  const q = `%${query}%`;
  let sql = "SELECT * FROM customers WHERE (name LIKE ? OR phone LIKE ? OR jid LIKE ?)";
  const p = [q, q, q];
  if (ownerId) { sql += " AND owner_id = ?"; p.push(ownerId); }
  if (botId) { sql += " AND bot_id = ?"; p.push(botId); }
  return db.prepare(sql).all(...p);
}

export function getCustomerCount(ownerId = null, botId = null) {
  let sql = "SELECT COUNT(*) as count FROM customers WHERE 1=1";
  const p = [];
  if (ownerId) { sql += " AND owner_id = ?"; p.push(ownerId); }
  if (botId) { sql += " AND bot_id = ?"; p.push(botId); }
  return db.prepare(sql).get(...p).count;
}

// === PRODUCTS ===
export function addProduct(data) {
  const params = {
    sku: data.sku || null,
    name: data.name,
    description: data.description || "",
    price: data.price,
    discount_price: data.discount_price || 0,
    category: data.category || "Umum",
    stock: data.stock || 0,
    image_url: data.image_url || "",
    owner_id: data.owner_id,
  };
  return db.prepare("INSERT INTO products (sku, name, description, price, discount_price, category, stock, image_url, owner_id) VALUES (@sku, @name, @description, @price, @discount_price, @category, @stock, @image_url, @owner_id)").run(params);
}

export function updateProduct(id, data) {
  const fields = Object.keys(data).filter(k => k !== "id" && k !== "owner_id");
  const sets = fields.map(f => `${f} = @${f}`).join(", ");
  data.id = id;
  return db.prepare(`UPDATE products SET ${sets}, updated_at = datetime('now') WHERE id = @id`).run(data);
}

export function deleteProduct(id) {
  return db.prepare("UPDATE products SET is_active = 0 WHERE id = ?").run(id);
}

export function getProduct(id) {
  return db.prepare("SELECT * FROM products WHERE id = ? AND is_active = 1").get(id);
}

export function getProductBySku(sku, ownerId = null) {
  if (ownerId) return db.prepare("SELECT * FROM products WHERE sku = ? AND owner_id = ? AND is_active = 1").get(sku, ownerId);
  return db.prepare("SELECT * FROM products WHERE sku = ? AND is_active = 1").get(sku);
}

export function getAllProducts(category = null, ownerId = null) {
  let sql = "SELECT * FROM products WHERE is_active = 1";
  const p = [];
  if (ownerId) { sql += " AND owner_id = ?"; p.push(ownerId); }
  if (category) { sql += " AND category = ?"; p.push(category); }
  sql += " ORDER BY category, name";
  return db.prepare(sql).all(...p);
}

export function getProductCategories(ownerId = null) {
  if (ownerId) return db.prepare("SELECT DISTINCT category FROM products WHERE is_active = 1 AND owner_id = ? ORDER BY category").all(ownerId).map(r => r.category);
  return db.prepare("SELECT DISTINCT category FROM products WHERE is_active = 1 ORDER BY category").all().map(r => r.category);
}

export function searchProducts(query, ownerId = null) {
  const q = `%${query}%`;
  if (ownerId) return db.prepare("SELECT * FROM products WHERE is_active = 1 AND owner_id = ? AND (name LIKE ? OR description LIKE ? OR sku LIKE ?)").all(ownerId, q, q, q);
  return db.prepare("SELECT * FROM products WHERE is_active = 1 AND (name LIKE ? OR description LIKE ? OR sku LIKE ?)").all(q, q, q);
}

// === ORDERS ===
function generateOrderNumber() {
  const d = new Date();
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const count = db.prepare("SELECT COUNT(*) as c FROM orders WHERE date(created_at) = date('now')").get().c;
  return `ORD-${y}${m}${day}-${String(count + 1).padStart(4, "0")}`;
}

export function createOrder(customerId, items, total, notes = "", shippingAddress = "", ownerId = 1, botId = "", paymentMethod = "") {
  const orderNumber = generateOrderNumber();
  const itemsJson = JSON.stringify(items);
  const subtotal = items.reduce((s, i) => s + (i.price * i.qty), 0);
  db.prepare("INSERT INTO orders (order_number, customer_id, items, subtotal, total, notes, shipping_address, owner_id, bot_id, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(orderNumber, customerId, itemsJson, subtotal, total, notes, shippingAddress, ownerId, botId || "", paymentMethod || "");
  db.prepare("UPDATE customers SET total_orders = total_orders + 1 WHERE id = ?").run(customerId);
  for (const item of items) {
    if (item.product_id) {
      db.prepare("UPDATE products SET stock = MAX(stock - ?, 0), updated_at = datetime('now') WHERE id = ?").run(item.qty, item.product_id);
      if (item.variant_id) {
        db.prepare("UPDATE product_variants SET stock = MAX(stock - ?, 0) WHERE id = ?").run(item.qty, item.variant_id);
      }
    }
  }
  return db.prepare("SELECT * FROM orders WHERE order_number = ?").get(orderNumber);
}

export function restoreStockForOrder(orderNumber) {
  const order = db.prepare("SELECT * FROM orders WHERE order_number = ?").get(orderNumber);
  if (!order) return;
  const items = JSON.parse(order.items || "[]");
  for (const item of items) {
    if (item.product_id) {
      db.prepare("UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?").run(item.qty, item.product_id);
      if (item.variant_id) {
        db.prepare("UPDATE product_variants SET stock = stock + ? WHERE id = ?").run(item.qty, item.variant_id);
      }
    }
  }
}

export function getOrder(orderNumber, ownerId = null) {
  let sql = "SELECT o.*, c.name as customer_name, c.jid as customer_jid FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.order_number = ?";
  const p = [orderNumber];
  if (ownerId) { sql += " AND o.owner_id = ?"; p.push(ownerId); }
  return db.prepare(sql).get(...p);
}

export function getOrderById(id) {
  return db.prepare("SELECT o.*, c.name as customer_name, c.jid as customer_jid FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.id = ?").get(id);
}

export function updateOrderStatus(orderNumber, status) {
  const prev = db.prepare("SELECT status FROM orders WHERE order_number = ?").get(orderNumber);
  if (prev && prev.status !== "cancelled" && status === "cancelled") {
    restoreStockForOrder(orderNumber);
  }
  return db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE order_number = ?").run(status, orderNumber);
}

export function getCustomerOrders(customerId) {
  return db.prepare("SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC").all(customerId);
}

export function getAllOrders(status = null, limit = 50, ownerId = null, botId = null) {
  let sql = "SELECT o.*, c.name as customer_name, c.jid as customer_jid FROM orders o JOIN customers c ON o.customer_id = c.id WHERE 1=1";
  const p = [];
  if (ownerId) { sql += " AND o.owner_id = ?"; p.push(ownerId); }
  if (botId) { sql += " AND o.bot_id = ?"; p.push(botId); }
  if (status) { sql += " AND o.status = ?"; p.push(status); }
  sql += " ORDER BY o.created_at DESC LIMIT ?";
  p.push(limit);
  return db.prepare(sql).all(...p);
}

export function getOrderStats(ownerId = null, botId = null) {
  let sql = "SELECT" + `
    COUNT(*) as total_orders,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
    SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
    SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped,
    SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
    SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END) as total_revenue
  FROM orders WHERE 1=1`;
  const p = [];
  if (ownerId) { sql += " AND owner_id = ?"; p.push(ownerId); }
  if (botId) { sql += " AND bot_id = ?"; p.push(botId); }
  return db.prepare(sql).get(...p);
}

// === TICKETS ===
function generateTicketNumber() {
  const count = db.prepare("SELECT COUNT(*) as c FROM tickets").get().c;
  return `TKT-${String(count + 1).padStart(5, "0")}`;
}

export function createTicket(customerId, subject, description = "", priority = "medium", ownerId = 1, botId = "") {
  const ticketNumber = generateTicketNumber();
  db.prepare("INSERT INTO tickets (ticket_number, customer_id, subject, description, priority, owner_id, bot_id) VALUES (?, ?, ?, ?, ?, ?, ?)").run(ticketNumber, customerId, subject, description, priority, ownerId, botId || "");
  return db.prepare("SELECT * FROM tickets WHERE ticket_number = ?").get(ticketNumber);
}

export function getTicket(ticketNumber, ownerId = null) {
  let sql = "SELECT t.*, c.name as customer_name, c.jid as customer_jid FROM tickets t JOIN customers c ON t.customer_id = c.id WHERE t.ticket_number = ?";
  const p = [ticketNumber];
  if (ownerId) { sql += " AND t.owner_id = ?"; p.push(ownerId); }
  return db.prepare(sql).get(...p);
}

export function updateTicketStatus(ticketNumber, status, resolution = "") {
  const resolvedAt = status === "resolved" || status === "closed" ? "datetime('now')" : "NULL";
  if (resolution) {
    return db.prepare(`UPDATE tickets SET status = ?, resolution = ?, resolved_at = ${resolvedAt}, updated_at = datetime('now') WHERE ticket_number = ?`).run(status, resolution, ticketNumber);
  }
  return db.prepare(`UPDATE tickets SET status = ?, resolved_at = ${resolvedAt}, updated_at = datetime('now') WHERE ticket_number = ?`).run(status, ticketNumber);
}

export function getCustomerTickets(customerId) {
  return db.prepare("SELECT * FROM tickets WHERE customer_id = ? ORDER BY created_at DESC").all(customerId);
}

export function getAllTickets(status = null, limit = 50, ownerId = null, botId = null) {
  let sql = "SELECT t.*, c.name as customer_name FROM tickets t JOIN customers c ON t.customer_id = c.id WHERE 1=1";
  const p = [];
  if (ownerId) { sql += " AND t.owner_id = ?"; p.push(ownerId); }
  if (botId) { sql += " AND t.bot_id = ?"; p.push(botId); }
  if (status) { sql += " AND t.status = ?"; p.push(status); }
  sql += " ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END, t.created_at DESC LIMIT ?";
  p.push(limit);
  return db.prepare(sql).all(...p);
}

export function getTicketStats(ownerId = null, botId = null) {
  let sql = `SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_tickets,
    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
    SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
    SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed
  FROM tickets WHERE 1=1`;
  const p = [];
  if (ownerId) { sql += " AND owner_id = ?"; p.push(ownerId); }
  if (botId) { sql += " AND bot_id = ?"; p.push(botId); }
  return db.prepare(sql).get(...p);
}

// === MESSAGES ===
export function logMessage(customerId, direction, content, messageType = "text", ownerId = 1, botId = "") {
  db.prepare("INSERT INTO messages_log (customer_id, direction, message_type, content, owner_id, bot_id) VALUES (?, ?, ?, ?, ?, ?)").run(customerId, direction, messageType, content, ownerId, botId || "");
}

export function getMessageLogs(customerId, limit = 50) {
  return db.prepare("SELECT * FROM messages_log WHERE customer_id = ? ORDER BY timestamp DESC LIMIT ?").all(customerId, limit);
}

// === FAQ ===
export function addFaq(question, answer, keywords = [], category = "Umum", ownerId = 1) {
  db.prepare("INSERT INTO faq (question, answer, keywords, category, owner_id) VALUES (?, ?, ?, ?, ?)").run(question, answer, JSON.stringify(keywords), category, ownerId);
}

export function getAllFaq(ownerId = null) {
  if (ownerId) return db.prepare("SELECT * FROM faq WHERE is_active = 1 AND owner_id = ? ORDER BY hit_count DESC").all(ownerId);
  return db.prepare("SELECT * FROM faq WHERE is_active = 1 ORDER BY hit_count DESC").all();
}

export function searchFaq(query, ownerId = null) {
  const q = `%${query}%`;
  let results;
  if (ownerId) {
    results = db.prepare("SELECT * FROM faq WHERE is_active = 1 AND owner_id = ? AND (question LIKE ? OR answer LIKE ? OR keywords LIKE ?)").all(ownerId, q, q, q);
  } else {
    results = db.prepare("SELECT * FROM faq WHERE is_active = 1 AND (question LIKE ? OR answer LIKE ? OR keywords LIKE ?)").all(q, q, q);
  }
  if (results.length > 0) db.prepare("UPDATE faq SET hit_count = hit_count + 1 WHERE id = ?").run(results[0].id);
  return results;
}

export function deleteFaq(id) {
  return db.prepare("UPDATE faq SET is_active = 0 WHERE id = ?").run(id);
}

// === TEMPLATES ===
export function addTemplate(name, content, category = "Umum", variables = [], ownerId = 1) {
  db.prepare("INSERT INTO templates (name, content, category, variables, owner_id) VALUES (?, ?, ?, ?, ?)").run(name, content, category, JSON.stringify(variables), ownerId);
}

export function getTemplate(name, ownerId = null) {
  if (ownerId) return db.prepare("SELECT * FROM templates WHERE name = ? AND owner_id = ?").get(name, ownerId);
  return db.prepare("SELECT * FROM templates WHERE name = ?").get(name);
}

export function getAllTemplates(ownerId = null) {
  if (ownerId) return db.prepare("SELECT * FROM templates WHERE owner_id = ? ORDER BY category, name").all(ownerId);
  return db.prepare("SELECT * FROM templates ORDER BY category, name").all();
}

export function deleteTemplate(name, ownerId = null) {
  if (ownerId) return db.prepare("DELETE FROM templates WHERE name = ? AND owner_id = ?").run(name, ownerId);
  return db.prepare("DELETE FROM templates WHERE name = ?").run(name);
}

// === AGENTS ===
export function addAgent(jid, name, role = "agent", ownerId = 1) {
  db.prepare("INSERT OR IGNORE INTO agents (jid, name, role, owner_id) VALUES (?, ?, ?, ?)").run(jid, name, role, ownerId);
  return db.prepare("SELECT * FROM agents WHERE jid = ? AND owner_id = ?").get(jid, ownerId);
}

export function getAgent(jid, ownerId = null) {
  if (ownerId) return db.prepare("SELECT * FROM agents WHERE jid = ? AND owner_id = ?").get(jid, ownerId);
  return db.prepare("SELECT * FROM agents WHERE jid = ?").get(jid);
}

export function getAllAgents(ownerId = null) {
  if (ownerId) return db.prepare("SELECT * FROM agents WHERE owner_id = ? ORDER BY name").all(ownerId);
  return db.prepare("SELECT * FROM agents ORDER BY name").all();
}

export function updateAgentStatus(jid, isOnline, ownerId = null) {
  if (ownerId) return db.prepare("UPDATE agents SET is_online = ? WHERE jid = ? AND owner_id = ?").run(isOnline ? 1 : 0, jid, ownerId);
  return db.prepare("UPDATE agents SET is_online = ? WHERE jid = ?").run(isOnline ? 1 : 0, jid);
}

// === BROADCASTS ===
export function createBroadcast(title, message, targetTags = [], ownerId = 1) {
  db.prepare("INSERT INTO broadcasts (title, message, target_tags, owner_id) VALUES (?, ?, ?, ?)").run(title, message, JSON.stringify(targetTags), ownerId);
  return db.prepare("SELECT * FROM broadcasts WHERE owner_id = ? ORDER BY id DESC LIMIT 1").get(ownerId);
}

export function getBroadcast(id) {
  return db.prepare("SELECT * FROM broadcasts WHERE id = ?").get(id);
}

export function getAllBroadcasts(ownerId = null) {
  if (ownerId) return db.prepare("SELECT * FROM broadcasts WHERE owner_id = ? ORDER BY created_at DESC").all(ownerId);
  return db.prepare("SELECT * FROM broadcasts ORDER BY created_at DESC").all();
}

export function updateBroadcastStatus(id, status, sentCount = 0, failedCount = 0) {
  return db.prepare("UPDATE broadcasts SET status = ?, sent_count = ?, failed_count = ?, sent_at = datetime('now') WHERE id = ?").run(status, sentCount, failedCount, id);
}

export function addBroadcastMessage(broadcastId, customerJid, waMessageId) {
  db.prepare("INSERT INTO broadcast_messages (broadcast_id, customer_jid, wa_message_id) VALUES (?, ?, ?)").run(broadcastId, customerJid, waMessageId || "");
}

export function updateBroadcastMessageStatus(waMessageId, status) {
  const now = "datetime('now')";
  if (status === "delivered") {
    db.prepare(`UPDATE broadcast_messages SET status = 'delivered', delivered_at = ${now} WHERE wa_message_id = ? AND status != 'read'`).run(waMessageId);
  } else if (status === "read") {
    db.prepare(`UPDATE broadcast_messages SET status = 'read', read_at = ${now}, delivered_at = COALESCE(delivered_at, ${now}) WHERE wa_message_id = ?`).run(waMessageId);
  }
}

export function refreshBroadcastCounts(broadcastId) {
  const stats = db.prepare(`SELECT
    SUM(CASE WHEN status IN ('delivered','read') THEN 1 ELSE 0 END) as delivered,
    SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read_count,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
  FROM broadcast_messages WHERE broadcast_id = ?`).get(broadcastId);
  db.prepare("UPDATE broadcasts SET delivered_count = ?, read_count = ?, failed_count = ? WHERE id = ?")
    .run(stats?.delivered || 0, stats?.read_count || 0, stats?.failed || 0, broadcastId);
}

export function getBroadcastMessages(broadcastId) {
  return db.prepare("SELECT * FROM broadcast_messages WHERE broadcast_id = ? ORDER BY sent_at DESC").all(broadcastId);
}

export function getBroadcastIdByMessageId(waMessageId) {
  const row = db.prepare("SELECT broadcast_id FROM broadcast_messages WHERE wa_message_id = ?").get(waMessageId);
  return row ? row.broadcast_id : null;
}

// === PAYMENTS ===
export function addPayment(orderId, amount, method = "") {
  db.prepare("INSERT INTO payments (order_id, amount, method) VALUES (?, ?, ?)").run(orderId, amount, method);
  return db.prepare("SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1").get(orderId);
}

export function confirmPayment(orderId) {
  db.prepare("UPDATE payments SET status = 'confirmed', confirmed_at = datetime('now') WHERE order_id = ?").run(orderId);
  db.prepare("UPDATE orders SET payment_status = 'paid', updated_at = datetime('now') WHERE id = ?").run(orderId);
}

// === SATISFACTION ===
export function addSatisfactionRating(customerId, rating, feedback = "", ticketId = null, orderId = null) {
  db.prepare("INSERT INTO satisfaction_ratings (customer_id, ticket_id, order_id, rating, feedback) VALUES (?, ?, ?, ?, ?)").run(customerId, ticketId, orderId, rating, feedback);
  const avg = db.prepare("SELECT AVG(rating) as avg FROM satisfaction_ratings WHERE customer_id = ?").get(customerId);
  db.prepare("UPDATE customers SET satisfaction_avg = ? WHERE id = ?").run(avg.avg || 0, customerId);
}

// === ANALYTICS ===
export function updateDailyAnalytics(data, ownerId = 1) {
  const today = new Date().toISOString().split("T")[0];
  const existing = db.prepare("SELECT * FROM analytics WHERE date = ? AND owner_id = ?").get(today, ownerId);
  if (existing) {
    const fields = Object.keys(data);
    const sets = fields.map(f => `${f} = ${f} + @${f}`).join(", ");
    data.date = today;
    data.owner_id = ownerId;
    db.prepare(`UPDATE analytics SET ${sets} WHERE date = @date AND owner_id = @owner_id`).run(data);
  } else {
    data.date = today;
    data.owner_id = ownerId;
    const fields = Object.keys(data).filter(f => f !== "date" && f !== "owner_id");
    const allFields = ["date", "owner_id", ...fields];
    const placeholders = allFields.map(f => `@${f}`).join(", ");
    db.prepare(`INSERT INTO analytics (${allFields.join(", ")}) VALUES (${placeholders})`).run(data);
  }
}

export function getAnalytics(days = 30, ownerId = null) {
  if (ownerId) return db.prepare("SELECT * FROM analytics WHERE date >= date('now', ? || ' days') AND owner_id = ? ORDER BY date DESC").all(`-${days}`, ownerId);
  return db.prepare("SELECT * FROM analytics WHERE date >= date('now', ? || ' days') ORDER BY date DESC").all(`-${days}`);
}

// === DASHBOARD STATS ===
export function getDashboardStats(ownerId = null, botId = null) {
  let oc = "";
  const ow = [];
  if (ownerId) { oc += " AND owner_id = ?"; ow.push(ownerId); }
  if (botId) { oc += " AND bot_id = ?"; ow.push(botId); }
  const customers = db.prepare(`SELECT COUNT(*) as count FROM customers WHERE 1=1${oc}`).get(...ow);
  const todayCustomers = db.prepare(`SELECT COUNT(*) as count FROM customers WHERE date(first_contact) = date('now')${oc}`).get(...ow);
  const orders = getOrderStats(ownerId, botId);
  const tickets = getTicketStats(ownerId, botId);
  const todayMessages = db.prepare(`SELECT COUNT(*) as count FROM messages_log WHERE date(timestamp) = date('now')${oc}`).get(...ow);
  const todayRevenue = db.prepare(`SELECT SUM(total) as total FROM orders WHERE date(created_at) = date('now') AND payment_status = 'paid'${oc}`).get(...ow);
  const satisfaction = db.prepare("SELECT AVG(rating) as avg FROM satisfaction_ratings").get();
  return {
    total_customers: customers.count,
    new_customers_today: todayCustomers.count,
    orders,
    tickets,
    messages_today: todayMessages.count,
    revenue_today: todayRevenue.total || 0,
    satisfaction_avg: satisfaction.avg ? satisfaction.avg.toFixed(1) : "N/A",
  };
}

// === DASHBOARD USERS ===
export function getDashboardUser(username) {
  return db.prepare("SELECT * FROM dashboard_users WHERE username = ?").get(username);
}

export function getDashboardUserById(id) {
  return db.prepare("SELECT * FROM dashboard_users WHERE id = ?").get(id);
}

export function createDashboardUser(username, hashedPassword, name, role = "admin") {
  db.prepare("INSERT INTO dashboard_users (username, password, name, role) VALUES (?, ?, ?, ?)").run(username, hashedPassword, name, role);
  return db.prepare("SELECT id, username, name, role, created_at FROM dashboard_users WHERE username = ?").get(username);
}

export function dashboardUserExists() {
  return db.prepare("SELECT COUNT(*) as c FROM dashboard_users").get().c > 0;
}

export function updateDashboardPassword(username, hashedPassword) {
  db.prepare("UPDATE dashboard_users SET password = ? WHERE username = ?").run(hashedPassword, username);
}

export function getAllDashboardUsers() {
  return db.prepare("SELECT id, username, name, role, created_at FROM dashboard_users ORDER BY id").all();
}

export function deleteDashboardUser(id) {
  return db.prepare("DELETE FROM dashboard_users WHERE id = ? AND id != 1").run(id);
}

// === IMPORTANT MESSAGES ===
export function addImportantMessage(botId, customerId, customerName, customerJid, message, category, priority, ownerId = 1) {
  db.prepare("INSERT INTO important_messages (bot_id, customer_id, customer_name, customer_jid, message, category, priority, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(botId, customerId, customerName, customerJid, message, category, priority, ownerId);
  return db.prepare("SELECT * FROM important_messages ORDER BY id DESC LIMIT 1").get();
}

export function getAllImportantMessages(botId = null, isRead = null, limit = 100, ownerId = null) {
  let sql = "SELECT * FROM important_messages WHERE 1=1";
  const p = [];
  if (ownerId) { sql += " AND owner_id = ?"; p.push(ownerId); }
  if (botId) { sql += " AND bot_id = ?"; p.push(botId); }
  if (isRead !== null) { sql += " AND is_read = ?"; p.push(isRead); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  p.push(limit);
  return db.prepare(sql).all(...p);
}

export function markImportantRead(id) {
  db.prepare("UPDATE important_messages SET is_read = 1 WHERE id = ?").run(id);
}

export function markAllImportantRead(botId = null, ownerId = null) {
  let sql = "UPDATE important_messages SET is_read = 1 WHERE is_read = 0";
  const p = [];
  if (ownerId) { sql += " AND owner_id = ?"; p.push(ownerId); }
  if (botId) { sql += " AND bot_id = ?"; p.push(botId); }
  db.prepare(sql).run(...p);
}

export function updateImportantNotes(id, notes) {
  db.prepare("UPDATE important_messages SET notes = ? WHERE id = ?").run(notes, id);
}

export function getImportantStats(ownerId = null) {
  const oc = ownerId ? " WHERE owner_id = ?" : "";
  const p = ownerId ? [ownerId] : [];
  return db.prepare(`SELECT
    COUNT(*) as total,
    SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread,
    SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent,
    SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high
  FROM important_messages${oc}`).get(...p);
}

export function deleteImportantMessage(id) {
  db.prepare("DELETE FROM important_messages WHERE id = ?").run(id);
}

// === BOT MANAGEMENT ===
export function addBot(id, ownerId, name, phone = "") {
  db.prepare("INSERT OR REPLACE INTO bots (id, owner_id, name, phone) VALUES (?, ?, ?, ?)").run(id, ownerId, name, phone);
  return db.prepare("SELECT * FROM bots WHERE id = ?").get(id);
}

export function getBot(id) {
  return db.prepare("SELECT * FROM bots WHERE id = ?").get(id);
}

export function getAllBots(ownerId = null) {
  if (ownerId) return db.prepare("SELECT * FROM bots WHERE owner_id = ? AND is_active = 1 ORDER BY created_at").all(ownerId);
  return db.prepare("SELECT * FROM bots WHERE is_active = 1 ORDER BY created_at").all();
}

export function updateBot(id, data) {
  const fields = Object.keys(data).filter(k => k !== "id");
  if (fields.length === 0) return;
  const sets = fields.map(f => `${f} = @${f}`).join(", ");
  data.id = id;
  db.prepare(`UPDATE bots SET ${sets} WHERE id = @id`).run(data);
}

export function deleteBot(id) {
  db.prepare("UPDATE bots SET is_active = 0 WHERE id = ?").run(id);
}

// === BOT ACCESS (sharing bot read-only ke client) ===
export function grantBotAccess(botId, clientUserId, grantedBy) {
  db.prepare("INSERT OR IGNORE INTO bot_access (bot_id, client_user_id, granted_by) VALUES (?, ?, ?)").run(botId, clientUserId, grantedBy);
  return db.prepare("SELECT * FROM bot_access WHERE bot_id = ? AND client_user_id = ?").get(botId, clientUserId);
}

export function revokeBotAccess(botId, clientUserId) {
  return db.prepare("DELETE FROM bot_access WHERE bot_id = ? AND client_user_id = ?").run(botId, clientUserId);
}

export function getBotAccessForBot(botId) {
  return db.prepare(`
    SELECT ba.*, u.username, u.name as client_name
    FROM bot_access ba JOIN dashboard_users u ON ba.client_user_id = u.id
    WHERE ba.bot_id = ?
    ORDER BY ba.created_at DESC
  `).all(botId);
}

export function getGrantedBotsForClient(clientUserId) {
  return db.prepare(`
    SELECT ba.*, b.name as bot_name, b.phone as bot_phone, b.owner_id as bot_owner_id
    FROM bot_access ba JOIN bots b ON ba.bot_id = b.id
    WHERE ba.client_user_id = ?
    ORDER BY ba.created_at DESC
  `).all(clientUserId);
}

export function hasBotAccess(botId, clientUserId) {
  const row = db.prepare("SELECT id FROM bot_access WHERE bot_id = ? AND client_user_id = ?").get(botId, clientUserId);
  return !!row;
}

// === PRODUCT VARIANTS ===
export function addVariant(productId, variantName, sku = null, priceAdjustment = 0, stock = 0) {
  db.prepare("INSERT INTO product_variants (product_id, variant_name, sku, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)").run(productId, variantName, sku, priceAdjustment, stock);
  return db.prepare("SELECT * FROM product_variants WHERE product_id = ? AND variant_name = ?").get(productId, variantName);
}

export function getVariants(productId) {
  return db.prepare("SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1 ORDER BY variant_name").all(productId);
}

export function updateVariant(id, data) {
  const fields = Object.keys(data).filter(k => k !== "id");
  if (fields.length === 0) return;
  const sets = fields.map(f => `${f} = @${f}`).join(", ");
  data.id = id;
  db.prepare(`UPDATE product_variants SET ${sets} WHERE id = @id`).run(data);
}

export function deleteVariant(id) {
  db.prepare("UPDATE product_variants SET is_active = 0 WHERE id = ?").run(id);
}

export function getVariantById(id) {
  return db.prepare("SELECT * FROM product_variants WHERE id = ? AND is_active = 1").get(id);
}

// === VOUCHERS ===
export function createVoucher(data) {
  const params = {
    code: data.code.toUpperCase(),
    discount_type: data.discount_type || "percentage",
    discount_value: data.discount_value || 0,
    min_order: data.min_order || 0,
    max_discount: data.max_discount || 0,
    usage_limit: data.usage_limit || 0,
    valid_until: data.valid_until || null,
    owner_id: data.owner_id || 1,
  };
  db.prepare("INSERT INTO vouchers (code, discount_type, discount_value, min_order, max_discount, usage_limit, valid_until, owner_id) VALUES (@code, @discount_type, @discount_value, @min_order, @max_discount, @usage_limit, @valid_until, @owner_id)").run(params);
  return db.prepare("SELECT * FROM vouchers WHERE code = @code AND owner_id = @owner_id").get(params);
}

export function validateVoucher(code, orderTotal, ownerId = null) {
  let sql = "SELECT * FROM vouchers WHERE code = ? AND is_active = 1";
  const p = [code.toUpperCase()];
  if (ownerId) { sql += " AND owner_id = ?"; p.push(ownerId); }
  const v = db.prepare(sql).get(...p);
  if (!v) return { valid: false, reason: "Kode voucher tidak ditemukan." };
  if (v.valid_until && new Date(v.valid_until) < new Date()) return { valid: false, reason: "Voucher sudah kedaluwarsa." };
  if (v.usage_limit > 0 && v.used_count >= v.usage_limit) return { valid: false, reason: "Voucher sudah habis dipakai." };
  if (v.min_order > 0 && orderTotal < v.min_order) return { valid: false, reason: `Minimum order ${v.min_order} untuk voucher ini.` };
  let discount = 0;
  if (v.discount_type === "percentage") {
    discount = orderTotal * (v.discount_value / 100);
    if (v.max_discount > 0) discount = Math.min(discount, v.max_discount);
  } else {
    discount = v.discount_value;
  }
  discount = Math.min(discount, orderTotal);
  return { valid: true, voucher: v, discount };
}

export function useVoucher(code, ownerId = null) {
  let sql = "UPDATE vouchers SET used_count = used_count + 1 WHERE code = ?";
  const p = [code.toUpperCase()];
  if (ownerId) { sql += " AND owner_id = ?"; p.push(ownerId); }
  db.prepare(sql).run(...p);
}

export function getAllVouchers(ownerId = null) {
  if (ownerId) return db.prepare("SELECT * FROM vouchers WHERE owner_id = ? ORDER BY created_at DESC").all(ownerId);
  return db.prepare("SELECT * FROM vouchers ORDER BY created_at DESC").all();
}

export function deleteVoucher(id) {
  db.prepare("UPDATE vouchers SET is_active = 0 WHERE id = ?").run(id);
}

// === LOW STOCK ===
export function getLowStockProducts(threshold = 5, ownerId = null) {
  let sql = "SELECT * FROM products WHERE is_active = 1 AND stock <= ? AND stock >= 0";
  const p = [threshold];
  if (ownerId) { sql += " AND owner_id = ?"; p.push(ownerId); }
  sql += " ORDER BY stock ASC";
  return db.prepare(sql).all(...p);
}

// === ORDER QUERIES FOR NOTIFICATIONS ===
export function getUnpaidOrdersOlderThan(hours = 24, ownerId = null) {
  let sql = "SELECT o.*, c.jid as customer_jid, c.name as customer_name FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.payment_status = 'unpaid' AND o.status = 'pending' AND datetime(o.created_at, '+' || ? || ' hours') <= datetime('now')";
  const p = [hours];
  if (ownerId) { sql += " AND o.owner_id = ?"; p.push(ownerId); }
  return db.prepare(sql).all(...p);
}

export function getDeliveredOrdersForFollowup(ownerId = null) {
  let sql = "SELECT o.*, c.jid as customer_jid, c.name as customer_name FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.status = 'delivered' AND o.notes NOT LIKE '%[followup_sent]%' AND datetime(o.updated_at, '+2 hours') <= datetime('now')";
  const p = [];
  if (ownerId) { sql += " AND o.owner_id = ?"; p.push(ownerId); }
  return db.prepare(sql).all(...p);
}

export function markFollowupSent(orderNumber) {
  db.prepare("UPDATE orders SET notes = notes || ' [followup_sent]' WHERE order_number = ?").run(orderNumber);
}

// === LOYALTY POINTS ===
export function addLoyaltyPoints(customerId, points, reason = "", orderId = null, ownerId = 1) {
  db.prepare("INSERT INTO loyalty_points (customer_id, points, reason, order_id, owner_id) VALUES (?, ?, ?, ?, ?)").run(customerId, points, reason, orderId, ownerId);
  db.prepare("UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?").run(points, customerId);
  return db.prepare("SELECT loyalty_points FROM customers WHERE id = ?").get(customerId);
}

export function redeemLoyaltyPoints(customerId, points) {
  const c = db.prepare("SELECT loyalty_points FROM customers WHERE id = ?").get(customerId);
  if (!c || c.loyalty_points < points) return { success: false, reason: "Poin tidak cukup." };
  db.prepare("INSERT INTO loyalty_points (customer_id, points, reason) VALUES (?, ?, 'Penukaran poin')").run(customerId, -points);
  db.prepare("UPDATE customers SET loyalty_points = loyalty_points - ? WHERE id = ?").run(points, customerId);
  return { success: true, remaining: c.loyalty_points - points };
}

export function getLoyaltyHistory(customerId, limit = 20) {
  return db.prepare("SELECT * FROM loyalty_points WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?").all(customerId, limit);
}

export function getLoyaltySettings(ownerId = 1) {
  let s = db.prepare("SELECT * FROM loyalty_settings WHERE owner_id = ?").get(ownerId);
  if (!s) {
    db.prepare("INSERT INTO loyalty_settings (owner_id) VALUES (?)").run(ownerId);
    s = db.prepare("SELECT * FROM loyalty_settings WHERE owner_id = ?").get(ownerId);
  }
  return s;
}

export function updateLoyaltySettings(data, ownerId = 1) {
  const fields = Object.keys(data).filter(k => k !== "id" && k !== "owner_id");
  const sets = fields.map(f => `${f} = @${f}`).join(", ");
  data.oid = ownerId;
  return db.prepare(`UPDATE loyalty_settings SET ${sets} WHERE owner_id = @oid`).run(data);
}

// === REFERRALS ===
export function generateReferralCode(customerId) {
  const existing = db.prepare("SELECT referral_code FROM customers WHERE id = ? AND referral_code != ''").get(customerId);
  if (existing?.referral_code) return existing.referral_code;
  const code = "REF" + Math.random().toString(36).substring(2, 8).toUpperCase();
  db.prepare("UPDATE customers SET referral_code = ? WHERE id = ?").run(code, customerId);
  return code;
}

export function applyReferral(referrerCode, newCustomerId, ownerId = 1) {
  const referrer = db.prepare("SELECT id FROM customers WHERE referral_code = ? AND owner_id = ?").get(referrerCode, ownerId);
  if (!referrer) return { success: false, reason: "Kode referral tidak ditemukan." };
  if (referrer.id === newCustomerId) return { success: false, reason: "Tidak bisa referral diri sendiri." };
  const exists = db.prepare("SELECT id FROM referrals WHERE referred_id = ?").get(newCustomerId);
  if (exists) return { success: false, reason: "Customer sudah pernah menggunakan referral." };
  db.prepare("INSERT INTO referrals (referrer_id, referred_id, referral_code, owner_id) VALUES (?, ?, ?, ?)").run(referrer.id, newCustomerId, referrerCode, ownerId);
  return { success: true, referrerId: referrer.id };
}

export function getReferralStats(customerId) {
  const count = db.prepare("SELECT COUNT(*) as c FROM referrals WHERE referrer_id = ?").get(customerId);
  const rewarded = db.prepare("SELECT COUNT(*) as c FROM referrals WHERE referrer_id = ? AND reward_given = 1").get(customerId);
  return { total: count.c, rewarded: rewarded.c };
}

export function markReferralRewarded(referredId) {
  db.prepare("UPDATE referrals SET reward_given = 1 WHERE referred_id = ?").run(referredId);
}

export function getAllReferrals(ownerId = null, limit = 50) {
  let sql = `SELECT r.*, c1.name as referrer_name, c1.jid as referrer_jid, c2.name as referred_name, c2.jid as referred_jid
    FROM referrals r JOIN customers c1 ON r.referrer_id = c1.id JOIN customers c2 ON r.referred_id = c2.id WHERE 1=1`;
  const p = [];
  if (ownerId) { sql += " AND r.owner_id = ?"; p.push(ownerId); }
  sql += " ORDER BY r.created_at DESC LIMIT ?";
  p.push(limit);
  return db.prepare(sql).all(...p);
}

// === CUSTOMER ADDRESSES ===
export function addCustomerAddress(customerId, label, address, isDefault = 0) {
  if (isDefault) db.prepare("UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?").run(customerId);
  db.prepare("INSERT INTO customer_addresses (customer_id, label, address, is_default) VALUES (?, ?, ?, ?)").run(customerId, label, address, isDefault ? 1 : 0);
  return db.prepare("SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY id DESC LIMIT 1").get(customerId);
}

export function getCustomerAddresses(customerId) {
  return db.prepare("SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, id DESC").all(customerId);
}

export function deleteCustomerAddress(id) {
  db.prepare("DELETE FROM customer_addresses WHERE id = ?").run(id);
}

export function setDefaultAddress(id, customerId) {
  db.prepare("UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?").run(customerId);
  db.prepare("UPDATE customer_addresses SET is_default = 1 WHERE id = ?").run(id);
}

// === PRODUCT BUNDLES ===
export function createBundle(name, description, bundlePrice, ownerId = 1) {
  db.prepare("INSERT INTO product_bundles (name, description, bundle_price, owner_id) VALUES (?, ?, ?, ?)").run(name, description || "", bundlePrice, ownerId);
  return db.prepare("SELECT * FROM product_bundles WHERE owner_id = ? ORDER BY id DESC LIMIT 1").get(ownerId);
}

export function addBundleItem(bundleId, productId, qty = 1) {
  db.prepare("INSERT INTO bundle_items (bundle_id, product_id, qty) VALUES (?, ?, ?)").run(bundleId, productId, qty);
}

export function getBundleWithItems(bundleId) {
  const bundle = db.prepare("SELECT * FROM product_bundles WHERE id = ? AND is_active = 1").get(bundleId);
  if (!bundle) return null;
  bundle.items = db.prepare("SELECT bi.*, p.name as product_name, p.price as product_price FROM bundle_items bi JOIN products p ON bi.product_id = p.id WHERE bi.bundle_id = ?").all(bundleId);
  return bundle;
}

export function getAllBundles(ownerId = null) {
  let sql = "SELECT pb.*, (SELECT SUM(p.price * bi.qty) FROM bundle_items bi JOIN products p ON bi.product_id = p.id WHERE bi.bundle_id = pb.id) as original_price FROM product_bundles pb WHERE pb.is_active = 1";
  const p = [];
  if (ownerId) { sql += " AND pb.owner_id = ?"; p.push(ownerId); }
  sql += " ORDER BY pb.name";
  return db.prepare(sql).all(...p);
}

export function deleteBundle(id) {
  db.prepare("UPDATE product_bundles SET is_active = 0 WHERE id = ?").run(id);
}

export function deleteBundleItem(id) {
  db.prepare("DELETE FROM bundle_items WHERE id = ?").run(id);
}

// === LEAD SCORING ===
export function updateLeadScore(customerId) {
  const c = db.prepare("SELECT total_orders, total_spent, satisfaction_avg FROM customers WHERE id = ?").get(customerId);
  if (!c) return;
  let score = 0;
  score += Math.min(c.total_orders * 10, 40);
  score += Math.min(Math.floor(c.total_spent / 100000) * 5, 30);
  if (c.satisfaction_avg >= 4) score += 20;
  else if (c.satisfaction_avg >= 3) score += 10;
  const recentOrder = db.prepare("SELECT COUNT(*) as c FROM orders WHERE customer_id = ? AND created_at >= datetime('now', '-30 days')").get(customerId);
  if (recentOrder.c > 0) score += 10;
  let tier = "cold";
  if (score >= 70) tier = "hot";
  else if (score >= 40) tier = "warm";
  db.prepare("UPDATE customers SET lead_score = ?, lead_tier = ? WHERE id = ?").run(score, tier, customerId);
  return { score, tier };
}

export function getCustomersByLeadTier(tier, ownerId = null) {
  let sql = "SELECT * FROM customers WHERE lead_tier = ?";
  const p = [tier];
  if (ownerId) { sql += " AND owner_id = ?"; p.push(ownerId); }
  sql += " ORDER BY lead_score DESC";
  return db.prepare(sql).all(...p);
}

// === SENTIMENT ===
export function logSentiment(messageLogId, sentiment, score) {
  db.prepare("UPDATE messages_log SET sentiment = ?, sentiment_score = ? WHERE id = ?").run(sentiment, score, messageLogId);
}

export function getCustomerSentimentAvg(customerId) {
  const r = db.prepare("SELECT AVG(sentiment_score) as avg FROM messages_log WHERE customer_id = ? AND sentiment_score IS NOT NULL").get(customerId);
  return r?.avg || 0;
}

// === CUSTOMER TIMELINE ===
export function getCustomerTimeline(customerId, limit = 30) {
  const msgs = db.prepare("SELECT 'message' as type, content as detail, direction, timestamp as ts FROM messages_log WHERE customer_id = ? ORDER BY timestamp DESC LIMIT ?").all(customerId, limit);
  const orders = db.prepare("SELECT 'order' as type, order_number || ' - ' || status as detail, 'system' as direction, created_at as ts FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10").all(customerId);
  const tickets = db.prepare("SELECT 'ticket' as type, ticket_number || ' - ' || subject as detail, 'system' as direction, created_at as ts FROM tickets WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10").all(customerId);
  const ratings = db.prepare("SELECT 'rating' as type, rating || '/5 - ' || COALESCE(feedback,'') as detail, 'system' as direction, created_at as ts FROM satisfaction_ratings WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10").all(customerId);
  const all = [...msgs, ...orders, ...tickets, ...ratings].sort((a, b) => b.ts.localeCompare(a.ts));
  return all.slice(0, limit);
}

// === BROADCAST SEGMENTS ===
export function getCustomersBySegment(segment, ownerId = null) {
  let base = "SELECT * FROM customers WHERE is_blocked = 0";
  const p = [];
  if (ownerId) { base += " AND owner_id = ?"; p.push(ownerId); }
  if (segment === "new_30d") base += " AND first_contact >= datetime('now', '-30 days')";
  else if (segment === "inactive_30d") base += " AND last_contact < datetime('now', '-30 days')";
  else if (segment === "repeat_buyers") base += " AND total_orders >= 2";
  else if (segment === "high_spenders") base += " AND total_spent >= 500000";
  else if (segment === "hot_leads") base += " AND lead_tier = 'hot'";
  else if (segment === "warm_leads") base += " AND lead_tier = 'warm'";
  else if (segment === "cold_leads") base += " AND lead_tier = 'cold'";
  else if (segment === "low_satisfaction") base += " AND satisfaction_avg > 0 AND satisfaction_avg < 3";
  return db.prepare(base).all(...p);
}

// === PAYMENT METHODS ===
export function addPaymentMethod(data) {
  db.prepare("INSERT INTO payment_methods (name, type, account_number, account_name, instructions, owner_id) VALUES (?, ?, ?, ?, ?, ?)").run(data.name, data.type || "bank_transfer", data.account_number || "", data.account_name || "", data.instructions || "", data.owner_id || 1);
  return db.prepare("SELECT * FROM payment_methods ORDER BY id DESC LIMIT 1").get();
}

export function getAllPaymentMethods(ownerId = null) {
  if (ownerId) return db.prepare("SELECT * FROM payment_methods WHERE owner_id = ? AND is_active = 1 ORDER BY name").all(ownerId);
  return db.prepare("SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY name").all();
}

export function deletePaymentMethod(id) {
  db.prepare("UPDATE payment_methods SET is_active = 0 WHERE id = ?").run(id);
}

export function updatePaymentMethod(id, data) {
  const fields = Object.keys(data).filter(k => k !== "id" && k !== "owner_id");
  if (fields.length === 0) return;
  const sets = fields.map(f => `${f} = @${f}`).join(", ");
  data.id = id;
  db.prepare(`UPDATE payment_methods SET ${sets} WHERE id = @id`).run(data);
}

// === AUTOMATION RULES ===
export function createAutomationRule(data) {
  db.prepare(`INSERT INTO automation_rules (owner_id, name, trigger_type, trigger_config, action_type, action_config, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    data.owner_id || 1, data.name, data.trigger_type,
    JSON.stringify(data.trigger_config || {}),
    data.action_type,
    JSON.stringify(data.action_config || {}),
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1
  );
  return db.prepare("SELECT * FROM automation_rules WHERE owner_id = ? ORDER BY id DESC LIMIT 1").get(data.owner_id || 1);
}

export function getAllAutomationRules(ownerId = null) {
  if (ownerId) return db.prepare("SELECT * FROM automation_rules WHERE owner_id = ? ORDER BY created_at DESC").all(ownerId);
  return db.prepare("SELECT * FROM automation_rules ORDER BY created_at DESC").all();
}

export function getActiveAutomationRules(ownerId = null) {
  if (ownerId) return db.prepare("SELECT * FROM automation_rules WHERE owner_id = ? AND is_active = 1 ORDER BY id").all(ownerId);
  return db.prepare("SELECT * FROM automation_rules WHERE is_active = 1 ORDER BY id").all();
}

export function updateAutomationRule(id, data) {
  const fields = Object.keys(data).filter(k => k !== "id" && k !== "owner_id");
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (f === "trigger_config" || f === "action_config") {
      updates.push(`${f} = ?`);
      values.push(JSON.stringify(data[f]));
    } else if (f === "is_active") {
      updates.push(`${f} = ?`);
      values.push(data[f] ? 1 : 0);
    } else {
      updates.push(`${f} = ?`);
      values.push(data[f]);
    }
  }
  if (updates.length === 0) return;
  updates.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE automation_rules SET ${updates.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteAutomationRule(id) {
  db.prepare("DELETE FROM automation_rules WHERE id = ?").run(id);
}

export function incrementRuleExecution(id) {
  db.prepare("UPDATE automation_rules SET execution_count = execution_count + 1, last_executed_at = datetime('now') WHERE id = ?").run(id);
}

export function logRuleExecution(ruleId, customerJid, result) {
  db.prepare("INSERT INTO automation_log (rule_id, customer_jid, result) VALUES (?, ?, ?)").run(ruleId, customerJid || "", result || "success");
}

export function getAutomationLog(ownerId = null, limit = 100) {
  let sql = `SELECT al.*, ar.name as rule_name FROM automation_log al
    JOIN automation_rules ar ON al.rule_id = ar.id WHERE 1=1`;
  const p = [];
  if (ownerId) { sql += " AND ar.owner_id = ?"; p.push(ownerId); }
  sql += " ORDER BY al.executed_at DESC LIMIT ?";
  p.push(limit);
  return db.prepare(sql).all(...p);
}

// === HANDOFFS ===
export function createHandoff(data) {
  db.prepare(`INSERT INTO handoffs (owner_id, bot_id, customer_id, customer_jid, customer_name, agent_jid, agent_name, reason, chat_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    data.ownerId || 1, data.botId || "", data.customerId || null,
    data.customerJid, data.customerName || "", data.agentJid,
    data.agentName || "", data.reason || "", data.chatSummary || ""
  );
  return db.prepare("SELECT * FROM handoffs ORDER BY id DESC LIMIT 1").get();
}

export function getAllHandoffs(ownerId = null, status = null, limit = 50) {
  let sql = "SELECT * FROM handoffs WHERE 1=1";
  const p = [];
  if (ownerId) { sql += " AND owner_id = ?"; p.push(ownerId); }
  if (status) { sql += " AND status = ?"; p.push(status); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  p.push(limit);
  return db.prepare(sql).all(...p);
}

export function updateHandoffStatus(id, status) {
  const resolvedAt = status === "resolved" ? "datetime('now')" : "NULL";
  db.prepare(`UPDATE handoffs SET status = ?, resolved_at = ${resolvedAt} WHERE id = ?`).run(status, id);
}

export function getHandoffStats(ownerId = null) {
  const oc = ownerId ? " WHERE owner_id = ?" : "";
  const p = ownerId ? [ownerId] : [];
  return db.prepare(`SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
    SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
  FROM handoffs${oc}`).get(...p);
}

// === SHARED INBOX (Chat Assignments) ===
export function upsertChatAssignment(data) {
  const existing = db.prepare("SELECT id FROM chat_assignments WHERE customer_jid = ? AND owner_id = ?").get(data.customerJid, data.ownerId || 1);
  if (existing) {
    db.prepare("UPDATE chat_assignments SET customer_name = ?, last_message = ?, last_message_at = datetime('now'), bot_id = ? WHERE id = ?")
      .run(data.customerName || "", (data.lastMessage || "").slice(0, 500), data.botId || "", existing.id);
    return db.prepare("SELECT * FROM chat_assignments WHERE id = ?").get(existing.id);
  }
  db.prepare(`INSERT INTO chat_assignments (owner_id, bot_id, customer_jid, customer_name, last_message)
    VALUES (?, ?, ?, ?, ?)`).run(data.ownerId || 1, data.botId || "", data.customerJid, data.customerName || "", (data.lastMessage || "").slice(0, 500));
  return db.prepare("SELECT * FROM chat_assignments WHERE customer_jid = ? AND owner_id = ?").get(data.customerJid, data.ownerId || 1);
}

export function assignChat(id, agentJid, agentName) {
  db.prepare("UPDATE chat_assignments SET agent_jid = ?, agent_name = ?, status = 'assigned', assigned_at = datetime('now') WHERE id = ?")
    .run(agentJid, agentName || "", id);
  return db.prepare("SELECT * FROM chat_assignments WHERE id = ?").get(id);
}

export function unassignChat(id) {
  db.prepare("UPDATE chat_assignments SET agent_jid = '', agent_name = '', status = 'unassigned', assigned_at = NULL WHERE id = ?").run(id);
}

export function resolveChat(id) {
  db.prepare("UPDATE chat_assignments SET status = 'resolved' WHERE id = ?").run(id);
}

export function getAllChatAssignments(ownerId = null, status = null, agentJid = null) {
  let sql = "SELECT * FROM chat_assignments WHERE 1=1";
  const p = [];
  if (ownerId) { sql += " AND owner_id = ?"; p.push(ownerId); }
  if (status) { sql += " AND status = ?"; p.push(status); }
  if (agentJid) { sql += " AND agent_jid = ?"; p.push(agentJid); }
  sql += " ORDER BY last_message_at DESC";
  return db.prepare(sql).all(...p);
}

export function getChatAssignment(customerJid, ownerId) {
  return db.prepare("SELECT * FROM chat_assignments WHERE customer_jid = ? AND owner_id = ?").get(customerJid, ownerId);
}

export function getInboxStats(ownerId = null) {
  const oc = ownerId ? " WHERE owner_id = ?" : "";
  const p = ownerId ? [ownerId] : [];
  return db.prepare(`SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status = 'unassigned' THEN 1 ELSE 0 END) as unassigned,
    SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned,
    SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
  FROM chat_assignments${oc}`).get(...p);
}
