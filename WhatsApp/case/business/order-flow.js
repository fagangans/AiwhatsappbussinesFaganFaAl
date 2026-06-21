import { getOrCreateCustomer, createOrder, getAllProducts, searchProducts, getVariants, validateVoucher, useVoucher, getAllPaymentMethods } from "../../database/business/db.js";
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

function isAddMore(text) {
  return /^(tambah|lagi|add|more|tambah lagi)\b/i.test(text.trim());
}

function priceOf(product, variant = null) {
  const base = product.discount_price > 0 ? product.discount_price : product.price;
  return variant ? base + (variant.price_adjustment || 0) : base;
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
    text += `${i + 1}. ${p.name} - ${formatCurrency(priceOf(p))}`;
    if (p.stock <= 0) text += " _(habis)_";
    text += "\n";
  });
  text += "\nBalas nama atau nomor produknya ya.";
  return text;
}

function cartSummary(cart) {
  let text = "🛒 *Keranjang:*\n";
  let total = 0;
  cart.forEach((item, i) => {
    const subtotal = item.price * item.qty;
    total += subtotal;
    text += `${i + 1}. ${item.name}${item.variant_name ? ` (${item.variant_name})` : ""} x${item.qty} = ${formatCurrency(subtotal)}\n`;
  });
  text += `\n*Subtotal: ${formatCurrency(total)}*`;
  return { text, total };
}

export function startOrderFlow(text, ctx) {
  const { senderId, ownerId, botId } = ctx;
  const products = getAllProducts(null, ownerId) || [];
  if (products.length === 0) {
    clearState(senderId);
    return { text: "Maaf, belum ada produk yang tersedia saat ini. 🙏" };
  }

  const product = findProduct(text, ownerId);
  const qty = extractQty(text);

  if (product && qty && qty > 0) {
    if (qty > product.stock) {
      setState(senderId, { step: "qty", product, cart: [], ownerId, botId });
      return { text: `Maaf, stok *${product.name}* cuma ${product.stock}. Mau pesan berapa?` };
    }
    const variants = getVariants(product.id);
    if (variants.length > 0) {
      setState(senderId, { step: "variant", product, qty, cart: [], ownerId, botId });
      let vText = `Pilih varian *${product.name}*:\n`;
      variants.forEach((v, i) => {
        const adj = v.price_adjustment > 0 ? ` (+${formatCurrency(v.price_adjustment)})` : "";
        vText += `${i + 1}. ${v.variant_name}${adj} (stok: ${v.stock})\n`;
      });
      vText += "\nBalas nomor atau nama variannya.";
      return { text: vText };
    }
    const item = { product_id: product.id, sku: product.sku, name: product.name, price: priceOf(product), qty };
    setState(senderId, { step: "more", cart: [item], ownerId, botId });
    const { text: sumText, total } = cartSummary([item]);
    return { text: `${sumText}\n\nMau *tambah* produk lain atau lanjut? Balas *tambah* atau *lanjut*.`, imageUrl: product.image_url };
  }

  if (product && !qty) {
    setState(senderId, { step: "qty", product, cart: [], ownerId, botId });
    return { text: `Mau pesan *${product.name}* berapa banyak? (Stok: ${product.stock})`, imageUrl: product.image_url };
  }

  setState(senderId, { step: "product", cart: [], ownerId, botId });
  return { text: productListText(products) };
}

