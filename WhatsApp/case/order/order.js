import {
  getOrCreateCustomer, createOrder, getOrder, updateOrderStatus,
  getCustomerOrders, getAllOrders, getOrderStats, getProduct, getProductBySku,
  searchProducts, getProfile, getAllProducts,
} from "../../database/business/db.js";
import { formatCurrency, formatDate, formatOrderStatus, generateInvoiceText } from "../../database/business/helpers.js";

export const info = {
  name: "Order Management",
  menu: ["pesan", "cekorder", "listorder", "updateorder", "invoice"],
  case: ["pesan", "order", "cekorder", "cekpesanan", "listorder", "daftarorder", "updateorder", "invoice", "batalorder"],
  description: "Sistem pemesanan produk",
  hidden: false,
  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,
  allowPrivate: true,
};

export default async function handler(leni) {
  const { command, q, LenwyText, LenwyWait, normalizedSender, isLenwy, m } = leni;
  const pushname = m.messages[0].pushName || "Customer";

  switch (command) {
    case "pesan":
    case "order": {
      if (!q) {
        let text = `🛒 *CARA PESAN*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
        text += `Format:\n`;
        text += `.pesan [SKU/Nama] x [Jumlah]\n\n`;
        text += `Contoh:\n`;
        text += `.pesan KP001 x 2\n`;
        text += `.pesan Kopi Arabica x 3\n\n`;
        text += `Pesan banyak item (satu per baris):\n`;
        text += `.pesan\nKP001 x 2\nKP002 x 1\n\n`;
        text += `_Ketik .katalog untuk lihat produk_`;
        await LenwyText(text);
        return;
      }

      await LenwyWait();
      const customer = getOrCreateCustomer(normalizedSender, pushname);
      const lines = q.split("\n").filter(l => l.trim());
      const orderItems = [];
      let total = 0;

      for (const line of lines) {
        const match = line.match(/^(.+?)\s*x\s*(\d+)$/i);
        if (!match) {
          await LenwyText(`❌ Format salah pada: "${line}"\nGunakan: [produk] x [jumlah]`);
          return;
        }

        const query = match[1].trim();
        const qty = parseInt(match[2]);
        if (qty <= 0) {
          await LenwyText("❌ Jumlah harus lebih dari 0");
          return;
        }

        let product = getProductBySku(query.toUpperCase());
        if (!product) {
          const results = searchProducts(query);
          if (results.length > 0) product = results[0];
        }

        if (!product) {
          await LenwyText(`❌ Produk "${query}" tidak ditemukan. Ketik .katalog untuk lihat daftar produk.`);
          return;
        }

        if (product.stock < qty) {
          await LenwyText(`❌ Stok ${product.name} tidak cukup. Tersedia: ${product.stock}`);
          return;
        }

        const price = product.discount_price > 0 ? product.discount_price : product.price;
        orderItems.push({
          product_id: product.id,
          sku: product.sku,
          name: product.name,
          price,
          qty,
        });
        total += price * qty;
      }

      const order = createOrder(customer.id, orderItems, total);

      const profile = getProfile();
      let text = `✅ *PESANAN BERHASIL DIBUAT!*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `*No. Order:* ${order.order_number}\n`;
      text += `*Tanggal:* ${formatDate(order.created_at)}\n\n`;
      text += `*Detail Pesanan:*\n`;
      orderItems.forEach((item, i) => {
        text += `${i + 1}. ${item.name} x${item.qty} = ${formatCurrency(item.price * item.qty)}\n`;
      });
      text += `\n*TOTAL: ${formatCurrency(total)}*\n\n`;
      text += `Status: ${formatOrderStatus(order.status)}\n\n`;
      text += `_Ketik .invoice ${order.order_number} untuk cetak invoice_\n`;
      text += `_Ketik .cekorder ${order.order_number} untuk cek status_`;
      await LenwyText(text);
      break;
    }

    case "cekorder":
    case "cekpesanan": {
      if (!q) {
        const customer = getOrCreateCustomer(normalizedSender, pushname);
        const orders = getCustomerOrders(customer.id);
        if (orders.length === 0) {
          await LenwyText("📋 Anda belum memiliki pesanan");
          return;
        }

        let text = `📋 *PESANAN ANDA*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
        orders.slice(0, 10).forEach((o, i) => {
          const statusIcon = o.status === "delivered" ? "✅" : o.status === "cancelled" ? "❌" : "⏳";
          text += `${statusIcon} *${o.order_number}*\n`;
          text += `   Total: ${formatCurrency(o.total)} | ${formatOrderStatus(o.status)}\n`;
          text += `   ${formatDate(o.created_at)}\n\n`;
        });
        text += `_Ketik .cekorder [no.order] untuk detail_`;
        await LenwyText(text);
        return;
      }

      const order = getOrder(q.toUpperCase());
      if (!order) {
        await LenwyText(`❌ Order ${q.toUpperCase()} tidak ditemukan`);
        return;
      }

      const items = JSON.parse(order.items || "[]");
      let text = `📋 *DETAIL ORDER*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `*No. Order:* ${order.order_number}\n`;
      text += `*Tanggal:* ${formatDate(order.created_at)}\n`;
      text += `*Customer:* ${order.customer_name}\n\n`;
      text += `*Pesanan:*\n`;
      items.forEach((item, i) => {
        text += `${i + 1}. ${item.name} x${item.qty} = ${formatCurrency(item.price * item.qty)}\n`;
      });
      text += `\n*Total:* ${formatCurrency(order.total)}\n`;
      text += `*Status:* ${formatOrderStatus(order.status)}\n`;
      text += `*Pembayaran:* ${order.payment_status === "paid" ? "✅ Lunas" : "⏳ Belum Bayar"}\n`;
      if (order.tracking_number) text += `*Resi:* ${order.tracking_number}\n`;
      if (order.notes) text += `*Catatan:* ${order.notes}\n`;
      await LenwyText(text);
      break;
    }

    case "invoice": {
      if (!q) {
        await LenwyText("📋 Ketik .invoice [no.order]");
        return;
      }
      const order = getOrder(q.toUpperCase());
      if (!order) {
        await LenwyText(`❌ Order ${q.toUpperCase()} tidak ditemukan`);
        return;
      }
      const profile = getProfile();
      const invoiceText = generateInvoiceText(order, profile);
      await LenwyText(invoiceText);
      break;
    }

    case "listorder":
    case "daftarorder": {
      if (!isLenwy) {
        await LenwyText("⚠️ Fitur ini khusus owner");
        return;
      }
      const status = q || null;
      const orders = getAllOrders(status, 20);
      if (orders.length === 0) {
        await LenwyText(status ? `📋 Tidak ada order dengan status "${status}"` : "📋 Belum ada order");
        return;
      }

      const stats = getOrderStats();
      let text = `📊 *DAFTAR ORDER*\n━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `Total: ${stats.total_orders} | Pending: ${stats.pending} | Proses: ${stats.processing}\n`;
      text += `Revenue: ${formatCurrency(stats.total_revenue)}\n\n`;

      orders.forEach((o, i) => {
        const statusIcon = o.status === "delivered" ? "✅" : o.status === "cancelled" ? "❌" : "⏳";
        text += `${statusIcon} *${o.order_number}* - ${o.customer_name}\n`;
        text += `   ${formatCurrency(o.total)} | ${formatOrderStatus(o.status)} | ${o.payment_status === "paid" ? "Lunas" : "Belum"}\n\n`;
      });

      text += `_Filter: .listorder [pending/confirmed/processing/shipped/delivered/cancelled]_`;
      await LenwyText(text);
      break;
    }

    case "updateorder": {
      if (!isLenwy) {
        await LenwyText("⚠️ Fitur ini khusus owner");
        return;
      }
      if (!q) {
        let text = `📦 *UPDATE ORDER*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
        text += `Format: .updateorder [no.order] | [status]\n\n`;
        text += `Status tersedia:\n`;
        text += `• confirmed - Dikonfirmasi\n`;
        text += `• processing - Diproses\n`;
        text += `• shipped - Dikirim\n`;
        text += `• delivered - Selesai\n`;
        text += `• cancelled - Dibatalkan\n\n`;
        text += `Contoh: .updateorder ORD-250618-0001 | shipped`;
        await LenwyText(text);
        return;
      }

      const [orderNum, status] = q.split("|").map(s => s.trim());
      const validStatuses = ["confirmed", "processing", "shipped", "delivered", "cancelled"];
      if (!validStatuses.includes(status)) {
        await LenwyText(`❌ Status tidak valid. Pilihan: ${validStatuses.join(", ")}`);
        return;
      }

      const order = getOrder(orderNum.toUpperCase());
      if (!order) {
        await LenwyText(`❌ Order ${orderNum.toUpperCase()} tidak ditemukan`);
        return;
      }

      updateOrderStatus(orderNum.toUpperCase(), status);
      await LenwyText(`✅ Order *${orderNum.toUpperCase()}* status diperbarui: *${formatOrderStatus(status)}*`);
      break;
    }

    case "batalorder": {
      if (!q) {
        await LenwyText("❌ Ketik .batalorder [no.order]");
        return;
      }
      const order = getOrder(q.toUpperCase());
      if (!order) {
        await LenwyText(`❌ Order ${q.toUpperCase()} tidak ditemukan`);
        return;
      }

      if (!isLenwy) {
        const customer = getOrCreateCustomer(normalizedSender, pushname);
        if (order.customer_id !== customer.id) {
          await LenwyText("❌ Anda tidak bisa membatalkan pesanan orang lain");
          return;
        }
      }

      if (order.status !== "pending") {
        await LenwyText("❌ Hanya pesanan dengan status 'pending' yang bisa dibatalkan");
        return;
      }

      updateOrderStatus(q.toUpperCase(), "cancelled");
      await LenwyText(`✅ Order *${q.toUpperCase()}* berhasil dibatalkan`);
      break;
    }
  }
}
