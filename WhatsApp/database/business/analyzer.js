const RULES = [
  {
    category: "keluhan",
    priority: "urgent",
    keywords: ["kecewa", "parah", "rugi", "penipuan", "nipu", "tipu", "bohong", "lapor polisi", "somasi", "viral", "media", "hukum"],
  },
  {
    category: "keluhan",
    priority: "high",
    keywords: ["komplain", "keluhan", "kecewa", "mengecewakan", "buruk", "jelek", "rusak", "cacat", "salah kirim", "tidak sesuai", "beda", "zonk"],
  },
  {
    category: "refund",
    priority: "high",
    keywords: ["refund", "kembalikan uang", "balikin uang", "minta ganti", "tukar barang", "retur", "return", "garansi"],
  },
  {
    category: "pembayaran",
    priority: "high",
    keywords: ["sudah bayar", "udah bayar", "sudah transfer", "udah transfer", "bukti bayar", "bukti transfer", "belum dikirim", "kapan kirim", "lama sekali"],
  },
  {
    category: "urgent",
    priority: "urgent",
    keywords: ["urgent", "darurat", "segera", "secepatnya", "tolong bantu", "butuh bantuan", "mohon segera", "penting sekali"],
  },
  {
    category: "pertanyaan_produk",
    priority: "medium",
    keywords: ["ready stock", "ready kak", "ada stok", "masih ada", "kapan restock", "pre order", "po kapan", "harga berapa", "diskon", "promo"],
  },
  {
    category: "pengiriman",
    priority: "high",
    keywords: ["belum sampai", "tidak sampai", "hilang", "paket hilang", "salah alamat", "pengiriman lama", "belum diterima", "dimana paket", "no resi"],
  },
  {
    category: "kerjasama",
    priority: "medium",
    keywords: ["kerjasama", "kolaborasi", "reseller", "dropship", "agen", "distributor", "wholesale", "grosir", "partnership"],
  },
];

export function analyzeImportantMessage(text) {
  if (!text || text.length < 5) return null;
  const lower = text.toLowerCase();

  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        return { category: rule.category, priority: rule.priority };
      }
    }
  }

  return null;
}
