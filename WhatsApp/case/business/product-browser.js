import { getAllProducts, getProductImages } from "../../database/business/db.js";
import { formatCurrency } from "../../database/business/helpers.js";

export const MAX_SHOWCASE = 6;

// Jumlah maksimum foto galeri tambahan yang dikirim saat customer menanyakan
// SATU produk secara spesifik (bukan saat browsing banyak produk sekaligus),
// supaya volume kirim foto per giliran chat tetap terbatas.
export const MAX_GALLERY_EXTRAS = 2;

// Foto galeri tambahan untuk satu produk (selain foto utama image_url).
export function galleryExtras(productId, primaryUrl) {
  const images = getProductImages(productId) || [];
  return images
    .filter((img) => img.image_url && img.image_url !== primaryUrl)
    .slice(0, MAX_GALLERY_EXTRAS);
}

// Kata umum yang tidak relevan untuk dijadikan kata kunci pencarian produk.
const STOP_WORDS = new Set([
  "saya", "aku", "gw", "gua", "gue", "kamu", "kak", "min", "gan", "kak",
  "mau", "ingin", "pengen", "mw", "mo", "pen", "pesan", "pesen", "order", "beli", "ambil", "checkout",
  "lihat", "liat", "tunjuk", "tunjukin", "tunjukkin", "liatin", "kasih", "show", "preview",
  "dong", "ya", "yuk", "nih", "deh", "sih", "tolong", "bisa",
  "ada", "punya", "jual", "yang", "nya", "apa", "aja", "saja", "itu", "ini", "dan", "dengan", "untuk",
  "mohon", "minta", "cek", "info", "gimana", "bagaimana", "cara",
  "produk", "barang", "katalog", "jualan", "dagangan", "daftar", "list", "tersedia", "semua", "semuanya",
  "gak", "ga", "kaga", "kagak", "nggak", "enggak", "ngga", "engga", "tidak", "kok", "loh", "lho",
  "kalo", "kalau", "kah", "kan", "aja", "saja", "lagi", "udah", "sudah", "belum", "blm", "gada",
]);

// Kata label atribut (bukan nilainya) - selalu dibuang, tidak pernah dipakai sebagai kata kunci pencarian.
const ATTRIBUTE_LABELS = new Set(["warna", "color", "ukuran", "size", "model", "jenis", "varian", "motif"]);

// Nilai atribut (warna/ukuran spesifik) - dipakai untuk pencarian "exact", dibuang untuk fallback "broad".
const ATTRIBUTE_VALUES = new Set([
  "merah", "biru", "kuning", "hijau", "putih", "hitam", "abu", "abu-abu", "coklat", "cokelat",
  "pink", "ungu", "orange", "oren", "navy", "krem", "emas", "silver", "maroon", "tosca",
  "s", "m", "l", "xl", "xxl", "xs", "kecil", "besar", "sedang",
]);

// Lepas sufiks posesif/topikal "-nya" (misal "gorengnya" -> "goreng") supaya cocok dengan nama produk asli.
function stripPossessiveSuffix(token) {
  if (token.length >= 6 && token.endsWith("nya")) return token.slice(0, -3);
  return token;
}

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(stripPossessiveSuffix);
}

function significantTokens(tokens, { dropAttributeValues = false } = {}) {
  return tokens.filter((t) => {
    if (STOP_WORDS.has(t)) return false;
    if (ATTRIBUTE_LABELS.has(t)) return false;
    if (dropAttributeValues && ATTRIBUTE_VALUES.has(t)) return false;
    if (t.length < 3 && !ATTRIBUTE_VALUES.has(t)) return false;
    return true;
  });
}

function haystackOf(product) {
  return `${product.name} ${product.description || ""} ${product.category || ""}`.toLowerCase();
}

function matchesAllTokens(haystack, tokens) {
  if (tokens.length === 0) return false;
  return tokens.every((t) => haystack.includes(t));
}

function matchesAnyToken(haystack, tokens) {
  if (tokens.length === 0) return false;
  return tokens.some((t) => haystack.includes(t));
}

/**
 * Cari produk berdasarkan teks bebas pelanggan (misal "sweater warna biru" atau "ada baju apa aja").
 * - exact: produk yang cocok dengan SEMUA kata kunci termasuk nilai atribut (warna/ukuran).
 * - broad: fallback kalau exact kosong - produk yang cocok tanpa mempertimbangkan atribut spesifik.
 */
export function matchProducts(text, ownerId) {
  const products = getAllProducts(null, ownerId) || [];
  if (products.length === 0) return { exact: [], broad: [], queryTokens: [] };

  const tokens = tokenize(text);
  const fullTokens = significantTokens(tokens, { dropAttributeValues: false });
  const baseTokens = significantTokens(tokens, { dropAttributeValues: true });

  let exact = [];
  if (fullTokens.length > 0) {
    exact = products.filter((p) => matchesAllTokens(haystackOf(p), fullTokens));
  }

  let broad = [];
  if (exact.length === 0 && baseTokens.length > 0) {
    broad = products.filter((p) => matchesAllTokens(haystackOf(p), baseTokens));
    if (broad.length === 0) {
      broad = products.filter((p) => matchesAnyToken(haystackOf(p), baseTokens));
    }
  }

  return { exact, broad, queryTokens: fullTokens.length > 0 ? fullTokens : baseTokens };
}

export function productCaption(p) {
  let text = `*${p.name}*`;
  if (p.sku) text += ` (${p.sku})`;
  text += `\n${formatCurrency(p.discount_price > 0 ? p.discount_price : p.price)}`;
  if (p.discount_price > 0) text += ` ~~${formatCurrency(p.price)}~~`;
  if (p.description) text += `\n${p.description}`;
  if (p.stock <= 0) text += "\n_(stok habis)_";
  return text;
}
