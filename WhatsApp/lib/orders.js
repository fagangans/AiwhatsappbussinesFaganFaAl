import fs from "fs";
import path from "path";

const DB_DIR = path.join(process.cwd(), "WhatsApp", "database", "cs");
const DB_PATH = path.join(DB_DIR, "orders.json");

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, "[]");

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return [];
  }
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export function createOrder(order) {
  const orders = load();
  const id = orders.length ? orders[orders.length - 1].id + 1 : 1001;
  const newOrder = {
    id,
    status: "Menunggu Pembayaran",
    createdAt: new Date().toISOString(),
    ...order,
  };
  orders.push(newOrder);
  save(orders);
  return newOrder;
}

export function listOrders() {
  return load();
}

export function getOrder(id) {
  return load().find((o) => o.id === Number(id)) || null;
}

export function updateOrderStatus(id, status) {
  const orders = load();
  const order = orders.find((o) => o.id === Number(id));
  if (!order) return null;
  order.status = status;
  save(orders);
  return order;
}
