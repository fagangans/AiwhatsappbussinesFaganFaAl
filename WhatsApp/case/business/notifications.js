import { getLowStockProducts, getDeliveredOrdersForFollowup, markFollowupSent, getUnpaidOrdersOlderThan, getAllTickets } from "../../database/business/db.js";
import { formatCurrency } from "../../database/business/helpers.js";
import { throttledSend, delay } from "./rate-limiter.js";

const notifiedLowStock = new Set();
const notifiedUrgentTickets = new Set();
const NOTIFY_COOLDOWN = 6 * 60 * 60 * 1000;

export async function checkLowStock(lenwy, ownerId, ownerJid, botId = "default") {
  const lowItems = getLowStockProducts(5, ownerId);
  if (lowItems.length === 0) return;
  const toNotify = lowItems.filter(p => {
    const key = `${p.id}-${p.stock}`;
    if (notifiedLowStock.has(key)) return false;
    notifiedLowStock.add(key);
    setTimeout(() => notifiedLowStock.delete(key), NOTIFY_COOLDOWN);
    return true;
  });
  if (toNotify.length === 0) return;
  let msg = "⚠️ *Peringatan Stok Menipis*\n\n";
  for (const p of toNotify) {
    msg += `• *${p.name}* (${p.sku || "-"}) — sisa ${p.stock}\n`;
  }
  msg += "\nSegera restock ya!";
  try {
    await throttledSend(lenwy, ownerJid, { text: msg }, {}, botId);
  } catch (_) {}
}

export async function notifyNewOrder(lenwy, ownerJid, order, customerName, botId = "default") {
  const items = JSON.parse(order.items || "[]");
  let itemList = items.map(i => `• ${i.name} x${i.qty}`).join("\n");
  let msg = `🛒 *Order Baru!*\n\nNo: *${order.order_number}*\nCustomer: ${customerName}\n${itemList}\nTotal: ${formatCurrency(order.total)}\n`;
  if (order.notes) msg += `Catatan: ${order.notes}\n`;
  msg += `\nCek di dashboard untuk proses pesanan.`;
  try {
    await throttledSend(lenwy, ownerJid, { text: msg }, {}, botId);
  } catch (_) {}
}

export async function sendPaymentReminders(lenwy, ownerId, botId = "default") {
  const unpaid = getUnpaidOrdersOlderThan(24, ownerId);
  const batch = unpaid.slice(0, 20); // Limit per cycle
  for (const order of batch) {
    const msg = `⏰ Halo ${order.customer_name || "Kak"}!\n\nPesanan *${order.order_number}* senilai ${formatCurrency(order.total)} belum dibayar.\n\nSilakan lakukan pembayaran atau ketik *.batalorder ${order.order_number}* untuk membatalkan.\n\nTerima kasih! 🙏`;
    try {
      await throttledSend(lenwy, order.customer_jid, { text: msg }, {}, botId);
      await delay(3000);
    } catch (_) {}
  }
}

export async function sendDeliveryFollowups(lenwy, ownerId, botId = "default") {
  const delivered = getDeliveredOrdersForFollowup(ownerId);
  const batch = delivered.slice(0, 20); // Limit per cycle
  for (const order of batch) {
    const msg = `Halo ${order.customer_name || "Kak"}! 😊\n\nPesanan *${order.order_number}* sudah diterima ya?\n\nKalau ada masalah, silakan buat tiket support:\n*.buattiket Masalah Order ${order.order_number} | [jelaskan masalahnya]*\n\nAtau beri rating:\n*.rating ${order.order_number} | [1-5] | [komentar]*\n\nTerima kasih sudah belanja! 🙏`;
    try {
      await throttledSend(lenwy, order.customer_jid, { text: msg }, {}, botId);
      markFollowupSent(order.order_number);
      await delay(3000);
    } catch (_) {}
  }
}

export async function notifyUrgentTickets(lenwy, ownerId, ownerJid, botId = "default") {
  const openTickets = getAllTickets("open", 20, ownerId);
  const urgent = openTickets.filter(t => t.priority === "high" || t.priority === "urgent");
  const toNotify = urgent.filter(t => {
    if (notifiedUrgentTickets.has(t.ticket_number)) return false;
    const created = new Date(t.created_at).getTime();
    if (Date.now() - created > 60 * 60 * 1000) return false;
    notifiedUrgentTickets.add(t.ticket_number);
    return true;
  });
  if (toNotify.length === 0) return;
  let msg = "🚨 *Tiket Urgent Baru*\n\n";
  for (const t of toNotify) {
    const name = t.customer_name || "Unknown";
    msg += `• *${t.ticket_number}* — ${t.subject}\n  Prioritas: ${t.priority === "urgent" ? "🔴 Urgent" : "🟠 High"} | Customer: ${name}\n`;
  }
  msg += "\nSegera cek di dashboard!";
  try {
    await throttledSend(lenwy, ownerJid, { text: msg }, {}, botId);
  } catch (_) {}
}

// Keyed per botId — several bots run in the same process, and a single
// shared interval would mean only the first bot to call this ever gets
// scheduled notifications.
const intervalsByBot = new Map();

export function startNotificationScheduler(lenwy, ownerId, ownerJid, botId = "default") {
  if (intervalsByBot.has(botId)) return;
  const interval = setInterval(async () => {
    try {
      await checkLowStock(lenwy, ownerId, ownerJid, botId);
      await sendPaymentReminders(lenwy, ownerId, botId);
      await sendDeliveryFollowups(lenwy, ownerId, botId);
      await notifyUrgentTickets(lenwy, ownerId, ownerJid, botId);
    } catch (_) {}
  }, 30 * 60 * 1000);
  intervalsByBot.set(botId, interval);
}

export function stopNotificationScheduler(botId = "default") {
  const interval = intervalsByBot.get(botId);
  if (interval) {
    clearInterval(interval);
    intervalsByBot.delete(botId);
  }
}
