import {
  getAllProducts, getProduct, getProductBySku, searchProducts,
  addProduct, updateProduct, deleteProduct, getProductCategories,
} from "../../database/business/db.js";
import { formatCurrency } from "../../database/business/helpers.js";

export const info = {
  name: "Product Catalog",
  menu: ["katalog", "produk", "tambahproduk", "editproduk", "hapusproduk", "daftarharga"],
  case: ["katalog", "produk", "cariproduk", "tambahproduk", "editproduk", "hapusproduk", "daftarharga", "stok"],
  description: "Manajemen katalog produk",
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
  const { command, q, LenwyText, LenwyWait, isLenwy, ownerId } = leni;

  switch (command) {
    case "katalog":
    case "daftarharga": {
      const category = q || null;
      const products = getAllProducts(category, ownerId);
      if (products.length === 0) {
        await LenwyText(category
          ? `📦 Tidak ada produk di kategori "${category}"`
          : "📦 Belum ada produk. Owner bisa tambah dengan .tambahproduk"
        );
        return;
      }

      const categories = getProductCategories(ownerId);
      let text = `📦 *KATALOG PRODUK*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;

      if (!category) {
        text += `*Kategori:* ${categories.join(", ")}\n`;
        text += `_Ketik .katalog [kategori] untuk filter_\n\n`;
      }

      let currentCat = "";
      products.forEach((p, i) => {
        if (p.category !== currentCat) {
          currentCat = p.category;
          text += `\n*[ ${currentCat.toUpperCase()} ]*\n`;
        }
        const priceText = p.discount_price > 0
          ? `~${formatCurrency(p.price)}~ ${formatCurrency(p.discount_price)}`
          : formatCurrency(p.price);
        const stockText = p.stock > 0 ? `(Stok: ${p.stock})` : "(Habis)";
        text += `${i + 1}. *${p.name}* ${p.sku ? `[${p.sku}]` : ""}\n`;
        text += `   ${priceText} ${stockText}\n`;
        if (p.description) text += `   _${p.description}_\n`;
      });

      text += `\n_Ketik .produk [nomor/sku] untuk detail_`;
      await LenwyText(text);
      break;
    }

    case "produk": {
      if (!q) {
        await LenwyText("📦 Ketik .produk [SKU/nama] untuk lihat detail produk");
        return;
      }

      let product = getProductBySku(q.toUpperCase(), ownerId);
      if (!product) {
        const id = parseInt(q);
        if (!isNaN(id)) product = getProduct(id);
      }
      if (!product) {
        const results = searchProducts(q, ownerId);
        if (results.length > 0) product = results[0];
      }

      if (!product) {
        await LenwyText("❌ Produk tidak ditemukan");
        return;
      }

      let text = `📦 *DETAIL PRODUK*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `*Nama:* ${product.name}\n`;
      if (product.sku) text += `*SKU:* ${product.sku}\n`;
      text += `*Kategori:* ${product.category}\n`;
      text += `*Harga:* ${formatCurrency(product.price)}\n`;
      if (product.discount_price > 0) {
        text += `*Harga Diskon:* ${formatCurrency(product.discount_price)}\n`;
        const pct = Math.round((1 - product.discount_price / product.price) * 100);
        text += `*Hemat:* ${pct}%\n`;
      }
      text += `*Stok:* ${product.stock > 0 ? product.stock : "Habis"}\n`;
      if (product.description) text += `\n*Deskripsi:*\n${product.description}\n`;
      text += `\n_Untuk pesan, ketik: .pesan ${product.sku || product.id} x [jumlah]_`;
      await LenwyText(text);
      break;
    }

    case "cariproduk": {
      if (!q) {
        await LenwyText("🔍 Ketik .cariproduk [keyword]");
        return;
      }
      const results = searchProducts(q, ownerId);
      if (results.length === 0) {
        await LenwyText(`🔍 Tidak ada produk yang cocok dengan "${q}"`);
        return;
      }
      let text = `🔍 *HASIL PENCARIAN: "${q}"*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      results.forEach((p, i) => {
        const price = p.discount_price > 0 ? formatCurrency(p.discount_price) : formatCurrency(p.price);
        text += `${i + 1}. *${p.name}* ${p.sku ? `[${p.sku}]` : ""} - ${price}\n`;
      });
      text += `\n_Ketik .produk [SKU] untuk detail_`;
      await LenwyText(text);
      break;
    }

    case "stok": {
      const products = getAllProducts(null, ownerId);
      if (products.length === 0) {
        await LenwyText("📦 Belum ada produk");
        return;
      }
      let text = `📊 *STOK PRODUK*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      products.forEach((p, i) => {
        const stockIcon = p.stock <= 0 ? "🔴" : p.stock <= 5 ? "🟡" : "🟢";
        text += `${stockIcon} ${p.name} ${p.sku ? `[${p.sku}]` : ""}: *${p.stock}*\n`;
      });
      await LenwyText(text);
      break;
    }

    case "tambahproduk": {
      if (!isLenwy) {
        await LenwyText("⚠️ Hanya owner yang bisa menambah produk");
        return;
      }
      if (!q) {
        let text = `➕ *TAMBAH PRODUK*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
        text += `Format:\n`;
        text += `.tambahproduk SKU | Nama | Harga | Stok | Kategori | Deskripsi\n\n`;
        text += `Contoh:\n`;
        text += `.tambahproduk KP001 | Kopi Arabica | 50000 | 100 | Minuman | Kopi arabica premium dari Toraja`;
        await LenwyText(text);
        return;
      }

      const parts = q.split("|").map(s => s.trim());
      if (parts.length < 3) {
        await LenwyText("❌ Minimal: .tambahproduk SKU | Nama | Harga");
        return;
      }

      const [sku, name, priceStr, stockStr, category, ...descParts] = parts;
      const price = parseFloat(priceStr);
      if (isNaN(price)) {
        await LenwyText("❌ Harga harus berupa angka");
        return;
      }

      try {
        addProduct({
          sku: sku.toUpperCase(),
          name,
          description: descParts.join("|").trim() || "",
          price,
          discount_price: 0,
          category: category || "Umum",
          stock: parseInt(stockStr) || 0,
          image_url: "",
          owner_id: ownerId,
        });
        await LenwyText(`✅ Produk *${name}* [${sku.toUpperCase()}] berhasil ditambahkan!\n\nHarga: ${formatCurrency(price)}\nStok: ${parseInt(stockStr) || 0}`);
      } catch (e) {
        if (e.message.includes("UNIQUE")) {
          await LenwyText(`❌ SKU "${sku.toUpperCase()}" sudah digunakan`);
        } else {
          await LenwyText("❌ Gagal menambah produk: " + e.message);
        }
      }
      break;
    }

    case "editproduk": {
      if (!isLenwy) {
        await LenwyText("⚠️ Hanya owner yang bisa edit produk");
        return;
      }
      if (!q) {
        let text = `✏️ *EDIT PRODUK*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
        text += `Format:\n`;
        text += `.editproduk [SKU] | [field] | [value]\n\n`;
        text += `Field: nama, harga, diskon, stok, kategori, deskripsi\n\n`;
        text += `Contoh:\n`;
        text += `.editproduk KP001 | harga | 45000\n`;
        text += `.editproduk KP001 | stok | 50`;
        await LenwyText(text);
        return;
      }

      const parts = q.split("|").map(s => s.trim());
      if (parts.length < 3) {
        await LenwyText("❌ Format: .editproduk [SKU] | [field] | [value]");
        return;
      }

      const [sku, field, ...valueParts] = parts;
      const value = valueParts.join("|").trim();
      const product = getProductBySku(sku.toUpperCase(), ownerId);
      if (!product) {
        await LenwyText(`❌ Produk [${sku.toUpperCase()}] tidak ditemukan`);
        return;
      }

      const fieldMap = {
        nama: "name", name: "name",
        harga: "price", price: "price",
        diskon: "discount_price", discount: "discount_price",
        stok: "stock", stock: "stock",
        kategori: "category", category: "category",
        deskripsi: "description", description: "description",
      };

      const dbField = fieldMap[field.toLowerCase()];
      if (!dbField) {
        await LenwyText("❌ Field tidak dikenali. Pilihan: nama, harga, diskon, stok, kategori, deskripsi");
        return;
      }

      const numericFields = ["price", "discount_price", "stock"];
      const finalValue = numericFields.includes(dbField) ? parseFloat(value) : value;

      updateProduct(product.id, { [dbField]: finalValue });
      await LenwyText(`✅ Produk [${sku.toUpperCase()}] field "${field}" diperbarui menjadi: ${numericFields.includes(dbField) ? formatCurrency(finalValue) : value}`);
      break;
    }

    case "hapusproduk": {
      if (!isLenwy) {
        await LenwyText("⚠️ Hanya owner yang bisa hapus produk");
        return;
      }
      if (!q) {
        await LenwyText("🗑️ Ketik .hapusproduk [SKU] untuk menghapus produk");
        return;
      }

      const product = getProductBySku(q.toUpperCase(), ownerId);
      if (!product) {
        await LenwyText(`❌ Produk [${q.toUpperCase()}] tidak ditemukan`);
        return;
      }

      deleteProduct(product.id);
      await LenwyText(`✅ Produk *${product.name}* [${q.toUpperCase()}] berhasil dihapus`);
      break;
    }
  }
}