export function continueOrderFlow(text, ctx) {
  const { senderId, ownerId, botId, pushName } = ctx;
  const state = getState(senderId);
  if (!state) return null;

  if (isCancel(text)) {
    clearState(senderId);
    return { text: "Oke, pesanan dibatalkan. 👍" };
  }

  if (state.step === "product") {
    const products = getAllProducts(null, ownerId) || [];
    const idx = parseInt(text.trim());
    let product = !isNaN(idx) && idx >= 1 && idx <= products.length ? products[idx - 1] : findProduct(text, ownerId);
    if (!product) {
      return { text: "Produk tidak ditemukan, coba sebutkan nama produknya lagi atau ketik *batal*." };
    }
    if (product.stock <= 0) {
      return { text: `Maaf, *${product.name}* sedang habis stok. Pilih produk lain ya.` };
    }
    setState(senderId, { ...state, step: "qty", product });
    return { text: `Mau pesan *${product.name}* berapa banyak? (Stok: ${product.stock})`, imageUrl: product.image_url };
  }

  if (state.step === "qty") {
    const qty = extractQty(text);
    if (!qty || qty <= 0) {
      return { text: "Jumlahnya berapa ya? Balas dengan angka, misal: 2" };
    }
    if (qty > state.product.stock) {
      return { text: `Maaf, stok *${state.product.name}* cuma ${state.product.stock}. Mau pesan berapa?` };
    }
    const variants = getVariants(state.product.id);
    if (variants.length > 0) {
      setState(senderId, { ...state, step: "variant", qty });
      let vText = `Pilih varian *${state.product.name}*:\n`;
      variants.forEach((v, i) => {
        const adj = v.price_adjustment > 0 ? ` (+${formatCurrency(v.price_adjustment)})` : "";
        vText += `${i + 1}. ${v.variant_name}${adj} (stok: ${v.stock})\n`;
      });
      vText += "\nBalas nomor atau nama variannya.";
      return { text: vText };
    }
    const item = { product_id: state.product.id, sku: state.product.sku, name: state.product.name, price: priceOf(state.product), qty };
    const cart = [...(state.cart || []), item];
    setState(senderId, { ...state, step: "more", cart, product: undefined, qty: undefined });
    const { text: sumText } = cartSummary(cart);
    return { text: `${sumText}\n\nMau *tambah* produk lain atau *lanjut*?` };
  }

  if (state.step === "variant") {
    const variants = getVariants(state.product.id);
    const idx = parseInt(text.trim());
    let variant = !isNaN(idx) && idx >= 1 && idx <= variants.length ? variants[idx - 1] : variants.find(v => text.toLowerCase().includes(v.variant_name.toLowerCase()));
    if (!variant) {
      return { text: "Varian tidak ditemukan, coba balas nomor atau nama variannya lagi." };
    }
    if (state.qty > variant.stock) {
      return { text: `Maaf, stok varian *${variant.variant_name}* cuma ${variant.stock}. Mau pesan berapa?` };
    }
    const price = priceOf(state.product, variant);
    const item = { product_id: state.product.id, variant_id: variant.id, sku: variant.sku || state.product.sku, name: state.product.name, variant_name: variant.variant_name, price, qty: state.qty };
    const cart = [...(state.cart || []), item];
    setState(senderId, { ...state, step: "more", cart, product: undefined, qty: undefined });
    const { text: sumText } = cartSummary(cart);
    return { text: `${sumText}\n\nMau *tambah* produk lain atau *lanjut*?` };
  }

  if (state.step === "more") {
    if (isAddMore(text) || /^tambah/i.test(text.trim())) {
      setState(senderId, { ...state, step: "product" });
      const products = getAllProducts(null, ownerId) || [];
      return { text: productListText(products) };
    }
    if (isYes(text) || /^(lanjut|checkout|bayar|selesai)\b/i.test(text.trim())) {
      setState(senderId, { ...state, step: "notes" });
      return { text: "Ada catatan tambahan untuk pesanan ini? Balas catatannya atau ketik *tidak* kalau tidak ada." };
    }
    return { text: "Balas *tambah* untuk tambah produk lain, atau *lanjut* untuk checkout." };
  }

  if (state.step === "notes") {
    const notes = isNo(text) ? "" : text.trim().slice(0, 500);
    setState(senderId, { ...state, step: "voucher", notes });
    return { text: "Punya kode voucher/diskon? Balas kodenya atau ketik *tidak*." };
  }

  if (state.step === "voucher") {
    let discount = 0;
    let voucherCode = "";
    const { total } = cartSummary(state.cart);
    if (!isNo(text)) {
      const code = text.trim().toUpperCase();
      const result = validateVoucher(code, total, ownerId);
      if (!result.valid) {
        return { text: `${result.reason}\n\nCoba kode lain atau ketik *tidak* untuk lanjut tanpa voucher.` };
      }
      discount = result.discount;
      voucherCode = code;
    }
    const methods = getAllPaymentMethods(ownerId) || [];
    if (methods.length === 0) {
      setState(senderId, { ...state, step: "confirm", discount, voucherCode });
      let confirm = `Konfirmasi pesanan:\n${cartSummary(state.cart).text}\n`;
      if (discount > 0) confirm += `Diskon (${voucherCode}): -${formatCurrency(discount)}\n*Grand Total: ${formatCurrency(total - discount)}*\n`;
      if (state.notes) confirm += `Catatan: ${state.notes}\n`;
      confirm += `\nBalas *ya* untuk buat pesanan, atau *batal* untuk membatalkan.`;
      return { text: confirm };
    }
    setState(senderId, { ...state, step: "payment", discount, voucherCode });
    let pText = `Mau bayar pakai metode apa?\n`;
    methods.forEach((m, i) => {
      pText += `${i + 1}. ${m.name}\n`;
    });
    pText += `\nBalas nomor atau nama metodenya ya.`;
    return { text: pText };
  }

  if (state.step === "payment") {
    const methods = getAllPaymentMethods(ownerId) || [];
    const idx = parseInt(text.trim());
    let method = !isNaN(idx) && idx >= 1 && idx <= methods.length ? methods[idx - 1] : methods.find(m => text.toLowerCase().includes(m.name.toLowerCase()));
    if (!method) {
      return { text: "Metode pembayaran tidak ditemukan, coba balas nomor atau nama metodenya lagi." };
    }
    setState(senderId, { ...state, step: "confirm", paymentMethod: method });
    const { total } = cartSummary(state.cart);
    const discount = state.discount || 0;
    let confirm = `Konfirmasi pesanan:\n${cartSummary(state.cart).text}\n`;
    if (discount > 0) confirm += `Diskon (${state.voucherCode}): -${formatCurrency(discount)}\n*Grand Total: ${formatCurrency(total - discount)}*\n`;
    if (state.notes) confirm += `Catatan: ${state.notes}\n`;
    confirm += `Pembayaran: ${method.name}\n`;
    confirm += `\nBalas *ya* untuk buat pesanan, atau *batal* untuk membatalkan.`;
    return { text: confirm };
  }

  if (state.step === "confirm") {
    if (isYes(text)) {
      const customer = getOrCreateCustomer(senderId, pushName || "Customer", ownerId, botId);
      const { total: subtotal } = cartSummary(state.cart);
      const discount = state.discount || 0;
      const grandTotal = subtotal - discount;
      const order = createOrder(
        customer.id,
        state.cart,
        grandTotal,
        state.notes || "",
        "",
        ownerId,
        botId,
        state.paymentMethod?.name || "",
      );
      if (state.voucherCode) useVoucher(state.voucherCode, ownerId);
      clearState(senderId);
      let doneText = `Pesanan berhasil dibuat! 🎉\n\nNo. Order: *${order.order_number}*\nTotal: ${formatCurrency(grandTotal)}\n`;
      if (state.paymentMethod) {
        doneText += `Pembayaran: ${state.paymentMethod.name}\n`;
        if (state.paymentMethod.account_number) doneText += `No. Rekening/Akun: ${state.paymentMethod.account_number}${state.paymentMethod.account_name ? ` (${state.paymentMethod.account_name})` : ""}\n`;
        if (state.paymentMethod.instructions) doneText += `${state.paymentMethod.instructions}\n`;
      }
      doneText += `\nKetik *.cekorder ${order.order_number}* buat cek status ya.`;
      return { text: doneText, order, customerName: customer.name || pushName || "Customer" };
    }
    if (isNo(text)) {
      clearState(senderId);
      return { text: "Oke, pesanan dibatalkan. 👍" };
    }
    return { text: "Balas *ya* untuk konfirmasi pesanan, atau *batal* untuk membatalkan." };
  }

  clearState(senderId);
  return null;
}
