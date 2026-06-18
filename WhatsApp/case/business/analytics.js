import {
  getDashboardStats, getAnalytics, getOrderStats, getTicketStats,
  getCustomerCount, getAllProducts,
} from "../../database/business/db.js";
import { formatCurrency } from "../../database/business/helpers.js";

export const info = {
  name: "Analytics & Reporting",
  menu: ["laporan", "statistik"],
  case: ["laporan", "statistik", "stats", "report", "laporanharian", "laporanmingguan"],
  description: "Laporan & statistik bisnis",
  hidden: false,
  owner: true,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,
  allowPrivate: true,
};

export default async function handler(leni) {
  const { command, q, LenwyText } = leni;

  switch (command) {
    case "statistik":
    case "stats": {
      const stats = getDashboardStats();
      const products = getAllProducts();

      let text = `📊 *STATISTIK BISNIS*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;

      text += `👥 *Customer*\n`;
      text += `• Total: ${stats.total_customers}\n`;
      text += `• Baru hari ini: ${stats.new_customers_today}\n\n`;

      text += `📦 *Order*\n`;
      text += `• Total: ${stats.orders.total_orders}\n`;
      text += `• Pending: ${stats.orders.pending}\n`;
      text += `• Dikonfirmasi: ${stats.orders.confirmed}\n`;
      text += `• Diproses: ${stats.orders.processing}\n`;
      text += `• Dikirim: ${stats.orders.shipped}\n`;
      text += `• Selesai: ${stats.orders.delivered}\n`;
      text += `• Dibatalkan: ${stats.orders.cancelled}\n\n`;

      text += `💰 *Revenue*\n`;
      text += `• Total: ${formatCurrency(stats.orders.total_revenue)}\n`;
      text += `• Hari ini: ${formatCurrency(stats.revenue_today)}\n\n`;

      text += `🎫 *Support Tiket*\n`;
      text += `• Open: ${stats.tickets.open_tickets}\n`;
      text += `• In Progress: ${stats.tickets.in_progress}\n`;
      text += `• Resolved: ${stats.tickets.resolved}\n`;
      text += `• Closed: ${stats.tickets.closed}\n\n`;

      text += `📦 *Produk*\n`;
      text += `• Total Aktif: ${products.length}\n`;
      text += `• Stok Habis: ${products.filter(p => p.stock <= 0).length}\n`;
      text += `• Stok Rendah: ${products.filter(p => p.stock > 0 && p.stock <= 5).length}\n\n`;

      text += `💬 *Pesan Hari Ini:* ${stats.messages_today}\n`;
      text += `⭐ *Kepuasan:* ${stats.satisfaction_avg}/5\n`;

      await LenwyText(text);
      break;
    }

    case "laporan":
    case "report": {
      const days = parseInt(q) || 7;
      const analytics = getAnalytics(days);

      if (analytics.length === 0) {
        await LenwyText("📊 Belum ada data analytics");
        return;
      }

      let text = `📊 *LAPORAN ${days} HARI TERAKHIR*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;

      let totalMsgIn = 0, totalMsgOut = 0, totalNewCust = 0, totalOrders = 0, totalRevenue = 0;

      analytics.forEach(a => {
        text += `📅 *${a.date}*\n`;
        text += `   📩 In: ${a.messages_in} | 📤 Out: ${a.messages_out}\n`;
        text += `   👥 New: ${a.new_customers} | 📦 Orders: ${a.orders_count}\n`;
        text += `   💰 ${formatCurrency(a.revenue)}\n\n`;

        totalMsgIn += a.messages_in;
        totalMsgOut += a.messages_out;
        totalNewCust += a.new_customers;
        totalOrders += a.orders_count;
        totalRevenue += a.revenue;
      });

      text += `━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `*TOTAL:*\n`;
      text += `📩 Pesan Masuk: ${totalMsgIn}\n`;
      text += `📤 Pesan Keluar: ${totalMsgOut}\n`;
      text += `👥 Customer Baru: ${totalNewCust}\n`;
      text += `📦 Order: ${totalOrders}\n`;
      text += `💰 Revenue: ${formatCurrency(totalRevenue)}\n`;

      await LenwyText(text);
      break;
    }

    case "laporanharian": {
      const stats = getDashboardStats();
      let text = `📊 *LAPORAN HARIAN*\n`;
      text += `📅 ${new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `💬 Pesan: ${stats.messages_today}\n`;
      text += `👥 Customer Baru: ${stats.new_customers_today}\n`;
      text += `📦 Order Pending: ${stats.orders.pending}\n`;
      text += `🎫 Tiket Open: ${stats.tickets.open_tickets}\n`;
      text += `💰 Revenue: ${formatCurrency(stats.revenue_today)}\n`;
      text += `⭐ Kepuasan: ${stats.satisfaction_avg}/5\n`;
      await LenwyText(text);
      break;
    }

    case "laporanmingguan": {
      const analytics = getAnalytics(7);
      let totalRevenue = 0;
      let totalOrders = 0;
      let totalNewCust = 0;
      analytics.forEach(a => {
        totalRevenue += a.revenue;
        totalOrders += a.orders_count;
        totalNewCust += a.new_customers;
      });

      let text = `📊 *LAPORAN MINGGUAN*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `📦 Total Order: ${totalOrders}\n`;
      text += `👥 Customer Baru: ${totalNewCust}\n`;
      text += `💰 Revenue: ${formatCurrency(totalRevenue)}\n`;
      text += `📅 Data ${analytics.length} hari\n`;
      await LenwyText(text);
      break;
    }
  }
}
