import { getProfile } from "./db.js";

export function isBusinessOpen() {
  const profile = getProfile();
  const now = new Date();
  const utcHour = now.getUTCHours();
  const jakartaOffset = 7;
  const localHour = (utcHour + jakartaOffset) % 24;
  return localHour >= profile.open_hour && localHour < profile.close_hour;
}

export function getGreeting() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const jakartaOffset = 7;
  const localHour = (utcHour + jakartaOffset) % 24;

  if (localHour >= 5 && localHour < 11) return "Selamat Pagi";
  if (localHour >= 11 && localHour < 15) return "Selamat Siang";
  if (localHour >= 15 && localHour < 18) return "Selamat Sore";
  return "Selamat Malam";
}

export function formatCurrency(amount) {
  return `Rp${Number(amount).toLocaleString("id-ID")}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function formatOrderStatus(status) {
  const map = {
    pending: "Menunggu Konfirmasi",
    confirmed: "Dikonfirmasi",
    processing: "Diproses",
    shipped: "Dikirim",
    delivered: "Selesai",
    cancelled: "Dibatalkan",
  };
  return map[status] || status;
}

export function formatTicketStatus(status) {
  const map = {
    open: "Terbuka",
    in_progress: "Sedang Ditangani",
    resolved: "Terselesaikan",
    closed: "Ditutup",
  };
  return map[status] || status;
}

export function formatPriority(priority) {
  const map = {
    low: "Rendah",
    medium: "Sedang",
    high: "Tinggi",
    urgent: "Mendesak",
  };
  return map[priority] || priority;
}

export function parseProductItems(text) {
  const items = [];
  const lines = text.split("\n").filter(l => l.trim());
  for (const line of lines) {
    const match = line.match(/^(.+?)\s*x\s*(\d+)$/i) || line.match(/^(\d+)\s*x\s*(.+)$/i);
    if (match) {
      const isQtyFirst = /^\d+$/.test(match[1].trim());
      items.push({
        name: isQtyFirst ? match[2].trim() : match[1].trim(),
        qty: parseInt(isQtyFirst ? match[1].trim() : match[2].trim()),
      });
    }
  }
  return items;
}

export function generateInvoiceText(order, profile) {
  const items = JSON.parse(order.items || "[]");
  let text = `📋 *INVOICE*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `*${profile.name || "Business"}*\n`;
  if (profile.address) text += `📍 ${profile.address}\n`;
  if (profile.phone) text += `📞 ${profile.phone}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `*No. Order:* ${order.order_number}\n`;
  text += `*Tanggal:* ${formatDate(order.created_at)}\n`;
  text += `*Customer:* ${order.customer_name || "-"}\n\n`;
  text += `*Detail Pesanan:*\n`;

  items.forEach((item, i) => {
    text += `${i + 1}. ${item.name} x${item.qty} = ${formatCurrency(item.price * item.qty)}\n`;
  });

  text += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `*Subtotal:* ${formatCurrency(order.subtotal)}\n`;
  if (order.discount > 0) text += `*Diskon:* -${formatCurrency(order.discount)}\n`;
  text += `*TOTAL:* ${formatCurrency(order.total)}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `*Status:* ${formatOrderStatus(order.status)}\n`;
  text += `*Pembayaran:* ${order.payment_status === "paid" ? "Lunas" : "Belum Bayar"}\n`;

  if (order.notes) text += `\n*Catatan:* ${order.notes}\n`;

  text += `\n_Terima kasih atas pesanan Anda!_`;
  return text;
}
