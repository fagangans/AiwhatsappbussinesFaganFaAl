import {
  getProfile, getOrCreateCustomer, searchFaq, logMessage,
  updateDailyAnalytics,
} from "../../database/business/db.js";
import { isBusinessOpen, getGreeting } from "../../database/business/helpers.js";

export function handleAutoReply(lenwy, replyJid, normalizedSender, pushname, body) {
  const profile = getProfile();
  if (!profile.auto_reply_enabled) return false;

  const customer = getOrCreateCustomer(normalizedSender, pushname);

  logMessage(customer.id, "in", body, "text");
  updateDailyAnalytics({ messages_in: 1 });

  if (customer.is_blocked) return true;

  return false;
}

export async function handleWelcomeMessage(lenwy, replyJid, normalizedSender, pushname, len) {
  const profile = getProfile();
  if (!profile.auto_reply_enabled) return;

  const { default: db } = await import("../../database/business/db.js");
  const customer = db.prepare("SELECT * FROM customers WHERE jid = ?").get(normalizedSender);

  if (!customer) return;

  const msgCount = db.prepare("SELECT COUNT(*) as c FROM messages_log WHERE customer_id = ?").get(customer.id);
  if (msgCount.c > 1) return;

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

  text += `📋 *Menu Tersedia:*\n`;
  text += `• *.katalog* - Lihat produk\n`;
  text += `• *.faq* - Pertanyaan umum\n`;
  text += `• *.pesan* - Buat pesanan\n`;
  text += `• *.buattiket* - Buat tiket support\n`;
  text += `• *.cekorder* - Cek pesanan\n`;
  text += `• *.menu* - Menu lengkap\n`;

  await lenwy.sendMessage(replyJid, { text }, { quoted: len });
  logMessage(customer.id, "out", text, "text");
  updateDailyAnalytics({ messages_out: 1 });
}

export async function handleAwayMessage(lenwy, replyJid, normalizedSender, pushname, len) {
  const profile = getProfile();
  if (!profile.auto_reply_enabled) return false;
  if (isBusinessOpen()) return false;

  const { default: db } = await import("../../database/business/db.js");
  const customer = db.prepare("SELECT * FROM customers WHERE jid = ?").get(normalizedSender);
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
  logMessage(customer.id, "out", text, "text");
  return true;
}
