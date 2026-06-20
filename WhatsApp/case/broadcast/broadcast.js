import {
  createBroadcast, getAllBroadcasts, getBroadcast, updateBroadcastStatus,
  getAllCustomers, searchCustomers, getCustomerCount,
  addTemplate, getTemplate, getAllTemplates, deleteTemplate,
} from "../../database/business/db.js";
import { formatDate } from "../../database/business/helpers.js";

export const info = {
  name: "Broadcast & Templates",
  menu: ["broadcast", "template", "addtemplate"],
  case: ["broadcast", "kirimbroadcast", "listbroadcast", "template", "addtemplate", "deltemplate", "gunakantemplate"],
  description: "Broadcast pesan & manajemen template",
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
  const { command, q, LenwyText, LenwyWait, lenwy, isLenwy, ownerId, botId } = leni;

  switch (command) {
    case "broadcast":
    case "kirimbroadcast": {
      if (!q) {
        let text = `📢 *BROADCAST*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
        text += `Format:\n`;
        text += `.broadcast [judul] | [pesan]\n\n`;
        text += `Broadcast ke tag tertentu:\n`;
        text += `.broadcast [judul] | [pesan] | [tag1,tag2]\n\n`;
        text += `Contoh:\n`;
        text += `.broadcast Promo Akhir Tahun | Diskon 50% untuk semua produk!\n`;
        text += `.broadcast Info VIP | Promo khusus member VIP | VIP`;
        await LenwyText(text);
        return;
      }

      const parts = q.split("|").map(s => s.trim());
      if (parts.length < 2) {
        await LenwyText("❌ Format: .broadcast [judul] | [pesan]");
        return;
      }

      const title = parts[0];
      const message = parts[1];
      const targetTags = parts[2] ? parts[2].split(",").map(t => t.trim()) : [];

      await LenwyWait();

      let customers;
      if (targetTags.length > 0) {
        customers = getAllCustomers(1000, 0, ownerId, botId).filter(c => {
          const tags = JSON.parse(c.tags || "[]");
          return targetTags.some(t => tags.includes(t));
        });
      } else {
        customers = getAllCustomers(1000, 0, ownerId, botId).filter(c => !c.is_blocked);
      }

      if (customers.length === 0) {
        await LenwyText("❌ Tidak ada customer yang cocok dengan target");
        return;
      }

      const bc = createBroadcast(title, message, targetTags, ownerId);

      let sent = 0;
      let failed = 0;

      for (const customer of customers) {
        try {
          const fullMessage = `📢 *${title}*\n━━━━━━━━━━━━━━━━━━━━━\n\n${message}`;
          await lenwy.sendMessage(customer.jid, { text: fullMessage });
          sent++;
          await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
          failed++;
        }
      }

      updateBroadcastStatus(bc.id, "sent", sent);
      await LenwyText(`✅ *Broadcast Selesai!*\n\n📢 ${title}\n✅ Terkirim: ${sent}\n❌ Gagal: ${failed}\nTotal target: ${customers.length}`);
      break;
    }

    case "listbroadcast": {
      const broadcasts = getAllBroadcasts(ownerId);
      if (broadcasts.length === 0) {
        await LenwyText("📢 Belum ada broadcast");
        return;
      }

      let text = `📢 *RIWAYAT BROADCAST*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      broadcasts.slice(0, 10).forEach((b, i) => {
        const tags = JSON.parse(b.target_tags || "[]");
        text += `${i + 1}. *${b.title}*\n`;
        text += `   Status: ${b.status} | Terkirim: ${b.sent_count}\n`;
        text += `   ${tags.length > 0 ? `Target: ${tags.join(", ")}` : "Semua customer"}\n`;
        text += `   ${formatDate(b.sent_at || b.created_at)}\n\n`;
      });
      await LenwyText(text);
      break;
    }

    case "template": {
      const templates = getAllTemplates(ownerId);
      if (templates.length === 0) {
        await LenwyText("📝 Belum ada template. Buat dengan .addtemplate");
        return;
      }

      let text = `📝 *DAFTAR TEMPLATE*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      templates.forEach((t, i) => {
        text += `${i + 1}. *${t.name}* [${t.category}]\n`;
        text += `   ${t.content.substring(0, 80)}${t.content.length > 80 ? "..." : ""}\n\n`;
      });
      text += `_Gunakan: .gunakantemplate [nama]_`;
      await LenwyText(text);
      break;
    }

    case "addtemplate": {
      if (!q) {
        let text = `📝 *TAMBAH TEMPLATE*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
        text += `Format:\n`;
        text += `.addtemplate [nama] | [isi template] | [kategori]\n\n`;
        text += `Variable: {nama}, {tanggal}, {order}\n\n`;
        text += `Contoh:\n`;
        text += `.addtemplate ucapan_terima_kasih | Terima kasih {nama} atas pesanan Anda! | Order`;
        await LenwyText(text);
        return;
      }

      const parts = q.split("|").map(s => s.trim());
      if (parts.length < 2) {
        await LenwyText("❌ Format: .addtemplate [nama] | [isi]");
        return;
      }

      try {
        addTemplate(parts[0], parts[1], parts[2] || "Umum", [], ownerId);
        await LenwyText(`✅ Template *${parts[0]}* berhasil ditambahkan`);
      } catch (e) {
        if (e.message.includes("UNIQUE")) {
          await LenwyText(`❌ Template dengan nama "${parts[0]}" sudah ada`);
        } else {
          await LenwyText("❌ Gagal menambah template: " + e.message);
        }
      }
      break;
    }

    case "deltemplate": {
      if (!q) {
        await LenwyText("🗑️ Ketik .deltemplate [nama]");
        return;
      }
      deleteTemplate(q, ownerId);
      await LenwyText(`✅ Template *${q}* berhasil dihapus`);
      break;
    }

    case "gunakantemplate": {
      if (!q) {
        await LenwyText("📝 Ketik .gunakantemplate [nama]");
        return;
      }
      const template = getTemplate(q, ownerId);
      if (!template) {
        await LenwyText(`❌ Template "${q}" tidak ditemukan`);
        return;
      }
      await LenwyText(`📝 *Template: ${template.name}*\n━━━━━━━━━━━━━━━━━━━━━\n\n${template.content}`);
      break;
    }
  }
}
