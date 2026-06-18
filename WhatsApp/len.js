/*  

  Made By Lenwy
  Base : Lenwy
  WhatsApp : wa.me/6283829814737
  Telegram : t.me/ilenwy
  Youtube : @Lenwy

  Channel : https://whatsapp.com/channel/0029VaGdzBSGZNCmoTgN2K0u

  Copy Code?, Recode?, Rename?, Reupload?, Reseller? Taruh Credit Ya :D

  Mohon Untuk Tidak Menghapus Watermark Di Dalam Kode Ini

*/

// Import Module
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

// Path ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom Credit Sticker
globalThis.spackname = "Lenwy SCM"; // Ganti Sesuai Keinginan
globalThis.sauthor = "Youtube : Lenwy\nBot: 0856-2497-5232"; // Ganti Sesuai Keinginan

// Custom Prefix
globalThis.prefix = ["#", ".", "!", "/"]; // Multi Prefix (Custom Prefix)
globalThis.noprefix = false; // True = Tanpa Prefix, False = Pakai Prefix

// Custom Menu Image
globalThis.MenuImage = path.join(__dirname, "./database/image/lenwy.jpeg"); // Ganti Dengan Path Gambar Menu

// Custom Message
globalThis.mess = {
  wait: "☕ *Mohon tunggu sebentar...*",
  error: "⚠ *Maaf, terjadi kesalahan. Silakan coba lagi.*",
  default: "📑 *Perintah tidak dikenali. Ketik .menu untuk bantuan.*",
  admin: "⚠️ Fitur ini khusus admin grup.",
  botadmin: "⚠️ Bot harus menjadi admin terlebih dahulu.",
  group: "⚠️ Fitur ini hanya bisa digunakan di grup.",
  private: "⚠️ Fitur ini hanya bisa digunakan di private chat.",
  premium: "⚠️ Fitur ini khusus user premium.",
  order: "⚠ *Pembayaran hanya bisa dilakukan di private chat.*",
  creator: "⚠️ Fitur ini khusus owner.",
  disable: "🚫 Fitur ini sedang dinonaktifkan.",
  maintenance: "🛠 Fitur ini sedang dalam perbaikan.",
};
