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

export function pauseOrderFlow(senderId) {
  const state = getState(senderId);
  if (state) setState(senderId, { ...state });
}

export function getOrderFlowState(senderId) {
  return getState(senderId);
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
  return /\b(tambah|lagi|add|more)\b/i.test(text.trim());
}

function isCheckout(text) {
  return /\b(lanjut|checkout|bayar|selesai|gas|oke|ok|ya)\b/i.test(text.trim());
}

function isOffScriptQuestion(text) {
  const t = text.trim();
  if (t.length === 0) return false;
  if (/\?$/.test(t)) return true;
  if (/^(apa|gimana|bagaimana|kenapa|mengapa|kapan|dimana|siapa|kok|emang|maksudnya|jelasin|jelaskan|terus|trs|info|tentang|cerita|ceritakan|tolong jelas)/i.test(t)) return true;
  return false;
}

function getStepHint(step, state) {
  if (step === "product") return "_Btw, kamu lagi pilih produk yang mau dipesan. Balas nama atau nomor produknya kalau mau lanjut_ 😊";
  if (step === "qty") return `_Btw, kamu lagi pesan *${state.product?.name || "produk"}*. Balas jumlahnya (angka) kalau mau lanjut_ 😊`;
  if (step === "variant") return `_Btw, kamu lagi pilih varian. Balas nomor variannya kalau mau lanjut_ 😊`;
  if (step === "more") return "_Btw, ada produk di keranjang kamu. Ketik *tambah* untuk tambah produk, atau *lanjut* untuk checkout_ 😊";
  if (step === "notes") return "_Btw, kamu lagi isi catatan pesanan. Tulis catatannya atau ketik *tidak* untuk skip_ 😊";
  if (step === "voucher") return "_Btw, kamu lagi di tahap voucher. Balas kode voucher atau ketik *tidak* untuk skip_ 😊";
  if (step === "payment") return "_Btw, kamu lagi pilih metode bayar. Balas nomor atau nama metodenya_ 😊";
  if (step === "confirm") return "_Btw, kamu lagi tahap konfirmasi pesanan. Balas *ya* untuk konfirmasi atau *batal* untuk membatalkan_ 😊";
  return "";
}

function priceOf(product, variant = null) {
  const base = product.discount_price > 0 ? product.discount_price : product.price;
  return variant ? base + (variant.price_adjustment || 0) : base;
}

function normalizeWords(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
}

function findProduct(text, ownerId) {
  const products = getAllProducts(null, ownerId) || [];
  if (products.length === 0) return null;
  const lower = text.toLowerCase();

  const bySku = products.find((p) => p.sku && lower.includes(p.sku.toLowerCase()));
  if (bySku) return bySku;

  const fullMatch = products.filter((p) => lower.includes(p.name.toLowerCase()));
  if (fullMatch.length > 0) {
    fullMatch.sort((a, b) => b.name.length - a.name.length);
    return fullMatch[0];
  }

  const inputWords = normalizeWords(text.replace(/\d+/g, "").replace(/\b(mau|beli|pesan|order|saya|aku|gw|gue|dong|ya|yuk|bisa|gak|gk|tidak|ini|itu|yang|mw|mo|pen|ingin|pengen|kak|min|gan|bos|bang|mas|mba|sis)\b/gi, ""));
  if (inputWords.length > 0) {
    let bestProduct = null;
    let bestScore = 0;
    for (const p of products) {
      const productWords = normalizeWords(p.name);
      let matched = 0;
      for (const pw of productWords) {
        if (inputWords.some(iw => iw.includes(pw) || pw.includes(iw))) matched++;
      }
      const score = productWords.length > 0 ? matched / productWords.length : 0;
      if (score > bestScore && score >= 0.5) {
        bestScore = score;
        bestProduct = p;
      }
    }
    if (bestProduct) return bestProduct;
  }

  const results = searchProducts(text, ownerId) || [];
  if (results.length === 1) return results[0];

  if (inputWords.length > 0) {
    for (const word of inputWords) {
      if (word.length >= 3) {
        const r = searchProducts(word, ownerId) || [];
        if (r.length === 1) return r[0];
      }
    }
  }

  return null;
}

