import {
  getOrCreateCustomer, getCustomer, updateCustomer,
  getAllCustomers, searchCustomers, getCustomerCount,
  getCustomerOrders, getCustomerTickets, getMessageLogs,
} from "../../database/business/db.js";
import { formatCurrency, formatDate } from "../../database/business/helpers.js";

export const info = {
  name: "Customer Management",
  menu: ["customer", "caricustomer", "tagcustomer", "notecustomer", "infocustomer"],
  case: ["customer", "listcustomer", "caricustomer", "tagcustomer", "notecustomer", "infocustomer", "blokcustomer", "unblokcustomer"],
  description: "Manajemen data customer (CRM)",
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
  const { command, q, LenwyText, LenwyWait, normalizedSender, isLenwy } = leni;

  switch (command) {
    case "customer":
    case "listcustomer": {
      const customers = getAllCustomers(20);
      const total = getCustomerCount();

      if (customers.length === 0) {
        await LenwyText("👥 Belum ada customer terdaftar");
        return;
      }

      let text = `👥 *DAFTAR CUSTOMER* (${total} total)\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      customers.forEach((c, i) => {
        const tags = JSON.parse(c.tags || "[]");
        const tagStr = tags.length > 0 ? ` [${tags.join(", ")}]` : "";
        text += `${i + 1}. *${c.name || "Tanpa Nama"}*${tagStr}\n`;
        text += `   📱 ${c.phone} | Order: ${c.total_orders} | ${formatCurrency(c.total_spent)}\n`;
        text += `   Terakhir: ${formatDate(c.last_contact)}\n\n`;
      });

      text += `_Ketik .infocustomer [nomor] untuk detail_\n`;
      text += `_Ketik .caricustomer [keyword] untuk cari_`;
      await LenwyText(text);
      break;
    }

    case "caricustomer": {
      if (!q) {
        await LenwyText("🔍 Ketik .caricustomer [nama/nomor]");
        return;
      }
      const results = searchCustomers(q);
      if (results.length === 0) {
        await LenwyText(`🔍 Tidak ada customer yang cocok dengan "${q}"`);
        return;
      }

      let text = `🔍 *HASIL PENCARIAN: "${q}"*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      results.forEach((c, i) => {
        text += `${i + 1}. *${c.name || "Tanpa Nama"}* - ${c.phone}\n`;
        text += `   Order: ${c.total_orders} | Total: ${formatCurrency(c.total_spent)}\n\n`;
      });
      await LenwyText(text);
      break;
    }

    case "infocustomer": {
      if (!q) {
        await LenwyText("👤 Ketik .infocustomer [nomor hp]");
        return;
      }

      const phone = q.replace(/[^0-9]/g, "");
      const jid = phone + "@s.whatsapp.net";
      const customer = getCustomer(jid);

      if (!customer) {
        await LenwyText(`❌ Customer dengan nomor ${phone} tidak ditemukan`);
        return;
      }

      const orders = getCustomerOrders(customer.id);
      const tickets = getCustomerTickets(customer.id);
      const tags = JSON.parse(customer.tags || "[]");

      let text = `👤 *PROFIL CUSTOMER*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `*Nama:* ${customer.name || "Tanpa Nama"}\n`;
      text += `*Telepon:* ${customer.phone}\n`;
      text += `*Email:* ${customer.email || "-"}\n`;
      text += `*Alamat:* ${customer.address || "-"}\n`;
      text += `*Tags:* ${tags.length > 0 ? tags.join(", ") : "-"}\n`;
      text += `*Catatan:* ${customer.notes || "-"}\n\n`;

      text += `*📊 Statistik:*\n`;
      text += `Total Order: ${customer.total_orders}\n`;
      text += `Total Belanja: ${formatCurrency(customer.total_spent)}\n`;
      text += `Rating: ${customer.satisfaction_avg ? customer.satisfaction_avg.toFixed(1) + "/5" : "-"}\n`;
      text += `Pertama Kontak: ${formatDate(customer.first_contact)}\n`;
      text += `Terakhir Kontak: ${formatDate(customer.last_contact)}\n`;
      text += `Status: ${customer.is_blocked ? "🚫 Diblokir" : "✅ Aktif"}\n\n`;

      if (orders.length > 0) {
        text += `*📦 Order Terakhir:*\n`;
        orders.slice(0, 3).forEach(o => {
          text += `• ${o.order_number} - ${formatCurrency(o.total)} (${o.status})\n`;
        });
        text += `\n`;
      }

      if (tickets.length > 0) {
        text += `*🎫 Tiket Terakhir:*\n`;
        tickets.slice(0, 3).forEach(t => {
          text += `• ${t.ticket_number} - ${t.subject} (${t.status})\n`;
        });
      }

      await LenwyText(text);
      break;
    }

    case "tagcustomer": {
      if (!q) {
        await LenwyText("🏷️ Format: .tagcustomer [nomor] | [tag1, tag2, ...]\n\nContoh: .tagcustomer 628123456789 | VIP, Loyal");
        return;
      }
      const [phone, tagsStr] = q.split("|").map(s => s.trim());
      if (!tagsStr) {
        await LenwyText("❌ Format: .tagcustomer [nomor] | [tag1, tag2]");
        return;
      }

      const jid = phone.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
      const customer = getCustomer(jid);
      if (!customer) {
        await LenwyText("❌ Customer tidak ditemukan");
        return;
      }

      const tags = tagsStr.split(",").map(t => t.trim()).filter(t => t);
      updateCustomer(customer.id, { tags: JSON.stringify(tags) });
      await LenwyText(`✅ Tags customer ${customer.name || customer.phone} diperbarui: ${tags.join(", ")}`);
      break;
    }

    case "notecustomer": {
      if (!q) {
        await LenwyText("📝 Format: .notecustomer [nomor] | [catatan]\n\nContoh: .notecustomer 628123456789 | Customer loyal, suka produk A");
        return;
      }
      const [phone, note] = q.split("|").map(s => s.trim());
      if (!note) {
        await LenwyText("❌ Format: .notecustomer [nomor] | [catatan]");
        return;
      }

      const jid = phone.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
      const customer = getCustomer(jid);
      if (!customer) {
        await LenwyText("❌ Customer tidak ditemukan");
        return;
      }

      updateCustomer(customer.id, { notes: note });
      await LenwyText(`✅ Catatan customer ${customer.name || customer.phone} diperbarui`);
      break;
    }

    case "blokcustomer": {
      if (!q) {
        await LenwyText("🚫 Ketik .blokcustomer [nomor]");
        return;
      }
      const jid = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
      const customer = getCustomer(jid);
      if (!customer) {
        await LenwyText("❌ Customer tidak ditemukan");
        return;
      }
      updateCustomer(customer.id, { is_blocked: 1 });
      await LenwyText(`🚫 Customer ${customer.name || customer.phone} diblokir`);
      break;
    }

    case "unblokcustomer": {
      if (!q) {
        await LenwyText("✅ Ketik .unblokcustomer [nomor]");
        return;
      }
      const jid = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
      const customer = getCustomer(jid);
      if (!customer) {
        await LenwyText("❌ Customer tidak ditemukan");
        return;
      }
      updateCustomer(customer.id, { is_blocked: 0 });
      await LenwyText(`✅ Customer ${customer.name || customer.phone} di-unblok`);
      break;
    }
  }
}
