import {
  getProfile, getOrCreateCustomer, searchFaq, logMessage,
  updateDailyAnalytics, addImportantMessage,
} from "../../database/business/db.js";
import { isBusinessOpen, getGreeting } from "../../database/business/helpers.js";
import { analyzeImportantMessage } from "../../database/business/analyzer.js";

export function handleAutoReply(lenwy, replyJid, normalizedSender, pushname, body, botId = "", dashboardApp = null, ownerId = 1) {
  const profile = getProfile(ownerId);
  if (!profile.auto_reply_enabled) return false;

  const customer = getOrCreateCustomer(normalizedSender, pushname, ownerId, botId);

  logMessage(customer.id, "in", body, "text", ownerId, botId);
  updateDailyAnalytics({ messages_in: 1 }, ownerId);

  const analysis = analyzeImportantMessage(body);
  if (analysis) {
    const saved = addImportantMessage(botId, customer.id, pushname, normalizedSender, body, analysis.category, analysis.priority, ownerId);
    if (dashboardApp && dashboardApp.broadcast) {
      dashboardApp.broadcast({ type: "important_message", data: saved });
    }
  }

  if (customer.is_blocked) return true;

  return false;
}

export async function handleWelcomeMessage(lenwy, replyJid, normalizedSender, pushname, len, ownerId = 1, botId = "") {
  const profile = getProfile(ownerId);
  if (!profile.auto_reply_enabled) return false;

  const { default: db } = await import("../../database/business/db.js");
  const customer = db.prepare("SELECT * FROM customers WHERE jid = ? AND owner_id = ?").get(normalizedSender, ownerId);

  if (!customer) return false;

  const outCount = db.prepare("SELECT COUNT(*) as c FROM messages_log WHERE customer_id = ? AND direction = 'out'").get(customer.id);
  if (outCount.c > 0) return false;

  const greeting = getGreeting();
  let welcomeMsg = profile.welcome_message || "Halo! Ada yang bisa kami bantu?";

  welcomeMsg = welcomeMsg
    .replace("{nama}", pushname)
    .replace("{greeting}", greeting)
    .replace("{bisnis}", profile.name || "Kami");

  const open = isBusinessOpen();

  let text = `${greeting}, *${pushname}*! 👋\n\n`;
  text += `${welcomeMsg}\n\n`;

  if (!open) {
    text += `⏰ _Saat ini di luar jam operasional (${String(profile.open_hour).padStart(2, "0")}:00 - ${String(profile.close_hour).padStart(2, "0")}:00)._\n`;
    text += `_${profile.away_message}_\n\n`;
  }

  text += `Saya bisa bantu kamu untuk:\n\n`;
  text += `🛍️ *Lihat Katalog* — ketik "lihat produk" atau "ada barang apa aja"\n`;
  text += `🛒 *Pesan Barang* — ketik "mau pesan" atau langsung sebut produknya\n`;
  text += `📋 *Cek Pesanan* — ketik "cek pesanan saya"\n`;
  text += `💳 *Info Pembayaran* — ketik "cara bayar gimana"\n`;
  text += `❓ *Tanya-Tanya* — langsung tanya aja, misal "ada promo gak?"\n`;
  text += `🎫 *Buat Tiket Support* — kalau ada keluhan, bilang aja "mau buat tiket"\n\n`;
  text += `_Langsung chat aja ya, gak perlu pakai format khusus!_ 😊`;

  await lenwy.sendMessage(replyJid, { text }, { quoted: len });
  logMessage(customer.id, "out", text, "text", ownerId, botId);
  updateDailyAnalytics({ messages_out: 1 }, ownerId);
  return true;
}

export async function handleAwayMessage(lenwy, replyJid, normalizedSender, pushname, len, ownerId = 1, botId = "") {
  const profile = getProfile(ownerId);
  if (!profile.auto_reply_enabled) return false;
  if (isBusinessOpen()) return false;

  const { default: db } = await import("../../database/business/db.js");
  const customer = db.prepare("SELECT * FROM customers WHERE jid = ? AND owner_id = ?").get(normalizedSender, ownerId);
  if (!customer) return false;

  const recentAway = db.prepare(`
    SELECT COUNT(*) as c FROM messages_log
    WHERE customer_id = ? AND direction = 'out' AND content LIKE '%luar jam operasional%'
    AND timestamp > datetime('now', '-1 hour')
  `).get(customer.id);

  if (recentAway.c > 0) return false;

  let awayMsg = profile.away_message || "Saat ini kami sedang offline.";
  awayMsg = awayMsg
    .replace("{nama}", pushname)
    .replace("{bisnis}", profile.name || "Kami");

  const text = `⏰ *Di Luar Jam Operasional*\n\n${awayMsg}\n\n_Jam operasional: ${String(profile.open_hour).padStart(2, "0")}:00 - ${String(profile.close_hour).padStart(2, "0")}:00_`;

  await lenwy.sendMessage(replyJid, { text }, { quoted: len });
  logMessage(customer.id, "out", text, "text", ownerId, botId);
  return true;
}
