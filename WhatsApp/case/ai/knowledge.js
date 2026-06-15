import {
  addFact,
  listFacts,
  removeFact,
  clearFacts,
} from "../../lib/knowledge.js";

// Metadata
export const info = {
  name: "Knowledge Base AI",

  menu: ["Tambahdata", "Listdata", "Hapusdata"],
  case: ["tambahdata", "listdata", "hapusdata", "resetdata"],

  description: "Ajari AI data bisnis/produk kamu (khusus Owner)",
  hidden: false,

  owner: true,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

// Handler
export default async function handler(leni) {
  const { command, q, LenwyText } = leni;

  switch (command) {
    case "tambahdata": {
      if (!q)
        return LenwyText(
          "📚 *Tambah Data AI*\n\n*Contoh:*\n.tambahdata Toko buka jam 08.00-21.00 setiap hari.\n.tambahdata Kaos polos brand Lenwy harga Rp75.000.",
        );
      const total = addFact(q);
      return LenwyText(
        `✅ Data ditambahkan ke pengetahuan AI.\nTotal data sekarang: *${total}*`,
      );
    }

    case "listdata": {
      const facts = listFacts();
      if (!facts.length)
        return LenwyText("📭 Belum ada data. Tambah dengan .tambahdata");
      const text = facts.map((f, i) => `${i + 1}. ${f}`).join("\n");
      return LenwyText(`📚 *Basis Pengetahuan AI*\n\n${text}`);
    }

    case "hapusdata": {
      const idx = parseInt(q, 10);
      if (!idx)
        return LenwyText("❌ Masukkan nomor data. Contoh: .hapusdata 2");
      const ok = removeFact(idx);
      return LenwyText(
        ok ? `🗑️ Data nomor ${idx} dihapus.` : "❌ Nomor data tidak ditemukan.",
      );
    }

    case "resetdata": {
      clearFacts();
      return LenwyText("🧹 Semua data pengetahuan AI sudah dihapus.");
    }
  }
}
