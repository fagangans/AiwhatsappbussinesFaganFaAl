import { getOrCreateCustomer, createOrder, getAllProducts, searchProducts } from "../../database/business/db.js";
import { formatCurrency } from "../../database/business/helpers.js";

const orderFlowState = new Map();
const FLOW_TTL = 10 * 60 * 1000;

function getState(senderId) {
  const entry = orderFlowState.get(senderId);
  if (!entry) return null;
  if (Date.now() - entry.updatedAt > FLOW_TTL) {
    orderFlowState.delete(senderId);
    return null;
  }
  return entry;
}

function setState(senderId, data) {
  orderFlowState.set(senderId, { ...data, updatedAt: Date.now() });
}

function clearState(senderId) {
  orderFlowState.delete(senderId);
}

export function hasActiveOrderFlow(senderId) {
  return !!getState(senderId);
}

function isCancel(text) {
  return /^(batal|cancel|gak jadi|nggak jadi|tidak jadi|stop)\b/i.test(text.trim());
}

function isYes(text) {
  return /^(ya|iya|y|ok|oke|okay|yes|benar|betul|lanjut|setuju|gas)\b/i.test(text.trim());
}

function isNo(text) {
  return /^(tidak|gak|nggak|enggak|no|nope|skip)\b/i.test(text.trim());
}

function priceOf(product) {
  return product.discount_price > 0 ? product.discount_price : product.price;
}

function findProduct(text, ownerId) {
  const products = getAllProducts(null, ownerId) || [];
  const lower = text.toLowerCase();
  const bySku = products.find((p) => p.sku && lower.includes(p.sku.toLowerCase()));
  if (bySku) return bySku;
  const matches = products.filter((p) => lower.includes(p.name.toLowerCase()));
  if (matches.length > 0) {
    matches.sort((a, b) => b.name.length - a.name.length);
    return matches[0];
  }
  const results = searchProducts(text, ownerId) || [];
  return results.length === 1 ? results[0] : null;
}

function extractQty(text) {
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function productListText(products) {
  let text = "Produk yang tersedia:\n";
  products.slice(0, 15).forEach((p, i) => {
    text += `${i + 1}. ${p.name} - ${formatCurrency(priceOf(p))}\n`;
  });
  text += "\nBalas nama atau nomor produknya ya.";
  return text;
}

export function startOrderFlow(text, ctx) {
  const { senderId, ownerId, botId } = ctx;
  const products = getAllProducts(null, ownerId) || [];
  if (products.length === 0) {
    clearState(senderId);
    return "Maaf, belum ada produk yang tersedia saat ini. 🙏";
  }

  const product = findProduct(text, ownerId);
  const qty = extractQty(text);

  if (product && qty && qty > 0) {
    if (qty > product.stock) {
      setState(senderId, { step: "qty", product, ownerId, botId });
      return `Maaf, stok *${product.name}* cuma ${product.stock}. Mau pesan berapa?`;
    }
    setState(senderId, { step: "notes", product, qty, ownerId, botId });
    return `Oke, *${product.name}* x${qty} = ${formatCurrency(priceOf(product) * qty)}.\n\nAda catatan tambahan (ukuran, warna, dll)? Balas catatannya atau ketik *tidak* kalau tidak ada.`;
  }

  if (product && !qty) {
    setState(senderId, { step: "qty", product, ownerId, botId });
    return `Mau pesan *${product.name}* berapa banyak? (Stok: ${product.stock})`;
  }

  setState(senderId, { step: "product", ownerId, botId });
  return productListText(products);
}

export function continueOrderFlow(text, ctx) {
  const { senderId, ownerId, botId, pushName } = ctx;
  const state = getState(senderId);
  if (!state) return null;

  if (isCancel(text)) {
    clearState(senderId);
    return "Oke, pesanan dibatalkan. 👍";
  }

  if (state.step === "product") {
    const products = getAllProducts(null, ownerId) || [];
    const idx = parseInt(text.trim());
    let product = !isNaN(idx) && idx >= 1 && idx <= products.length ? products[idx - 1] : findProduct(text, ownerId);
    if (!product) {
      return "Produk tidak ditemukan, coba sebutkan nama produknya lagi atau ketik *batal*.";
    }
    setState(senderId, { ...state, step: "qty", product });
    return `Mau pesan *${product.name}* berapa banyak? (Stok: ${product.stock})`;
  }

  if (state.step === "qty") {
    const qty = extractQty(text);
    if (!qty || qty <= 0) {
      return "Jumlahnya berapa ya? Balas dengan angka, misal: 2";
    }
    if (qty > state.product.stock) {
      return `Maaf, stok *${state.product.name}* cuma ${state.product.stock}. Mau pesan berapa?`;
    }
    setState(senderId, { ...state, step: "notes", qty });
    return `Oke, *${state.product.name}* x${qty} = ${formatCurrency(priceOf(state.product) * qty)}.\n\nAda catatan tambahan (ukuran, warna, dll)? Balas catatannya atau ketik *tidak* kalau tidak ada.`;
  }

  if (state.step === "notes") {
    const notes = isNo(text) ? "" : text.trim().slice(0, 200);
    setState(senderId, { ...state, step: "confirm", notes });
    const total = priceOf(state.product) * state.qty;
    let summary = `Konfirmasi pesanan:\n*${state.product.name}* x${state.qty} = ${formatCurrency(total)}\n`;
    if (notes) summary += `Catatan: ${notes}\n`;
    summary += `\nBalas *ya* untuk buat pesanan, atau *batal* untuk membatalkan.`;
    return summary;
  }

  if (state.step === "confirm") {
    if (isYes(text)) {
      const customer = getOrCreateCustomer(senderId, pushName || "Customer", ownerId, botId);
      const total = priceOf(state.product) * state.qty;
      const order = createOrder(
        customer.id,
        [{ product_id: state.product.id, sku: state.product.sku, name: state.product.name, price: priceOf(state.product), qty: state.qty }],
        total,
        state.notes || "",
        "",
        ownerId,
        botId,
      );
      clearState(senderId);
      return `Pesanan berhasil dibuat! 🎉\n\nNo. Order: *${order.order_number}*\nTotal: ${formatCurrency(total)}\n\nKetik *.cekorder ${order.order_number}* buat cek status ya.`;
    }
    if (isNo(text)) {
      clearState(senderId);
      return "Oke, pesanan dibatalkan. 👍";
    }
    return "Balas *ya* untuk konfirmasi pesanan, atau *batal* untuk membatalkan.";
  }

  clearState(senderId);
  return null;
}
