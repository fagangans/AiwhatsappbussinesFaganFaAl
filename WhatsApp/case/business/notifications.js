import { getLowStockProducts, getDeliveredOrdersForFollowup, markFollowupSent, getUnpaidOrdersOlderThan } from "../../database/business/db.js";
import { formatCurrency } from "../../database/business/helpers.js";

const notifiedLowStock = new Set();
const NOTIFY_COOLDOWN = 6 * 60 * 60 * 1000;

export async function checkLowStock(lenwy, ownerId, ownerJid) {
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
    await lenwy.sendMessage(ownerJid, { text: msg });
  } catch (_) {}
}

export async function notifyNewOrder(lenwy, ownerJid, order, customerName) {
  const items = JSON.parse(order.items || "[]");
  let itemList = items.map(i => `• ${i.name} x${i.qty}`).join("\n");
  let msg = `🛒 *Order Baru!*\n\nNo: *${order.order_number}*\nCustomer: ${customerName}\n${itemList}\nTotal: ${formatCurrency(order.total)}\n`;
  if (order.notes) msg += `Catatan: ${order.notes}\n`;
  msg += `\nCek di dashboard untuk proses pesanan.`;
  try {
    await lenwy.sendMessage(ownerJid, { text: msg });
  } catch (_) {}
}

export async function sendPaymentReminders(lenwy, ownerId) {
  const unpaid = getUnpaidOrdersOlderThan(24, ownerId);
  for (const order of unpaid) {
    const msg = `⏰ Halo ${order.customer_name || "Kak"}!\n\nPesanan *${order.order_number}* senilai ${formatCurrency(order.total)} belum dibayar.\n\nSilakan lakukan pembayaran atau ketik *.batalorder ${order.order_number}* untuk membatalkan.\n\nTerima kasih! 🙏`;
    try {
      await lenwy.sendMessage(order.customer_jid, { text: msg });
    } catch (_) {}
  }
}

export async function sendDeliveryFollowups(lenwy, ownerId) {
  const delivered = getDeliveredOrdersForFollowup(ownerId);
  for (const order of delivered) {
    const msg = `Halo ${order.customer_name || "Kak"}! 😊\n\nPesanan *${order.order_number}* sudah diterima ya?\n\nKalau ada masalah, silakan buat tiket support:\n*.buattiket Masalah Order ${order.order_number} | [jelaskan masalahnya]*\n\nAtau beri rating:\n*.rating ${order.order_number} | [1-5] | [komentar]*\n\nTerima kasih sudah belanja! 🙏`;
    try {
      await lenwy.sendMessage(order.customer_jid, { text: msg });
      markFollowupSent(order.order_number);
    } catch (_) {}
  }
}

let intervalRef = null;

export function startNotificationScheduler(lenwy, ownerId, ownerJid) {
  if (intervalRef) return;
  intervalRef = setInterval(async () => {
    try {
      await checkLowStock(lenwy, ownerId, ownerJid);
      await sendPaymentReminders(lenwy, ownerId);
      await sendDeliveryFollowups(lenwy, ownerId);
    } catch (_) {}
  }, 30 * 60 * 1000);
}

export function stopNotificationScheduler() {
  if (intervalRef) { clearInterval(intervalRef); intervalRef = null; }
}
