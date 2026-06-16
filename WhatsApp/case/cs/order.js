import {
  hasSession,
  setSession,
  deleteSession,
} from "../../lib/gameSession.js";
import {
  listProducts,
  findProductIndex,
  getProductByIndex,
  adjustStock,
} from "../../lib/products.js";
import { createOrder } from "../../lib/orders.js";
import { notifyAdmins } from "../../lib/notifyAdmin.js";

const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 menit per langkah, reset setiap langkah maju

export const info = {
  name: "Order",

  menu: ["Order"],
  case: ["order", "pesan"],

  description: "Pesan produk langsung lewat chat, langkah demi langkah",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

function formatCatalog(products) {
  return products
    .map(
      (p, i) =>
        `${i + 1}. *${p.name}* - Rp${p.price.toLocaleString("id-ID")} (Stok: ${p.stock})${p.desc ? `\n   ${p.desc}` : ""}`,
    )
    .join("\n\n");
}

export default async function handler(leni) {
  const { LenwyText, replyJid, normalizedSender, pushname, lenwy } = leni;

  if (hasSession(replyJid, normalizedSender)) {
    return LenwyText(
      "*Kamu masih punya sesi yang aktif!* Selesaikan dulu atau ketik *batal* untuk membatalkan.",
    );
  }

  const products = listProducts();
  if (!products.length) {
    return LenwyText("⚠️ Maaf, belum ada produk yang tersedia saat ini.");
  }

  const state = { step: "pilih_produk" };

  function makeTimer() {
    return setTimeout(async () => {
      deleteSession(replyJid, normalizedSender);
      await LenwyText(
        "⏰ *Waktu Habis!* Sesi pemesanan dibatalkan karena tidak ada respon. Ketik *.order* untuk mulai lagi.",
      );
    }, SESSION_TIMEOUT);
  }

  async function onAnswer(input, ctx) {
    const text = (ctx.rawBody || input).trim();
    const lower = input.trim();

    if (lower === "batal") {
      deleteSession(replyJid, normalizedSender);
      await ctx.LenwyText("❌ Pesanan dibatalkan.");
      return true;
    }

    if (state.step === "pilih_produk") {
      const index = findProductIndex(lower);
      const product = index !== -1 ? getProductByIndex(index) : null;
      if (!product) {
        await ctx.LenwyText(
          "⚠️ Produk tidak ditemukan. Ketik *nomor* atau *nama produk* yang valid, atau *batal* untuk keluar.",
        );
        return true;
      }
      if (product.stock <= 0) {
        await ctx.LenwyText("⚠️ Stok produk ini habis. Pilih produk lain atau ketik *batal*.");
        return true;
      }
      state.productIndex = index;
      state.product = product;
      state.step = "jumlah";
      setSession(replyJid, normalizedSender, { type: "order", timer: makeTimer(), onAnswer });
      await ctx.LenwyText(
        `✅ Produk: *${product.name}*\n\nBerapa jumlah yang ingin dipesan? (Stok tersedia: ${product.stock})`,
      );
      return true;
    }

    if (state.step === "jumlah") {
      const qty = parseInt(lower, 10);
      if (isNaN(qty) || qty <= 0) {
        await ctx.LenwyText("⚠️ Masukkan jumlah yang valid (angka lebih dari 0).");
        return true;
      }
      if (qty > state.product.stock) {
        await ctx.LenwyText(
          `⚠️ Stok tidak cukup. Stok tersedia: ${state.product.stock}. Masukkan jumlah lain.`,
        );
        return true;
      }
      state.qty = qty;
      state.step = "data_pelanggan";
      setSession(replyJid, normalizedSender, { type: "order", timer: makeTimer(), onAnswer });
      await ctx.LenwyText(
        `✅ Jumlah: *${qty}*\n\nSekarang ketik *Nama* dan *Alamat* lengkap kamu dengan format:\nNama / Alamat lengkap`,
      );
      return true;
    }

    if (state.step === "data_pelanggan") {
      const parts = text.split("/");
      if (parts.length < 2 || !parts[0].trim() || !parts.slice(1).join("/").trim()) {
        await ctx.LenwyText("⚠️ Format salah. Ketik dengan format:\nNama / Alamat lengkap");
        return true;
      }
      state.customerName = parts[0].trim();
      state.customerAddress = parts.slice(1).join("/").trim();
      state.step = "konfirmasi";
      setSession(replyJid, normalizedSender, { type: "order", timer: makeTimer(), onAnswer });

      const total = state.product.price * state.qty;
      await ctx.LenwyText(
        `*KONFIRMASI PESANAN*\n\n` +
          `Produk: *${state.product.name}*\n` +
          `Jumlah: *${state.qty}*\n` +
          `Total: *Rp${total.toLocaleString("id-ID")}*\n` +
          `Nama: *${state.customerName}*\n` +
          `Alamat: *${state.customerAddress}*\n\n` +
          `Ketik *YA* untuk konfirmasi, atau *BATAL* untuk membatalkan.`,
      );
      return true;
    }

    if (state.step === "konfirmasi") {
      if (lower !== "ya") {
        await ctx.LenwyText("⚠️ Ketik *YA* untuk konfirmasi pesanan, atau *BATAL* untuk membatalkan.");
        return true;
      }

      deleteSession(replyJid, normalizedSender);

      const total = state.product.price * state.qty;
      adjustStock(state.productIndex, -state.qty);

      const order = createOrder({
        customerId: normalizedSender,
        customerName: state.customerName,
        customerAddress: state.customerAddress,
        customerPushname: pushname,
        product: state.product.name,
        qty: state.qty,
        total,
      });

      await ctx.LenwyText(
        `🎉 *Pesanan Berhasil Dibuat!*\n\n` +
          `ID Pesanan: *#${order.id}*\n` +
          `Produk: *${state.product.name}* x${state.qty}\n` +
          `Total: *Rp${total.toLocaleString("id-ID")}*\n\n` +
          `Admin kami akan segera menghubungi kamu untuk info pembayaran dan proses selanjutnya. Terima kasih! 🙏`,
      );

      await notifyAdmins(
        lenwy,
        `🛎️ *PESANAN BARU #${order.id}*\n\n` +
          `Produk: ${state.product.name} x${state.qty}\n` +
          `Total: Rp${total.toLocaleString("id-ID")}\n` +
          `Nama: ${state.customerName}\n` +
          `Alamat: ${state.customerAddress}\n` +
          `Kontak: wa.me/${normalizedSender.split("@")[0]}\n\n` +
          `Cek detail lengkap di dashboard atau ketik *.listpesanan*`,
      );

      return true;
    }

    return true;
  }

  setSession(replyJid, normalizedSender, { type: "order", timer: makeTimer(), onAnswer });

  await LenwyText(
    `🛒 *MULAI PESANAN*\n\n` +
      `Pilih produk dengan ketik *nomor* atau *nama produk*:\n\n` +
      `${formatCatalog(products)}\n\n` +
      `Ketik *batal* untuk membatalkan kapan saja.`,
  );
}
