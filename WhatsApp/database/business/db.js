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

// === REPAIR: perbaiki FOREIGN KEY yang nyangkut ke tabel _old hasil migrasi lama ===
function repairDanglingForeignKeys() {
  const renamedTables = ["customers", "products", "templates", "agents", "business_profile"];
  const dependentTables = db.prepare(
    "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND sql LIKE '%_old(%'",
  ).all();

  if (dependentTables.length === 0) return;

  console.log("[DB] Memperbaiki foreign key yang rusak akibat migrasi sebelumnya...");
  db.pragma("foreign_keys = OFF");
  db.pragma("legacy_alter_table = ON");

  for (const { name, sql } of dependentTables) {
    let fixedSql = sql;
    for (const t of renamedTables) {
      fixedSql = fixedSql.replace(new RegExp(`_${t}_old\\(`, "g"), `${t}(`);
    }
    fixedSql = fixedSql.replace(/_bp_old\(/g, "business_profile(");
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
`);

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
export function getOrCreateCustomer(jid, name = "", ownerId = 1) {
  let c = db.prepare("SELECT * FROM customers WHERE jid = ? AND owner_id = ?").get(jid, ownerId);
  if (!c) {
    const phone = jid.split("@")[0];
    db.prepare("INSERT INTO customers (jid, phone, name, owner_id) VALUES (?, ?, ?, ?)").run(jid, phone, name, ownerId);
    c = db.prepare("SELECT * FROM customers WHERE jid = ? AND owner_id = ?").get(jid, ownerId);
  } else if (name && c.name !== name) {
    db.prepare("UPDATE customers SET name = ?, last_contact = datetime('now') WHERE jid = ? AND owner_id = ?").run(name, jid, ownerId);
    c.name = name;
  } else {
    db.prepare("UPDATE customers SET last_contact = datetime('now') WHERE jid = ? AND owner_id = ?").run(jid, ownerId);
  }
  return c;
}

export function getCustomer(jid, ownerId = null) {
  if (ownerId) return db.prepare("SELECT * FROM customers WHERE jid = ? AND owner_id = ?").get(jid, ownerId);
  return db.prepare("SELECT * FROM customers WHERE jid = ?").get(jid);
}

export function updateCustomer(id, data) {
  const fields = Object.keys(data).filter(k => k !== "id" && k !== "owner_id");
  const sets = fields.map(f => `${f} = @${f}`).join(", ");
  data.id = id;
  return db.prepare(`UPDATE customers SET ${sets} WHERE id = @id`).run(data);
}

export function getAllCustomers(limit = 100, offset = 0, ownerId = null) {
  if (ownerId) return db.prepare("SELECT * FROM customers WHERE owner_id = ? ORDER BY last_contact DESC LIMIT ? OFFSET ?").all(ownerId, limit, offset);
  return db.prepare("SELECT * FROM customers ORDER BY last_contact DESC LIMIT ? OFFSET ?").all(limit, offset);
}

export function searchCustomers(query, ownerId = null) {
  const q = `%${query}%`;
  if (ownerId) return db.prepare("SELECT * FROM customers WHERE owner_id = ? AND (name LIKE ? OR phone LIKE ? OR jid LIKE ?)").all(ownerId, q, q, q);
  return db.prepare("SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR jid LIKE ?").all(q, q, q);
}

export function getCustomerCount(ownerId = null) {
  if (ownerId) return db.prepare("SELECT COUNT(*) as count FROM customers WHERE owner_id = ?").get(ownerId).count;
  return db.prepare("SELECT COUNT(*) as count FROM customers").get().count;
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

export function createOrder(customerId, items, total, notes = "", shippingAddress = "", ownerId = 1) {
  const orderNumber = generateOrderNumber();
  const itemsJson = JSON.stringify(items);
  const subtotal = items.reduce((s, i) => s + (i.price * i.qty), 0);
  db.prepare("INSERT INTO orders (order_number, customer_id, items, subtotal, total, notes, shipping_address, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(orderNumber, customerId, itemsJson, subtotal, total, notes, shippingAddress, ownerId);
  db.prepare("UPDATE customers SET total_orders = total_orders + 1 WHERE id = ?").run(customerId);
  return db.prepare("SELECT * FROM orders WHERE order_number = ?").get(orderNumber);
}

export function getOrder(orderNumber) {
  return db.prepare("SELECT o.*, c.name as customer_name, c.jid as customer_jid FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.order_number = ?").get(orderNumber);
}

export function getOrderById(id) {
  return db.prepare("SELECT o.*, c.name as customer_name, c.jid as customer_jid FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.id = ?").get(id);
}

export function updateOrderStatus(orderNumber, status) {
  return db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE order_number = ?").run(status, orderNumber);
}

export function getCustomerOrders(customerId) {
  return db.prepare("SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC").all(customerId);
}

export function getAllOrders(status = null, limit = 50, ownerId = null) {
  let sql = "SELECT o.*, c.name as customer_name, c.jid as customer_jid FROM orders o JOIN customers c ON o.customer_id = c.id WHERE 1=1";
  const p = [];
  if (ownerId) { sql += " AND o.owner_id = ?"; p.push(ownerId); }
  if (status) { sql += " AND o.status = ?"; p.push(status); }
  sql += " ORDER BY o.created_at DESC LIMIT ?";
  p.push(limit);
  return db.prepare(sql).all(...p);
}

export function getOrderStats(ownerId = null) {
  const oc = ownerId ? " WHERE owner_id = ?" : "";
  const p = ownerId ? [ownerId] : [];
  return db.prepare(`SELECT
    COUNT(*) as total_orders,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
    SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
    SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped,
    SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
    SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END) as total_revenue
  FROM orders${oc}`).get(...p);
}

// === TICKETS ===
function generateTicketNumber() {
  const count = db.prepare("SELECT COUNT(*) as c FROM tickets").get().c;
  return `TKT-${String(count + 1).padStart(5, "0")}`;
}

export function createTicket(customerId, subject, description = "", priority = "medium", ownerId = 1) {
  const ticketNumber = generateTicketNumber();
  db.prepare("INSERT INTO tickets (ticket_number, customer_id, subject, description, priority, owner_id) VALUES (?, ?, ?, ?, ?, ?)").run(ticketNumber, customerId, subject, description, priority, ownerId);
  return db.prepare("SELECT * FROM tickets WHERE ticket_number = ?").get(ticketNumber);
}

export function getTicket(ticketNumber) {
  return db.prepare("SELECT t.*, c.name as customer_name, c.jid as customer_jid FROM tickets t JOIN customers c ON t.customer_id = c.id WHERE t.ticket_number = ?").get(ticketNumber);
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

export function getAllTickets(status = null, limit = 50, ownerId = null) {
  let sql = "SELECT t.*, c.name as customer_name FROM tickets t JOIN customers c ON t.customer_id = c.id WHERE 1=1";
  const p = [];
  if (ownerId) { sql += " AND t.owner_id = ?"; p.push(ownerId); }
  if (status) { sql += " AND t.status = ?"; p.push(status); }
  sql += " ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END, t.created_at DESC LIMIT ?";
  p.push(limit);
  return db.prepare(sql).all(...p);
}

export function getTicketStats(ownerId = null) {
  const oc = ownerId ? " WHERE owner_id = ?" : "";
  const p = ownerId ? [ownerId] : [];
  return db.prepare(`SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_tickets,
    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
    SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
    SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed
  FROM tickets${oc}`).get(...p);
}

// === MESSAGES ===
export function logMessage(customerId, direction, content, messageType = "text", ownerId = 1) {
  db.prepare("INSERT INTO messages_log (customer_id, direction, message_type, content, owner_id) VALUES (?, ?, ?, ?, ?)").run(customerId, direction, messageType, content, ownerId);
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

export function updateBroadcastStatus(id, status, sentCount = 0) {
  return db.prepare("UPDATE broadcasts SET status = ?, sent_count = ?, sent_at = datetime('now') WHERE id = ?").run(status, sentCount, id);
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
export function getDashboardStats(ownerId = null) {
  const oc = ownerId ? " AND owner_id = ?" : "";
  const ow = ownerId ? [ownerId] : [];
  const customers = db.prepare(`SELECT COUNT(*) as count FROM customers WHERE 1=1${oc}`).get(...ow);
  const todayCustomers = db.prepare(`SELECT COUNT(*) as count FROM customers WHERE date(first_contact) = date('now')${oc}`).get(...ow);
  const orders = getOrderStats(ownerId);
  const tickets = getTicketStats(ownerId);
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
