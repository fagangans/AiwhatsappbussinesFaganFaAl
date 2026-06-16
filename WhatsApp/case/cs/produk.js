import { addProduct, removeProduct, setStock } from "../../lib/products.js";

export const info = {
  name: "Kelola Produk",

  menu: ["Tambahproduk", "Hapusproduk", "Editstok"],
  case: ["tambahproduk", "hapusproduk", "editstok"],

  description: "Kelola katalog produk toko (khusus Owner)",
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
    case "tambahproduk": {
      const parts = q.split("|").map((v) => v.trim());
      if (parts.length < 3) {
        return LenwyText(
          "☘️ *Contoh:* .tambahproduk Nama Produk|50000|10|Deskripsi singkat",
        );
      }
      const [name, priceStr, stockStr, desc = ""] = parts;
      const price = parseInt(priceStr, 10);
      const stock = parseInt(stockStr, 10);
      if (!name || isNaN(price) || isNaN(stock)) {
        return LenwyText("⚠️ Format salah. Harga dan stok harus berupa angka.");
      }
      addProduct(name, price, stock, desc);
      return LenwyText(`✅ Produk *${name}* berhasil ditambahkan.`);
    }

    case "hapusproduk": {
      if (!q) return LenwyText("☘️ *Contoh:* .hapusproduk Nama Produk");
      const ok = removeProduct(q);
      return LenwyText(ok ? `✅ Produk *${q}* berhasil dihapus.` : "⚠️ Produk tidak ditemukan.");
    }

    case "editstok": {
      const parts = q.split("|").map((v) => v.trim());
      if (parts.length < 2) {
        return LenwyText("☘️ *Contoh:* .editstok Nama Produk|20");
      }
      const [name, stockStr] = parts;
      const stock = parseInt(stockStr, 10);
      if (isNaN(stock)) return LenwyText("⚠️ Stok harus berupa angka.");
      const updated = setStock(name, stock);
      return LenwyText(
        updated
          ? `✅ Stok *${updated.name}* diubah jadi *${updated.stock}*.`
          : "⚠️ Produk tidak ditemukan.",
      );
    }
  }
}
