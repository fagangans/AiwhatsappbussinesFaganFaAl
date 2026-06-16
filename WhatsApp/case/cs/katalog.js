import { listProducts } from "../../lib/products.js";

export const info = {
  name: "Katalog Produk",

  menu: ["Produk", "Katalog"],
  case: ["produk", "katalog"],

  description: "Lihat katalog produk yang tersedia",
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
  const { LenwyText } = leni;

  const products = listProducts();
  if (!products.length) return LenwyText("📦 Belum ada produk yang tersedia.");

  const text = products
    .map(
      (p, i) =>
        `${i + 1}. *${p.name}* - Rp${p.price.toLocaleString("id-ID")} (Stok: ${p.stock})${p.desc ? `\n   ${p.desc}` : ""}`,
    )
    .join("\n\n");

  await LenwyText(`🛍️ *KATALOG PRODUK*\n\n${text}\n\nKetik *.order* untuk mulai memesan!`);
}
