import { addFaq, getAllFaq, searchFaq, deleteFaq } from "../../database/business/db.js";

export const info = {
  name: "FAQ System",
  menu: ["faq", "addfaq", "delfaq"],
  case: ["faq", "tanya", "addfaq", "delfaq", "listfaq"],
  description: "Sistem FAQ (Frequently Asked Questions)",
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
  const { command, q, LenwyText, isLenwy, ownerId } = leni;

  switch (command) {
    case "faq":
    case "listfaq": {
      const faqs = getAllFaq(ownerId);
      if (faqs.length === 0) {
        await LenwyText("❓ Belum ada FAQ. Owner bisa tambah dengan .addfaq");
        return;
      }

      let text = `❓ *FAQ - Pertanyaan Umum*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      faqs.forEach((f, i) => {
        text += `*${i + 1}. ${f.question}*\n`;
        text += `${f.answer}\n\n`;
      });
      text += `_Cari jawaban: .tanya [pertanyaan]_`;
      await LenwyText(text);
      break;
    }

    case "tanya": {
      if (!q) {
        await LenwyText("❓ Ketik .tanya [pertanyaan Anda]\n\nContoh: .tanya cara pesan");
        return;
      }

      const results = searchFaq(q, ownerId);
      if (results.length === 0) {
        await LenwyText(`❓ Tidak ada FAQ yang cocok dengan "${q}"\n\nSilakan buat tiket support: .buattiket [pertanyaan Anda]`);
        return;
      }

      let text = `❓ *JAWABAN DITEMUKAN*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      results.forEach((f, i) => {
        text += `*Q: ${f.question}*\n`;
        text += `A: ${f.answer}\n\n`;
      });
      text += `_Masih butuh bantuan? Ketik .buattiket [masalah Anda]_`;
      await LenwyText(text);
      break;
    }

    case "addfaq": {
      if (!isLenwy) {
        await LenwyText("⚠️ Hanya owner yang bisa menambah FAQ");
        return;
      }
      if (!q) {
        let text = `❓ *TAMBAH FAQ*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
        text += `Format:\n`;
        text += `.addfaq [pertanyaan] | [jawaban] | [keyword1,keyword2] | [kategori]\n\n`;
        text += `Contoh:\n`;
        text += `.addfaq Bagaimana cara pesan? | Ketik .katalog lalu .pesan [SKU] x [jumlah] | pesan,order,beli | Order`;
        await LenwyText(text);
        return;
      }

      const parts = q.split("|").map(s => s.trim());
      if (parts.length < 2) {
        await LenwyText("❌ Minimal: .addfaq [pertanyaan] | [jawaban]");
        return;
      }

      const keywords = parts[2] ? parts[2].split(",").map(k => k.trim()) : [];
      addFaq(parts[0], parts[1], keywords, parts[3] || "Umum", ownerId);
      await LenwyText(`✅ FAQ berhasil ditambahkan!\n\nQ: ${parts[0]}\nA: ${parts[1]}`);
      break;
    }

    case "delfaq": {
      if (!isLenwy) {
        await LenwyText("⚠️ Hanya owner yang bisa menghapus FAQ");
        return;
      }
      if (!q) {
        await LenwyText("🗑️ Ketik .delfaq [nomor ID]\n\nLihat ID dengan .listfaq");
        return;
      }
      const id = parseInt(q);
      if (isNaN(id)) {
        await LenwyText("❌ ID harus berupa angka");
        return;
      }
      deleteFaq(id);
      await LenwyText(`✅ FAQ #${id} berhasil dihapus`);
      break;
    }
  }
}
