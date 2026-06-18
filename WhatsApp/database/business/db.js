import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "business.db");

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS business_profile (
    id INTEGER PRIMARY KEY DEFAULT 1,
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
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jid TEXT UNIQUE NOT NULL,
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
    is_blocked INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price REAL NOT NULL DEFAULT 0,
    discount_price REAL DEFAULT 0,
    category TEXT DEFAULT 'Umum',
    stock INTEGER DEFAULT 0,
    image_url TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    customer_id INTEGER,
    direction TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    content TEXT DEFAULT '',
    timestamp TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS faq (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    name TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'Umum',
    variables TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'agent',
    is_online INTEGER DEFAULT 0,
    active_chats INTEGER DEFAULT 0,
    total_handled INTEGER DEFAULT 0,
    avg_response_time REAL DEFAULT 0,
    rating_avg REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS broadcasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

  CREATE TABLE IF NOT EXISTS dashboard_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_customers_jid ON customers(jid);
  CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
  CREATE INDEX IF NOT EXISTS idx_tickets_customer ON tickets(customer_id);
  CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
  CREATE INDEX IF NOT EXISTS idx_tickets_number ON tickets(ticket_number);
  CREATE INDEX IF NOT EXISTS idx_messages_customer ON messages_log(customer_id);
  CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
`);

const profileExists = db.prepare("SELECT COUNT(*) as c FROM business_profile").get();
if (profileExists.c === 0) {
  db.prepare("INSERT INTO business_profile (id) VALUES (1)").run();
}

export default db;

export function getProfile() {
  return db.prepare("SELECT * FROM business_profile WHERE id = 1").get();
}

export function updateProfile(data) {
  const fields = Object.keys(data).filter(k => k !== "id");
  const sets = fields.map(f => `${f} = @${f}`).join(", ");
  return db.prepare(`UPDATE business_profile SET ${sets}, updated_at = datetime('now') WHERE id = 1`).run(data);
}

export function getOrCreateCustomer(jid, name = "") {
  let customer = db.prepare("SELECT * FROM customers WHERE jid = ?").get(jid);
  if (!customer) {
    const phone = jid.split("@")[0];
    db.prepare("INSERT INTO customers (jid, phone, name) VALUES (?, ?, ?)").run(jid, phone, name);
    customer = db.prepare("SELECT * FROM customers WHERE jid = ?").get(jid);
  } else if (name && customer.name !== name) {
    db.prepare("UPDATE customers SET name = ?, last_contact = datetime('now') WHERE jid = ?").run(name, jid);
    customer.name = name;
  } else {
    db.prepare("UPDATE customers SET last_contact = datetime('now') WHERE jid = ?").run(jid);
  }
  return customer;
}

export function getCustomer(jid) {
  return db.prepare("SELECT * FROM customers WHERE jid = ?").get(jid);
}

export function updateCustomer(id, data) {
  const fields = Object.keys(data).filter(k => k !== "id");
  const sets = fields.map(f => `${f} = @${f}`).join(", ");
  data.id = id;
  return db.prepare(`UPDATE customers SET ${sets} WHERE id = @id`).run(data);
}

export function getAllCustomers(limit = 100, offset = 0) {
  return db.prepare("SELECT * FROM customers ORDER BY last_contact DESC LIMIT ? OFFSET ?").all(limit, offset);
}

export function searchCustomers(query) {
  const q = `%${query}%`;
  return db.prepare("SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR jid LIKE ?").all(q, q, q);
}

export function getCustomerCount() {
  return db.prepare("SELECT COUNT(*) as count FROM customers").get().count;
}

export function addProduct(data) {
  const stmt = db.prepare(`INSERT INTO products (sku, name, description, price, discount_price, category, stock, image_url) VALUES (@sku, @name, @description, @price, @discount_price, @category, @stock, @image_url)`);
  return stmt.run(data);
}

export function updateProduct(id, data) {
  const fields = Object.keys(data).filter(k => k !== "id");
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

export function getProductBySku(sku) {
  return db.prepare("SELECT * FROM products WHERE sku = ? AND is_active = 1").get(sku);
}

export function getAllProducts(category = null) {
  if (category) {
    return db.prepare("SELECT * FROM products WHERE is_active = 1 AND category = ? ORDER BY name").all(category);
  }
  return db.prepare("SELECT * FROM products WHERE is_active = 1 ORDER BY category, name").all();
}

export function getProductCategories() {
  return db.prepare("SELECT DISTINCT category FROM products WHERE is_active = 1 ORDER BY category").all().map(r => r.category);
}

export function searchProducts(query) {
  const q = `%${query}%`;
  return db.prepare("SELECT * FROM products WHERE is_active = 1 AND (name LIKE ? OR description LIKE ? OR sku LIKE ?)").all(q, q, q);
}

function generateOrderNumber() {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const count = db.prepare("SELECT COUNT(*) as c FROM orders WHERE date(created_at) = date('now')").get().c;
  return `ORD-${y}${m}${d}-${String(count + 1).padStart(4, "0")}`;
}

export function createOrder(customerId, items, total, notes = "", shippingAddress = "") {
  const orderNumber = generateOrderNumber();
  const itemsJson = JSON.stringify(items);
  const subtotal = items.reduce((sum, i) => sum + (i.price * i.qty), 0);
  const stmt = db.prepare(`INSERT INTO orders (order_number, customer_id, items, subtotal, total, notes, shipping_address) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  stmt.run(orderNumber, customerId, itemsJson, subtotal, total, notes, shippingAddress);
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

export function getAllOrders(status = null, limit = 50) {
  if (status) {
    return db.prepare("SELECT o.*, c.name as customer_name, c.jid as customer_jid FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.status = ? ORDER BY o.created_at DESC LIMIT ?").all(status, limit);
  }
  return db.prepare("SELECT o.*, c.name as customer_name, c.jid as customer_jid FROM orders o JOIN customers c ON o.customer_id = c.id ORDER BY o.created_at DESC LIMIT ?").all(limit);
}

export function getOrderStats() {
  return db.prepare(`SELECT
    COUNT(*) as total_orders,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
    SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
    SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped,
    SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
    SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END) as total_revenue
  FROM orders`).get();
}

function generateTicketNumber() {
  const count = db.prepare("SELECT COUNT(*) as c FROM tickets").get().c;
  return `TKT-${String(count + 1).padStart(5, "0")}`;
}

export function createTicket(customerId, subject, description = "", priority = "medium") {
  const ticketNumber = generateTicketNumber();
  db.prepare(`INSERT INTO tickets (ticket_number, customer_id, subject, description, priority) VALUES (?, ?, ?, ?, ?)`).run(ticketNumber, customerId, subject, description, priority);
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

export function getAllTickets(status = null, limit = 50) {
  if (status) {
    return db.prepare("SELECT t.*, c.name as customer_name FROM tickets t JOIN customers c ON t.customer_id = c.id WHERE t.status = ? ORDER BY t.created_at DESC LIMIT ?").all(status, limit);
  }
  return db.prepare("SELECT t.*, c.name as customer_name FROM tickets t JOIN customers c ON t.customer_id = c.id ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END, t.created_at DESC LIMIT ?").all(limit);
}

export function getTicketStats() {
  return db.prepare(`SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_tickets,
    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
    SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
    SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed
  FROM tickets`).get();
}

export function logMessage(customerId, direction, content, messageType = "text") {
  db.prepare("INSERT INTO messages_log (customer_id, direction, message_type, content) VALUES (?, ?, ?, ?)").run(customerId, direction, messageType, content);
}

export function getMessageLogs(customerId, limit = 50) {
  return db.prepare("SELECT * FROM messages_log WHERE customer_id = ? ORDER BY timestamp DESC LIMIT ?").all(customerId, limit);
}

export function addFaq(question, answer, keywords = [], category = "Umum") {
  db.prepare("INSERT INTO faq (question, answer, keywords, category) VALUES (?, ?, ?, ?)").run(question, answer, JSON.stringify(keywords), category);
}

export function getAllFaq() {
  return db.prepare("SELECT * FROM faq WHERE is_active = 1 ORDER BY hit_count DESC").all();
}

export function searchFaq(query) {
  const q = `%${query}%`;
  const results = db.prepare("SELECT * FROM faq WHERE is_active = 1 AND (question LIKE ? OR answer LIKE ? OR keywords LIKE ?)").all(q, q, q);
  if (results.length > 0) {
    db.prepare("UPDATE faq SET hit_count = hit_count + 1 WHERE id = ?").run(results[0].id);
  }
  return results;
}

export function deleteFaq(id) {
  return db.prepare("UPDATE faq SET is_active = 0 WHERE id = ?").run(id);
}

export function addTemplate(name, content, category = "Umum", variables = []) {
  db.prepare("INSERT INTO templates (name, content, category, variables) VALUES (?, ?, ?, ?)").run(name, content, category, JSON.stringify(variables));
}

export function getTemplate(name) {
  return db.prepare("SELECT * FROM templates WHERE name = ?").get(name);
}

export function getAllTemplates() {
  return db.prepare("SELECT * FROM templates ORDER BY category, name").all();
}

export function deleteTemplate(name) {
  return db.prepare("DELETE FROM templates WHERE name = ?").run(name);
}

export function addAgent(jid, name, role = "agent") {
  db.prepare("INSERT OR IGNORE INTO agents (jid, name, role) VALUES (?, ?, ?)").run(jid, name, role);
  return db.prepare("SELECT * FROM agents WHERE jid = ?").get(jid);
}

export function getAgent(jid) {
  return db.prepare("SELECT * FROM agents WHERE jid = ?").get(jid);
}

export function getAllAgents() {
  return db.prepare("SELECT * FROM agents ORDER BY name").all();
}

export function updateAgentStatus(jid, isOnline) {
  return db.prepare("UPDATE agents SET is_online = ? WHERE jid = ?").run(isOnline ? 1 : 0, jid);
}

export function createBroadcast(title, message, targetTags = []) {
  db.prepare("INSERT INTO broadcasts (title, message, target_tags) VALUES (?, ?, ?)").run(title, message, JSON.stringify(targetTags));
  return db.prepare("SELECT * FROM broadcasts ORDER BY id DESC LIMIT 1").get();
}

export function getBroadcast(id) {
  return db.prepare("SELECT * FROM broadcasts WHERE id = ?").get(id);
}

export function getAllBroadcasts() {
  return db.prepare("SELECT * FROM broadcasts ORDER BY created_at DESC").all();
}

export function updateBroadcastStatus(id, status, sentCount = 0) {
  return db.prepare("UPDATE broadcasts SET status = ?, sent_count = ?, sent_at = datetime('now') WHERE id = ?").run(status, sentCount, id);
}

export function addPayment(orderId, amount, method = "") {
  db.prepare("INSERT INTO payments (order_id, amount, method) VALUES (?, ?, ?)").run(orderId, amount, method);
  return db.prepare("SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1").get(orderId);
}

export function confirmPayment(orderId) {
  db.prepare("UPDATE payments SET status = 'confirmed', confirmed_at = datetime('now') WHERE order_id = ?").run(orderId);
  db.prepare("UPDATE orders SET payment_status = 'paid', updated_at = datetime('now') WHERE id = ?").run(orderId);
}

export function addSatisfactionRating(customerId, rating, feedback = "", ticketId = null, orderId = null) {
  db.prepare("INSERT INTO satisfaction_ratings (customer_id, ticket_id, order_id, rating, feedback) VALUES (?, ?, ?, ?, ?)").run(customerId, ticketId, orderId, rating, feedback);
  const avg = db.prepare("SELECT AVG(rating) as avg FROM satisfaction_ratings WHERE customer_id = ?").get(customerId);
  db.prepare("UPDATE customers SET satisfaction_avg = ? WHERE id = ?").run(avg.avg || 0, customerId);
}

export function updateDailyAnalytics(data) {
  const today = new Date().toISOString().split("T")[0];
  const existing = db.prepare("SELECT * FROM analytics WHERE date = ?").get(today);
  if (existing) {
    const fields = Object.keys(data);
    const sets = fields.map(f => `${f} = ${f} + @${f}`).join(", ");
    data.date = today;
    db.prepare(`UPDATE analytics SET ${sets} WHERE date = @date`).run(data);
  } else {
    data.date = today;
    const fields = Object.keys(data);
    const placeholders = fields.map(f => `@${f}`).join(", ");
    db.prepare(`INSERT INTO analytics (${["date", ...fields].join(", ")}) VALUES (@date, ${placeholders})`).run(data);
  }
}

export function getAnalytics(days = 30) {
  return db.prepare("SELECT * FROM analytics WHERE date >= date('now', ? || ' days') ORDER BY date DESC").all(`-${days}`);
}

export function getDashboardStats() {
  const customers = db.prepare("SELECT COUNT(*) as count FROM customers").get();
  const todayCustomers = db.prepare("SELECT COUNT(*) as count FROM customers WHERE date(first_contact) = date('now')").get();
  const orders = getOrderStats();
  const tickets = getTicketStats();
  const todayMessages = db.prepare("SELECT COUNT(*) as count FROM messages_log WHERE date(timestamp) = date('now')").get();
  const todayRevenue = db.prepare("SELECT SUM(total) as total FROM orders WHERE date(created_at) = date('now') AND payment_status = 'paid'").get();
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

export function getDashboardUser(username) {
  return db.prepare("SELECT * FROM dashboard_users WHERE username = ?").get(username);
}

export function createDashboardUser(username, hashedPassword, name, role = "admin") {
  db.prepare("INSERT INTO dashboard_users (username, password, name, role) VALUES (?, ?, ?, ?)").run(username, hashedPassword, name, role);
}

export function dashboardUserExists() {
  return db.prepare("SELECT COUNT(*) as c FROM dashboard_users").get().c > 0;
}

export function updateDashboardPassword(username, hashedPassword) {
  db.prepare("UPDATE dashboard_users SET password = ? WHERE username = ?").run(hashedPassword, username);
}