function extractQty(text) {
  const cleaned = text.replace(/\b(rp|rupiah|ribu|rb|jt|juta)\s*[\d.,]+/gi, "");
  const match = cleaned.match(/\b(\d+)\b/);
  return match ? parseInt(match[1]) : null;
}

function productListText(products) {
  let text = "Produk yang tersedia:\n";
  products.slice(0, 15).forEach((p, i) => {
    text += `${i + 1}. ${p.name} - ${formatCurrency(priceOf(p))}`;
    if (p.stock <= 0) text += " _(habis)_";
    text += "\n";
  });
  text += "\nMau pesan yang mana? Sebut aja nama atau nomornya 😊";
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

function addToCartAndRespond(senderId, state, product, qty, ownerId, botId) {
  const variants = getVariants(product.id);
  if (variants.length > 0) {
    setState(senderId, { ...state, step: "variant", product, qty });
    let vText = `Pilih varian *${product.name}*:\n`;
    variants.forEach((v, i) => {
      const adj = v.price_adjustment > 0 ? ` (+${formatCurrency(v.price_adjustment)})` : "";
      vText += `${i + 1}. ${v.variant_name}${adj} (stok: ${v.stock})\n`;
    });
    vText += "\nBalas nomor atau nama variannya ya";
    return { text: vText };
  }
  const item = { product_id: product.id, sku: product.sku, name: product.name, price: priceOf(product), qty };
  const cart = [...(state.cart || []), item];
  setState(senderId, { ...state, step: "more", cart, product: undefined, qty: undefined });
  const { text: sumText } = cartSummary(cart);
  return { text: `${sumText}\n\nMau *tambah* produk lain atau *lanjut* checkout?`, imageUrl: product.image_url };
}

export function startOrderFlow(text, ctx) {
  const { senderId, ownerId, botId } = ctx;
  const products = getAllProducts(null, ownerId) || [];
  if (products.length === 0) {
    clearState(senderId);
    return { text: "Maaf, belum ada produk yang tersedia saat ini 🙏" };
  }

  const product = findProduct(text, ownerId);
  const qty = extractQty(text);

  if (product && qty && qty > 0) {
    if (qty > product.stock) {
      setState(senderId, { step: "qty", product, cart: [], ownerId, botId });
      return { text: `Maaf, stok *${product.name}* tinggal ${product.stock} nih. Mau pesan berapa?` };
    }
    return addToCartAndRespond(senderId, { cart: [], ownerId, botId }, product, qty, ownerId, botId);
  }

  if (product && !qty) {
    setState(senderId, { step: "qty", product, cart: [], ownerId, botId });
    return { text: `*${product.name}* — ${formatCurrency(priceOf(product))}\nMau pesan berapa? (stok: ${product.stock})`, imageUrl: product.image_url };
  }

  if (products.length === 1) {
    const p = products[0];
    if (p.stock <= 0) {
      clearState(senderId);
      return { text: `Maaf, *${p.name}* lagi habis stok 🙏` };
    }
    setState(senderId, { step: "qty", product: p, cart: [], ownerId, botId });
    return { text: `Kami punya *${p.name}* — ${formatCurrency(priceOf(p))}\nMau pesan berapa? (stok: ${p.stock})`, imageUrl: p.image_url };
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
    return { text: "Oke, pesanan dibatalkan 👍" };
  }

  if (state.step === "product") {
    const products = getAllProducts(null, ownerId) || [];
    const idx = parseInt(text.trim());
    let product = null;
    let qty = null;

    if (!isNaN(idx) && idx >= 1 && idx <= products.length) {
      product = products[idx - 1];
    }

    if (!product) {
      product = findProduct(text, ownerId);
    }

    if (product) {
      if (product.stock <= 0) {
        return { text: `Maaf, *${product.name}* lagi habis stok. Pilih yang lain ya 😊` };
      }
      qty = extractQty(text);
      if (qty && qty > 0) {
        if (qty > product.stock) {
          setState(senderId, { ...state, step: "qty", product });
          return { text: `Stok *${product.name}* tinggal ${product.stock} nih. Mau pesan berapa?` };
        }
        return addToCartAndRespond(senderId, state, product, qty, ownerId, botId);
      }
      setState(senderId, { ...state, step: "qty", product });
      return { text: `*${product.name}* — ${formatCurrency(priceOf(product))}\nMau pesan berapa? (stok: ${product.stock})`, imageUrl: product.image_url };
    }

    return { fallthrough: true, hint: getStepHint("product", state) };
  }

  if (state.step === "qty") {
    const qty = extractQty(text);

    if (qty && qty > 0) {
      if (qty > state.product.stock) {
        return { text: `Maaf, stok *${state.product.name}* tinggal ${state.product.stock}. Mau pesan berapa?` };
      }
      return addToCartAndRespond(senderId, state, state.product, qty, ownerId, botId);
    }

    const product = findProduct(text, ownerId);
    if (product && product.id !== state.product.id) {
      setState(senderId, { ...state, step: "qty", product });
      return { text: `Oke, ganti ke *${product.name}* ya — ${formatCurrency(priceOf(product))}\nMau pesan berapa? (stok: ${product.stock})`, imageUrl: product.image_url };
    }

    if (isOffScriptQuestion(text)) {
      return { fallthrough: true, hint: getStepHint("qty", state) };
    }

    return { text: `Mau pesan *${state.product.name}* berapa? Balas angkanya aja ya, misal: 2\n\nKetik *batal* kalau gak jadi` };
  }

  if (state.step === "variant") {
    const variants = getVariants(state.product.id);
    const idx = parseInt(text.trim());
    let variant = !isNaN(idx) && idx >= 1 && idx <= variants.length
      ? variants[idx - 1]
      : variants.find(v => text.toLowerCase().includes(v.variant_name.toLowerCase()));

    if (!variant) {
      const inputWords = normalizeWords(text);
      variant = variants.find(v => {
        const vWords = normalizeWords(v.variant_name);
        return vWords.some(vw => inputWords.some(iw => iw.includes(vw) || vw.includes(iw)));
      });
    }

    if (!variant) {
      if (isOffScriptQuestion(text)) {
        return { fallthrough: true, hint: getStepHint("variant", state) };
      }
      let vText = "Varian yang mana ya? Pilih dari daftar ini:\n";
      variants.forEach((v, i) => {
        const adj = v.price_adjustment > 0 ? ` (+${formatCurrency(v.price_adjustment)})` : "";
        vText += `${i + 1}. ${v.variant_name}${adj}\n`;
      });
      vText += "\nBalas nomor atau namanya aja 😊";
      return { text: vText };
    }

    if (state.qty > variant.stock) {
      return { text: `Maaf, stok varian *${variant.variant_name}* tinggal ${variant.stock}. Mau pesan berapa?` };
    }

    const price = priceOf(state.product, variant);
    const item = { product_id: state.product.id, variant_id: variant.id, sku: variant.sku || state.product.sku, name: state.product.name, variant_name: variant.variant_name, price, qty: state.qty };
    const cart = [...(state.cart || []), item];
    setState(senderId, { ...state, step: "more", cart, product: undefined, qty: undefined });
    const { text: sumText } = cartSummary(cart);
    return { text: `${sumText}\n\nMau *tambah* produk lain atau *lanjut* checkout?` };
  }

  if (state.step === "more") {
    if (isAddMore(text)) {
      setState(senderId, { ...state, step: "product" });
      const products = getAllProducts(null, ownerId) || [];
      return { text: productListText(products) };
    }

    const product = findProduct(text, ownerId);
    if (product) {
      if (product.stock <= 0) {
        return { text: `Maaf, *${product.name}* lagi habis stok. Mau tambah yang lain atau *lanjut* checkout?` };
      }
      const qty = extractQty(text);
      if (qty && qty > 0 && qty <= product.stock) {
        return addToCartAndRespond(senderId, state, product, qty, ownerId, botId);
      }
      setState(senderId, { ...state, step: "qty", product });
      return { text: `Oke tambah *${product.name}* ya. Mau berapa? (stok: ${product.stock})` };
    }

    if (isCheckout(text)) {
      setState(senderId, { ...state, step: "notes" });
      return { text: "Ada catatan tambahan untuk pesanan ini? Kalau gak ada, ketik *tidak* aja" };
    }

    return { fallthrough: true, hint: getStepHint("more", state) };
  }

  if (state.step === "notes") {
    const notes = isNo(text) ? "" : text.trim().slice(0, 500);
    setState(senderId, { ...state, step: "voucher", notes });
    return { text: "Punya kode voucher/diskon? Kalau ada, balas kodenya. Kalau gak ada, ketik *tidak*" };
  }

  if (state.step === "voucher") {
    let discount = 0;
    let voucherCode = "";
    const { total } = cartSummary(state.cart);
    if (!isNo(text)) {
      const code = text.trim().toUpperCase();
      const result = validateVoucher(code, total, ownerId);
      if (!result.valid) {
        return { text: `${result.reason}\n\nCoba kode lain atau ketik *tidak* untuk lanjut tanpa voucher` };
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
      confirm += `\nBalas *ya* untuk buat pesanan, atau *batal* untuk membatalkan`;
      return { text: confirm };
    }
    setState(senderId, { ...state, step: "payment", discount, voucherCode });
    let pText = `Mau bayar pakai metode apa?\n`;
    methods.forEach((m, i) => {
      pText += `${i + 1}. ${m.name}\n`;
    });
    pText += `\nBalas nomor atau nama metodenya ya`;
    return { text: pText };
  }

  if (state.step === "payment") {
    const methods = getAllPaymentMethods(ownerId) || [];
    const idx = parseInt(text.trim());
    let method = !isNaN(idx) && idx >= 1 && idx <= methods.length ? methods[idx - 1] : methods.find(m => text.toLowerCase().includes(m.name.toLowerCase()));
    if (!method) {
      if (isOffScriptQuestion(text)) {
        return { fallthrough: true, hint: getStepHint("payment", state) };
      }
      return { text: "Metode pembayaran yang mana ya? Balas nomor atau nama metodenya aja 😊" };
    }
    setState(senderId, { ...state, step: "confirm", paymentMethod: method });
    const { total } = cartSummary(state.cart);
    const discount = state.discount || 0;
    let confirm = `Konfirmasi pesanan:\n${cartSummary(state.cart).text}\n`;
    if (discount > 0) confirm += `Diskon (${state.voucherCode}): -${formatCurrency(discount)}\n*Grand Total: ${formatCurrency(total - discount)}*\n`;
    if (state.notes) confirm += `Catatan: ${state.notes}\n`;
    confirm += `Pembayaran: ${method.name}\n`;
    confirm += `\nBalas *ya* untuk buat pesanan, atau *batal* untuk membatalkan`;
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
      doneText += `\nKetik *.cekorder ${order.order_number}* buat cek status ya`;
      return { text: doneText, order, customerName: customer.name || pushName || "Customer" };
    }
    if (isNo(text)) {
      clearState(senderId);
      return { text: "Oke, pesanan dibatalkan 👍" };
    }
    if (isOffScriptQuestion(text)) {
      return { fallthrough: true, hint: getStepHint("confirm", state) };
    }
    return { text: "Balas *ya* untuk konfirmasi pesanan, atau *batal* kalau gak jadi" };
  }

  return { fallthrough: true, hint: getStepHint(state.step, state) };
}
