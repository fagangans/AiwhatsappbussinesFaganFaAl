import {
  getOrder, addPayment, confirmPayment, getProfile,
  getOrCreateCustomer, updateOrderStatus,
} from "../../database/business/db.js";
import { formatCurrency, formatDate } from "../../database/business/helpers.js";

export const info = {
  name: "Payment System",
  menu: ["bayar", "konfirmasibayar", "cekbayar"],
  case: ["bayar", "payment", "konfirmasibayar", "cekbayar", "infopembayaran"],
  description: "Sistem pembayaran order",
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
    case "bayar":
    case "payment": {
      if (!q) {
        let text = `💳 *PEMBAYARAN*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
        text += `Ketik .bayar [no.order] untuk info pembayaran\n\n`;
        text += `Metode pembayaran:\n`;
        text += `• Transfer Bank\n`;
        text += `• E-Wallet (OVO, GoPay, DANA)\n`;
        text += `• QRIS\n\n`;
        text += `_Setelah transfer, konfirmasi dengan:\n.konfirmasibayar [no.order] | [metode]_`;
        await LenwyText(text);
        return;
      }

      const order = getOrder(q.toUpperCase());
      if (!order) {
        await LenwyText(`❌ Order ${q.toUpperCase()} tidak ditemukan`);
        return;
      }

      if (order.payment_status === "paid") {
        await LenwyText(`✅ Order ${q.toUpperCase()} sudah lunas`);
        return;
      }

      const profile = getProfile();
      let text = `💳 *INFO PEMBAYARAN*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `*No. Order:* ${order.order_number}\n`;
      text += `*Total:* ${formatCurrency(order.total)}\n\n`;
      text += `*Metode Pembayaran:*\n`;
      text += `Silakan transfer ke salah satu rekening berikut:\n\n`;

      if (profile.name) {
        text += `a/n: *${profile.name}*\n\n`;
      }

      text += `_Setelah transfer, konfirmasi dengan:_\n`;
      text += `.konfirmasibayar ${order.order_number} | [metode]\n\n`;
      text += `Metode: bank/ovo/gopay/dana/qris`;
      await LenwyText(text);
      break;
    }

    case "konfirmasibayar": {
      if (!q) {
        await LenwyText("💳 Format: .konfirmasibayar [no.order] | [metode pembayaran]\n\nContoh: .konfirmasibayar ORD-250618-0001 | bank");
        return;
      }

      const parts = q.split("|").map(s => s.trim());
      const orderNum = parts[0].toUpperCase();
      const method = parts[1] || "transfer";

      const order = getOrder(orderNum);
      if (!order) {
        await LenwyText(`❌ Order ${orderNum} tidak ditemukan`);
        return;
      }

      if (order.payment_status === "paid") {
        await LenwyText(`✅ Order ${orderNum} sudah lunas`);
        return;
      }

      await LenwyWait();
      addPayment(order.id, order.total, method);

      if (isLenwy) {
        confirmPayment(order.id);
        updateOrderStatus(orderNum, "confirmed");
        await LenwyText(`✅ Pembayaran order *${orderNum}* dikonfirmasi!\n\nJumlah: ${formatCurrency(order.total)}\nMetode: ${method}\nStatus: Lunas`);
      } else {
        await LenwyText(`✅ Konfirmasi pembayaran diterima!\n\n*No. Order:* ${orderNum}\n*Jumlah:* ${formatCurrency(order.total)}\n*Metode:* ${method}\n\nPembayaran Anda sedang diverifikasi oleh admin.\nKami akan memberitahu Anda setelah dikonfirmasi.`);
      }
      break;
    }

    case "cekbayar": {
      if (!isLenwy) {
        await LenwyText("⚠️ Fitur ini khusus owner");
        return;
      }

      if (!q) {
        await LenwyText("💳 Ketik .cekbayar [no.order] untuk cek pembayaran\nAtau .cekbayar all untuk semua pending");
        return;
      }

      if (q.toLowerCase() === "all") {
        const { default: db } = await import("../../database/business/db.js");
        const pending = db.prepare(`
          SELECT p.*, o.order_number, o.total as order_total, c.name as customer_name
          FROM payments p
          JOIN orders o ON p.order_id = o.id
          JOIN customers c ON o.customer_id = c.id
          WHERE p.status = 'pending'
          ORDER BY p.created_at DESC
        `).all();

        if (pending.length === 0) {
          await LenwyText("💳 Tidak ada pembayaran pending");
          return;
        }

        let text = `💳 *PEMBAYARAN PENDING*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
        pending.forEach((p, i) => {
          text += `${i + 1}. *${p.order_number}* - ${p.customer_name}\n`;
          text += `   ${formatCurrency(p.amount)} via ${p.method}\n`;
          text += `   ${formatDate(p.created_at)}\n\n`;
        });
        text += `_Konfirmasi: .konfirmasibayar [no.order] | [metode]_`;
        await LenwyText(text);
        return;
      }

      const order = getOrder(q.toUpperCase());
      if (!order) {
        await LenwyText(`❌ Order ${q.toUpperCase()} tidak ditemukan`);
        return;
      }

      let text = `💳 *STATUS PEMBAYARAN*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `*Order:* ${order.order_number}\n`;
      text += `*Total:* ${formatCurrency(order.total)}\n`;
      text += `*Status:* ${order.payment_status === "paid" ? "✅ Lunas" : "⏳ Belum Bayar"}\n`;
      await LenwyText(text);
      break;
    }

    case "infopembayaran": {
      const profile = getProfile();
      let text = `💳 *INFORMASI PEMBAYARAN*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `*${profile.name || "Business"}*\n\n`;
      text += `Metode pembayaran yang tersedia:\n`;
      text += `• Transfer Bank\n`;
      text += `• E-Wallet (OVO, GoPay, DANA)\n`;
      text += `• QRIS\n\n`;
      text += `Hubungi kami untuk info rekening/e-wallet:\n`;
      if (profile.phone) text += `📞 ${profile.phone}\n`;
      if (profile.email) text += `📧 ${profile.email}\n`;
      await LenwyText(text);
      break;
    }
  }
}
