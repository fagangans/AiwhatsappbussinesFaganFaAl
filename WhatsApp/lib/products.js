import fs from "fs";
import path from "path";

const DB_DIR = path.join(process.cwd(), "WhatsApp", "database", "cs");
const DB_PATH = path.join(DB_DIR, "products.json");

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, "[]");

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return [];
  }
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export function listProducts() {
  return load();
}

export function addProduct(name, price, stock, desc = "") {
  const products = load();
  products.push({ name, price, stock, desc });
  save(products);
  return products;
}

export function findProductIndex(query) {
  const products = load();
  const idx = parseInt(query, 10);
  if (!isNaN(idx) && idx >= 1 && idx <= products.length) return idx - 1;
  const lower = query.trim().toLowerCase();
  return products.findIndex((p) => p.name.toLowerCase() === lower);
}

export function getProductByIndex(index) {
  const products = load();
  return products[index] || null;
}

export function removeProduct(query) {
  const products = load();
  const index = findProductIndex(query);
  if (index === -1) return false;
  products.splice(index, 1);
  save(products);
  return true;
}

export function setStock(query, stock) {
  const products = load();
  const index = findProductIndex(query);
  if (index === -1) return null;
  products[index].stock = stock;
  save(products);
  return products[index];
}

export function adjustStock(index, delta) {
  const products = load();
  if (!products[index]) return null;
  products[index].stock = Math.max(0, products[index].stock + delta);
  save(products);
  return products[index];
}

export function getProductCatalogText() {
  const products = load();
  if (!products.length) return "";
  return (
    "\n\nKatalog Produk Tersedia (gunakan data ini untuk menjawab pertanyaan harga/ketersediaan barang, JANGAN sebutkan stok dalam bentuk apapun):\n" +
    products
      .map(
        (p, i) =>
          `${i + 1}. ${p.name} - Rp${p.price.toLocaleString("id-ID")}${p.desc ? " - " + p.desc : ""}`,
      )
      .join("\n")
  );
}
