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

// [ ===== Import File ===== ]
import "./len.js";
import "./database/Menu/LenwyMenu.js";

// [ ===== Business Module ===== ]
import { handleAutoReply, handleWelcomeMessage, handleAwayMessage } from "./case/business/autoreply.js";
import { askBusinessAssistant, detectIntent, getAgentContact, getHistory } from "./case/business/ai-assistant.js";
import { hasActiveOrderFlow, startOrderFlow, continueOrderFlow, pauseOrderFlow, getOrderFlowState } from "./case/business/order-flow.js";
import { hasActiveTicketFlow, startTicketFlow, continueTicketFlow } from "./case/business/ticket-flow.js";
import { notifyNewOrder, checkLowStock, startNotificationScheduler } from "./case/business/notifications.js";
import { replySend } from "./case/business/rate-limiter.js";
import { evaluateRules } from "./case/business/automation-engine.js";
import {
  getProfile, getLowStockProducts, searchFaq, getAllFaq,
  getOrCreateCustomer, getCustomerOrders, getAllProducts, getAllPaymentMethods,
  addLoyaltyPoints, getLoyaltySettings,
  generateReferralCode, applyReferral, markReferralRewarded, getReferralStats,
  addSatisfactionRating, updateLeadScore, logSentiment, logMessage,
  getTicket, getOrder, getAllBundles, getBundleWithItems, getCustomerAddresses,
  addImportantMessage, createHandoff,
  getActiveAutomationRules, incrementRuleExecution, logRuleExecution,
  upsertChatAssignment,
} from "./database/business/db.js";
import { formatCurrency, formatOrderStatus } from "./database/business/helpers.js";

// [ ===== Import Pustaka ===== ]
import fs from "fs";
import mime from "mime-types";
import { jidNormalizedUser } from "@whiskeysockets/baileys";
import path from "path";
import chalk from "chalk";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Track Messages
const processedMessages = new Set();
const groupMetadataCache = new Map();
const lastFallbackReply = new Map();
const aiInFlight = new Set();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Sentiment Detection
const NEGATIVE_KEYWORDS = [
  /\b(kecewa|marah|kesal|benci|parah|buruk|jelek|nyesel|nyesal|rugi|zonk|bohong|nipu|tipu|penipu|penipuan|sampah|busuk|bangsat|anjing|goblok|tolol|bego|bodoh)\b/i,
  /\b(gak (puas|bagus|bener|beres))\b/i,
  /\b(tidak (puas|memuaskan|bagus|sesuai))\b/i,
  /\b(lama (banget|sekali|bgt))\b/i,
  /\b(kapan (dikirim|diproses|sampai|nyampe))\b/i
];
const POSITIVE_KEYWORDS = [
  /\b(bagus|mantap|mantul|keren|puas|senang|suka|sip|oke|recommended|recommend|rekomen|top|terbaik|the best|luar biasa|makasih|terima kasih|trimakasih|terimakasih|thx|thanks|thank you)\b/i,
  /\b(fast (respon|response))\b/i,
  /\b(cepat (banget|sekali|bgt))\b/i
];

function detectSentiment(text) {
  const lower = text.toLowerCase();
  let neg = 0, pos = 0;
  for (const p of NEGATIVE_KEYWORDS) if (p.test(lower)) neg++;
  for (const p of POSITIVE_KEYWORDS) if (p.test(lower)) pos++;
  if (neg > pos) return { sentiment: "negative", score: -1 * Math.min(neg, 3) / 3 };
  if (pos > neg) return { sentiment: "positive", score: Math.min(pos, 3) / 3 };
  return { sentiment: "neutral", score: 0 };
}

// Rating Flow State Manager
const ratingFlows = new Map();

function startRatingFlow(senderId, orderNumber) {
  ratingFlows.set(senderId, { orderNumber, step: "waiting_rating", startedAt: Date.now() });
}

function hasActiveRatingFlow(senderId) {
  const f = ratingFlows.get(senderId);
  if (!f) return false;
  if (Date.now() - f.startedAt > 10 * 60 * 1000) { ratingFlows.delete(senderId); return false; }
  return true;
}

function getRatingFlow(senderId) { return ratingFlows.get(senderId); }
function clearRatingFlow(senderId) { ratingFlows.delete(senderId); }

// Read Json File
function readJSONSync(pathFile) {
  try {
    return JSON.parse(fs.readFileSync(pathFile, "utf8"));
  } catch {
    return [];
  }
}

const pluginStatePath = path.join(
  process.cwd(),
  "WhatsApp",
  "database",
  "system",
  "plugins.json",
);

if (!fs.existsSync(pluginStatePath)) {
  fs.mkdirSync(path.dirname(pluginStatePath), { recursive: true });
  fs.writeFileSync(
    pluginStatePath,
    JSON.stringify({ disable: [], maintenance: [] }, null, 2),
  );
}

function readPluginState() {
  try {
    return JSON.parse(fs.readFileSync(pluginStatePath));
  } catch {
    return { disable: [], maintenance: [] };
  }
}

fs.watchFile(pluginStatePath, { interval: 1000 }, async () => {
  console.log(chalk.yellow.bold("[+] Plugins.json Berubah, Reloading State"));

  try {
    await loadPlugins();
    console.log(
      chalk.green.bold(`[+] Reload Selesai (${commands.size} Commands)`),
    );
  } catch (err) {
    console.error(chalk.red("❌ Gagal reload plugins.json:"), err);
  }
});

const caseDir = path.join(__dirname, "case");

let plugins = [];
let commands = new Map();
let categories = new Map();

async function loadPlugins() {
  plugins = [];
  commands.clear();
  categories.clear();

  const state = readPluginState();
  const disableList = state.disable || [];
  const maintenanceList = state.maintenance || [];

  const folders = fs.readdirSync(caseDir);

  for (let folder of folders) {
    const folderPath = path.join(caseDir, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    categories.set(folder.toLowerCase(), []);

    const files = fs.readdirSync(folderPath);

    for (let file of files) {
      if (!file.endsWith(".js")) continue;

      const module = await import(
        `./case/${folder}/${file}?update=${Date.now()}`
      );

      const plugin = module.default;
      const info = module.info;

      if (!plugin || !info) continue;

      const mainCommand = info.menu?.[0]?.toLowerCase();

      if (mainCommand) {
        info.enabled = !disableList.includes(mainCommand);
        info.maintenance = maintenanceList.includes(mainCommand);
      } else {
        info.enabled = true;
        info.maintenance = false;
      }

      plugins.push(plugin);

      for (let cmd of info.case) {
        commands.set(cmd.toLowerCase(), {
          execute: plugin,
          info,
          category: folder.toLowerCase(),
        });
      }

      categories.get(folder.toLowerCase()).push(info);
    }
  }
}

await loadPlugins();
globalThis.commands = commands;

let reloadTimeout;

function watchPlugins() {
  fs.watch(caseDir, { recursive: true }, (eventType, filename) => {
    if (!filename || !filename.endsWith(".js")) return;

    clearTimeout(reloadTimeout);

    reloadTimeout = setTimeout(async () => {
      console.log(chalk.yellow.bold(`[+] Reloading Plugins`));

      try {
        await loadPlugins();
        console.log(
          chalk.green.bold(`[+] Reload Selesai (${commands.size} Commands)`),
        );
      } catch (err) {
        console.error(chalk.red("❌ Gagal reload:"), err);
      }
    }, 500);
  });
}

watchPlugins();

const schedulerStarted = new Set();

// Export Handler
export default async (lenwy, m, meta) => {
  const { body, mediaType, sender: originalSender, pushname, botId, dashboardApp, ownerId } = meta;
  const msg = m.messages[0];
  if (!msg.message) return;

  const replyJid = msg.key.remoteJid;

  if (!schedulerStarted.has(botId || "default")) {
    schedulerStarted.add(botId || "default");
    const CreatorPathBoot = path.join(process.cwd(), "WhatsApp", "database", "creator.json");
    const bootCreators = readJSONSync(CreatorPathBoot);
    if (bootCreators.length > 0) startNotificationScheduler(lenwy, ownerId, bootCreators[0], botId || "default");
  }

  let authJid = originalSender;

  const key = msg.key;
  if (key.participantAlt) {
    authJid = key.participantAlt;
  } else if (key.remoteJidAlt) {
    authJid = key.remoteJidAlt;
  }

  const sender = authJid;
  const normalizedSender = jidNormalizedUser(sender);

  const senderJid = sender
    ? sender.split(":")[0].split("@")[0] // Ambil Nomor Saja
    : null;

  // console.log(chalk.yellow(`[DEBUG JID] Sender Original: ${originalSender}`));
  // console.log(chalk.yellow(`[DEBUG JID] Sender Auth (PN): ${sender}`));
  // console.log(chalk.green(`[DEBUG JID] Sender Normal: ${normalizedSender}`));

  if (msg.key.fromMe) return;

  // Anti Double
  if (processedMessages.has(msg.key.id)) return;
  processedMessages.add(msg.key.id);
  setTimeout(() => processedMessages.delete(msg.key.id), 30000);

  // Business Auto-Reply & Customer Tracking
  const isBlocked = handleAutoReply(lenwy, replyJid, normalizedSender, pushname, body, botId || "", dashboardApp, ownerId);
  if (isBlocked) return;

  try {
    upsertChatAssignment({ ownerId, botId: botId || "", customerJid: normalizedSender, customerName: pushname, lastMessage: body || (mediaType ? `[${mediaType}]` : "") });
  } catch (_) {}

  const pplu = fs.readFileSync(globalThis.MenuImage);
  const len = {
    key: {
      id: "LENWYBOTCS",
      fromMe: false,
      participant: `0@s.whatsapp.net`,
      remoteJid: replyJid,
    },
    message: {
      contactMessage: {
        displayName: `${pushname}`,
        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:XL;Lenwy,;;;\nFN: Lenwy V1.0\nitem1.TEL;waid=${sender.split("@")[0]}:+${sender.split("@")[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`,
        jpegThumbnail: pplu,
        thumbnail: pplu,
        sendEphemeral: true,
      },
    },
  };

  // Custom Reply
  const lenwyreply = async (teks) => {
    const result = await replySend(lenwy, replyJid, { text: teks }, { quoted: len }, botId || "default");
    console.log(chalk.cyan.bold(`[${botId || "Bot"}] Bot Balas`), chalk.white(`-> ${replyJid} : ${teks}`));
    return result;
  };



  // Deteksi Grup & Admin
  const isGroup = replyJid.endsWith("@g.us");

  // Bot Admin
  let isAdmin = false;
  let isBotAdmin = false;

  const GROUP_CACHE_TTL = 10 * 1000; // 10 Detik

  if (isGroup) {
    let metadataData = groupMetadataCache.get(replyJid);

    if (!metadataData || Date.now() - metadataData.time > GROUP_CACHE_TTL) {
      try {
        const metadata = await lenwy.groupMetadata(replyJid);
        groupMetadataCache.set(replyJid, { data: metadata, time: Date.now() });
        metadataData = groupMetadataCache.get(replyJid);
      } catch (e) {
        console.error("Gagal mengambil metadata grup:", e);
      }
    }

    const metadata = metadataData?.data;

    if (metadata) {
      const participants = metadata.participants;

      // Deteksi Format JID
      const isLidGroup = participants.some((p) => p.id.endsWith("@lid"));

      const normalizeJid = (jid) => {
        if (!jid) return "";
        return jid.split(":")[0].split("@")[0] + "@s.whatsapp.net";
      };

      let botJidForSearch;

      if (isLidGroup) {
        const rawLid = lenwy.user?.lid ?? lenwy.user?.id;
        botJidForSearch = rawLid.split(":")[0].split("@")[0] + "@lid";
      } else {
        botJidForSearch = normalizeJid(lenwy.user.id);
      }

      const senderJidClean = msg.key.participant ?? "";
      const userParticipant = participants.find((p) => p.id === senderJidClean);

      if (userParticipant) {
        isAdmin =
          userParticipant.admin === "admin" ||
          userParticipant.admin === "superadmin";
      }

      const botParticipant = participants.find((p) => p.id === botJidForSearch);

      isBotAdmin =
        botParticipant?.admin === "admin" ||
        botParticipant?.admin === "superadmin" ||
        false;

      // console.log("[BOT SEARCH JID]", botJidForSearch);
      // console.log("[BOT PARTICIPANT]", botParticipant);
      // console.log("[IS BOT ADMIN]", isBotAdmin);
    }
  }

  // Premium
  const premiumPath = path.join(
    process.cwd(),
    "WhatsApp",
    "database",
    "premium.json",
  );
  const premiumUsers = readJSONSync(premiumPath);
  const isPremium = premiumUsers.includes(normalizedSender);

  // Creator
  const CreatorPath = path.join(
    process.cwd(),
    "WhatsApp",
    "database",
    "creator.json",
  );
  const isCreatorArray = readJSONSync(CreatorPath);
  const isLenwy = isCreatorArray.includes(normalizedSender);

  // Delete Message
  async function deleteMessage(msgKey, tag = "DELETE") {
    if (!msgKey) return;
    try {
      await lenwy.sendMessage(replyJid, {
        delete: {
          remoteJid: replyJid,
          fromMe: msgKey.fromMe ?? true,
          id: msgKey.id,
          participant: msgKey.participant || undefined,
        },
      });
      console.log(chalk.red.bold(`[${tag}]`), `Pesan Dihapus (${msgKey.id})`);
    } catch (err) {
      console.error(`[${tag}] Gagal hapus pesan:`, err);
    }
  }

  // Welcome Message for New Customers
  const sentWelcome = await handleWelcomeMessage(lenwy, replyJid, normalizedSender, pushname, len, ownerId, botId || "");

  // Away Message (Outside Business Hours)
  const sentAway = await handleAwayMessage(lenwy, replyJid, normalizedSender, pushname, len, ownerId, botId || "");

  let usedPrefix = null;
  for (const pre of globalThis.prefix) {
    if (body.startsWith(pre)) {
      usedPrefix = pre;
      break;
    }
  }
  if (!usedPrefix && !globalThis.noprefix) {
    if (!isGroup && !sentWelcome && !sentAway) {
      const profile = getProfile(ownerId);
      if (profile.ai_enabled) {
        // Helper: send order flow result
        const sendOrderResult = async (flowResult) => {
          if (!flowResult) return;
          if (flowResult.imageUrl) {
            try { await replySend(lenwy, replyJid, { image: { url: flowResult.imageUrl }, caption: flowResult.text }, { quoted: len }, botId || "default"); } catch (_) { await lenwyreply(flowResult.text); }
          } else {
            await lenwyreply(flowResult.text);
          }
          if (flowResult.order) {
            for (const ownerJid of isCreatorArray) {
              await notifyNewOrder(lenwy, ownerJid, flowResult.order, flowResult.customerName, botId || "default");
            }
            await checkLowStock(lenwy, ownerId, isCreatorArray[0], botId || "default");
            // Auto loyalty points on order
            try {
              const settings = getLoyaltySettings(ownerId);
              if (settings.is_active && settings.points_per_rupiah > 0) {
                const cust = getOrCreateCustomer(normalizedSender, pushname, ownerId, botId || "");
                const earnedPts = Math.floor(flowResult.order.total * settings.points_per_rupiah);
                if (earnedPts > 0) {
                  addLoyaltyPoints(cust.id, earnedPts, `Order ${flowResult.order.order_number}`, flowResult.order.id, ownerId);
                  updateLeadScore(cust.id);
                }
              }
            } catch (_) {}
          }
        };

        // Helper: AI answer with mid-flow hint, used when flow returns fallthrough
        const aiWithHint = async (hint) => {
          if (aiInFlight.has(normalizedSender)) return;
          aiInFlight.add(normalizedSender);
          try {
            await lenwy.sendPresenceUpdate("composing", replyJid).catch(() => {});
            const answer = await askBusinessAssistant(body, ownerId, normalizedSender);
            await lenwy.sendPresenceUpdate("paused", replyJid).catch(() => {});
            let reply = answer || "Maaf, saya kurang paham pertanyaannya 🙏";
            if (hint) reply += "\n\n" + hint;
            await lenwyreply(reply);
          } finally {
            aiInFlight.delete(normalizedSender);
          }
        };

        // 1. Active ticket flow continuation
        if (hasActiveTicketFlow(normalizedSender)) {
          const flowCtx = { senderId: normalizedSender, ownerId, botId, pushName: msg.pushName || "Customer" };
          const result = continueTicketFlow(body, flowCtx);
          if (result) {
            if (typeof result === "object" && result.fallthrough) {
              await aiWithHint(result.hint);
              return;
            }
            await lenwyreply(typeof result === "string" ? result : result.text);
            return;
          }
        }

        // 2. Active order flow continuation
        if (hasActiveOrderFlow(normalizedSender)) {
          const flowCtx = { senderId: normalizedSender, ownerId, botId, pushName: msg.pushName || "Customer" };
          const flowResult = continueOrderFlow(body, flowCtx);

          if (flowResult) {
            if (flowResult.fallthrough) {
              await aiWithHint(flowResult.hint);
              return;
            }
            await sendOrderResult(flowResult);
            return;
          }
        }

        // 2.5. Active rating flow
        if (hasActiveRatingFlow(normalizedSender)) {
          const flow = getRatingFlow(normalizedSender);
          if (flow.step === "waiting_rating") {
            const num = parseInt(body.trim());
            if (num >= 1 && num <= 5) {
              flow.rating = num;
              flow.step = "waiting_feedback";
              await lenwyreply(`Rating ${num}/5 diterima! ⭐\n\nMau kasih komentar tambahan? Tulis aja, atau ketik *skip* untuk lewati.`);
              return;
            } else {
              await lenwyreply("Kasih rating 1-5 ya (1 = buruk, 5 = sangat baik)");
              return;
            }
          }
          if (flow.step === "waiting_feedback") {
            const feedback = body.toLowerCase() === "skip" ? "" : body;
            const customer = getOrCreateCustomer(normalizedSender, pushname, ownerId, botId || "");
            const order = getOrder(flow.orderNumber, ownerId);
            addSatisfactionRating(customer.id, flow.rating, feedback, null, order?.id || null);
            updateLeadScore(customer.id);
            clearRatingFlow(normalizedSender);
            const stars = "⭐".repeat(flow.rating);
            await lenwyreply(`Terima kasih atas review-nya! ${stars}\n\nFeedback kamu sangat berarti buat kami 🙏`);
            return;
          }
        }

        // 2.6. Sentiment detection on every message
        {
          const { sentiment, score } = detectSentiment(body);
          if (sentiment === "negative" && score <= -0.66) {
            try {
              const cust = getOrCreateCustomer(normalizedSender, pushname, ownerId, botId || "");
              addImportantMessage(botId || "", cust.id, cust.name || pushname, normalizedSender, body, "negative_sentiment", "high", ownerId);
            } catch (_) {}
          }
        }

        // 2.7. Automation rules (fire-and-forget, non-blocking)
        evaluateRules(lenwy, { customerJid: normalizedSender, customerName: pushname, body, ownerId, botId: botId || "default" }).catch(() => {});

        // 3. Intent detection
        const intent = detectIntent(body);
        const hasOrder = hasActiveOrderFlow(normalizedSender);

        // 4. Order flow — start new or handle "pesan" intent
        if (intent === "pesan") {
          const flowResult = startOrderFlow(body, {
            senderId: normalizedSender, ownerId, botId, pushName: msg.pushName || "Customer",
          });
          await sendOrderResult(flowResult);
          return;
        }

        // 5. Ticket flow
        if (intent === "buattiket") {
          const result = startTicketFlow(body, {
            senderId: normalizedSender, ownerId, botId, pushName: msg.pushName || "Customer",
          });
          await lenwyreply(result);
          return;
        }

        // 5a. Loyalty - cek poin
        if (intent === "loyalty") {
          const customer = getOrCreateCustomer(normalizedSender, pushname, ownerId, botId || "");
          const settings = getLoyaltySettings(ownerId);
          if (!settings.is_active) {
            await lenwyreply("Program loyalty belum aktif saat ini 🙏");
          } else {
            let text = `💎 *Poin Loyalty Kamu*\n\nSaldo: *${customer.loyalty_points || 0} poin*\n`;
            if (settings.min_redeem) text += `Min. tukar: ${settings.min_redeem} poin\n`;
            if (settings.redeem_value) text += `Nilai tukar: ${settings.redeem_value}% dari poin\n`;
            text += `\nKetik *tukar poin* untuk menukarkan poin kamu`;
            await lenwyreply(text);
          }
          return;
        }

        // 5b. Loyalty - redeem
        if (intent === "redeem") {
          const customer = getOrCreateCustomer(normalizedSender, pushname, ownerId, botId || "");
          const settings = getLoyaltySettings(ownerId);
          if (!settings.is_active) {
            await lenwyreply("Program loyalty belum aktif saat ini 🙏");
            return;
          }
          const pts = customer.loyalty_points || 0;
          if (pts < (settings.min_redeem || 100)) {
            await lenwyreply(`Poin kamu (${pts}) belum cukup untuk ditukar. Minimal ${settings.min_redeem || 100} poin.`);
            return;
          }
          await lenwyreply(`Kamu punya *${pts} poin*. Untuk menukarkan poin, hubungi admin ya! Admin akan proses penukaran poin kamu 😊`);
          return;
        }

        // 5c. Referral
        if (intent === "referral") {
          const customer = getOrCreateCustomer(normalizedSender, pushname, ownerId, botId || "");
          const code = generateReferralCode(customer.id);
          const stats = getReferralStats(customer.id);
          let text = `🎁 *Program Referral*\n\nKode referral kamu: *${code}*\n`;
          text += `Referral berhasil: ${stats.total} orang\n`;
          text += `\nBagikan kode ini ke teman kamu! Mereka cukup kirim pesan:\n*pakai referral ${code}*`;
          await lenwyreply(text);
          return;
        }

        // 5d. Apply referral code
        if (intent === "apply_referral") {
          const match = body.match(/(?:pakai|pake|gunakan|use|apply)\s+(?:referral|kode|code)\s+([A-Za-z0-9]+)/i);
          if (match) {
            const customer = getOrCreateCustomer(normalizedSender, pushname, ownerId, botId || "");
            const result = applyReferral(match[1].toUpperCase(), customer.id, ownerId);
            if (result.success) {
              addLoyaltyPoints(customer.id, 50, "Bonus referral (baru)", null, ownerId);
              addLoyaltyPoints(result.referrerId, 100, "Bonus referral (pengajak)", null, ownerId);
              markReferralRewarded(customer.id);
              await lenwyreply("Kode referral berhasil digunakan! 🎉\n\nKamu dapat *50 poin bonus*. Selamat berbelanja! 😊");
            } else {
              await lenwyreply(result.reason);
            }
          } else {
            await lenwyreply("Format: *pakai referral [KODE]*\n\nContoh: pakai referral REF123ABC");
          }
          return;
        }

        // 5e. Rating
        if (intent === "rating") {
          const match = body.match(/(?:rating|rate|review|beri\s*rating|kasih\s*rating)\s*(ORD-[A-Z0-9]+)?/i);
          if (match && match[1]) {
            startRatingFlow(normalizedSender, match[1].toUpperCase());
            await lenwyreply(`Kasih rating untuk pesanan *${match[1].toUpperCase()}* yuk!\n\nBerapa bintang (1-5)? ⭐\n1 = Buruk\n3 = Cukup\n5 = Sangat Baik`);
          } else {
            const customer = getOrCreateCustomer(normalizedSender, pushname, ownerId, botId || "");
            const orders = getCustomerOrders(customer.id) || [];
            const delivered = orders.filter(o => o.status === "delivered");
            if (delivered.length === 0) {
              await lenwyreply("Belum ada pesanan yang bisa di-review 🙏");
            } else {
              const latest = delivered[0];
              startRatingFlow(normalizedSender, latest.order_number);
              await lenwyreply(`Kasih rating untuk pesanan *${latest.order_number}* yuk!\n\nBerapa bintang (1-5)? ⭐\n1 = Buruk\n3 = Cukup\n5 = Sangat Baik`);
            }
          }
          return;
        }

        // 5f. Bundles / Paket
        if (intent === "bundle") {
          const bundles = getAllBundles(ownerId) || [];
          if (bundles.length === 0) {
            await lenwyreply("Belum ada paket bundling yang tersedia saat ini 🙏");
          } else {
            let text = "📦 *Paket Bundling Tersedia*\n\n";
            for (const b of bundles.slice(0, 10)) {
              const items = getBundleWithItems(b.id);
              text += `*${b.name}*\n`;
              text += `Harga paket: ${formatCurrency(b.bundle_price)}`;
              if (b.original_price) text += ` (hemat ${formatCurrency(b.original_price - b.bundle_price)})`;
              text += "\n";
              if (items?.items?.length) {
                items.items.forEach(i => { text += `  - ${i.product_name} x${i.qty}\n`; });
              }
              text += "\n";
            }
            text += "_Mau pesan paket? Langsung bilang aja!_ 😊";
            await lenwyreply(text);
          }
          return;
        }

        // 6. Natural FAQ
        if (intent === "faq") {
          const faqs = getAllFaq(ownerId) || [];
          if (faqs.length === 0) {
            await lenwyreply("Belum ada FAQ yang tersedia saat ini 🙏");
          } else {
            let text = "Pertanyaan yang sering ditanyakan:\n\n";
            faqs.slice(0, 10).forEach((f, i) => {
              text += `${i + 1}. *${f.question}*\n${f.answer}\n\n`;
            });
            text += "_Langsung tanya aja kalau ada yang mau ditanyakan ya!_ 😊";
            await lenwyreply(text);
          }
          return;
        }

        // 7. Natural cek order
        if (intent === "cekorder") {
          const customer = getOrCreateCustomer(normalizedSender, pushname, ownerId, botId || "");
          const orders = getCustomerOrders(customer.id) || [];
          if (orders.length === 0) {
            await lenwyreply("Kamu belum punya pesanan nih. Mau pesan sesuatu? Langsung bilang aja ya! 😊");
          } else {
            let text = "Pesanan kamu:\n\n";
            orders.slice(0, 5).forEach((o, i) => {
              const statusMap = { pending: "⏳ Menunggu", confirmed: "✅ Dikonfirmasi", processing: "🔄 Diproses", shipped: "🚚 Dikirim", delivered: "📦 Selesai", cancelled: "❌ Dibatalkan" };
              text += `${i + 1}. *${o.order_number}*\n`;
              text += `   Status: ${statusMap[o.status] || o.status}\n`;
              text += `   Total: ${formatCurrency(o.total)}\n`;
              text += `   Tanggal: ${new Date(o.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}\n\n`;
            });
            if (orders.length > 5) text += `_...dan ${orders.length - 5} pesanan lainnya_\n\n`;
            text += "_Mau cek detail pesanan tertentu? Sebutin aja nomor ordernya ya!_ 😊";
            await lenwyreply(text);
          }
          return;
        }

        // 8. Payment info
        if (intent === "bayar") {
          const methods = getAllPaymentMethods(ownerId) || [];
          if (methods.length === 0) {
            await lenwyreply("Info pembayaran belum diatur. Silakan hubungi kami langsung ya! 🙏");
          } else {
            let text = "Metode pembayaran yang tersedia:\n\n";
            methods.forEach((m, i) => {
              const icon = m.type === "bank_transfer" ? "🏦" : m.type === "ewallet" ? "💳" : m.type === "cod" ? "🤝" : "💰";
              text += `${icon} *${m.name}*\n`;
              if (m.account_number) text += `   No. Rek: ${m.account_number}\n`;
              if (m.account_name) text += `   A/N: ${m.account_name}\n`;
              if (m.instructions) text += `   ${m.instructions}\n`;
              text += "\n";
            });
            text += "_Setelah transfer, kirim bukti pembayaran ya!_ 😊";
            await lenwyreply(text);
          }
          return;
        }

        // 8b. Minta ngomong sama CS / agent manusia
        if (intent === "minta_cs") {
          const agent = getAgentContact(ownerId);
          if (agent) {
            const history = getHistory(normalizedSender);
            let chatSummary = "";
            if (history.length > 0) {
              chatSummary = history.map(h => `${h.role === "customer" ? "Customer" : "AI"}: ${h.text}`).join("\n");
            }

            const cust = getOrCreateCustomer(normalizedSender, pushname, ownerId, botId || "");

            const agentJid = agent.phone.includes("@") ? agent.phone : agent.phone + "@s.whatsapp.net";

            try {
              createHandoff({
                ownerId,
                botId: botId || "",
                customerId: cust.id,
                customerJid: normalizedSender,
                customerName: pushname,
                agentJid,
                agentName: agent.name,
                reason: body,
                chatSummary,
              });
            } catch (e) {}

            if (chatSummary) {
              try {
                const summaryMsg = `📋 *Handoff dari Bot*\n━━━━━━━━━━━━━━━━━━━━━\n\n👤 *Customer:* ${pushname}\n📱 *Nomor:* wa.me/${normalizedSender.split("@")[0]}\n\n💬 *Riwayat Chat:*\n${chatSummary}\n\n_Customer akan menghubungi Anda sebentar lagi._`;
                await lenwy.sendMessage(agentJid, { text: summaryMsg });
              } catch (e) {}
            }

            await lenwyreply(`Tentu! Kamu bisa langsung chat *${agent.name}* di wa.me/${agent.phone} ya 😊\n\n_Riwayat chat kamu sudah kami kirimkan ke CS, jadi tidak perlu mengulang penjelasan lagi._`);
          } else {
            await lenwyreply("Maaf, belum ada agent CS yang terdaftar saat ini. Coba tanya di sini dulu ya, saya bantu sebisanya 🙏");
          }
          return;
        }

        // 9. Katalog
        if (intent === "katalog") {
          const products = getAllProducts(null, ownerId) || [];
          if (products.length === 0) {
            await lenwyreply("Belum ada produk yang tersedia saat ini 🙏");
          } else {
            let text = "Produk yang tersedia:\n\n";
            products.slice(0, 15).forEach((p, i) => {
              text += `${i + 1}. *${p.name}* — ${formatCurrency(p.discount_price > 0 ? p.discount_price : p.price)}`;
              if (p.discount_price > 0) text += ` ~~${formatCurrency(p.price)}~~`;
              if (p.stock <= 0) text += " _(habis)_";
              text += "\n";
            });
            if (products.length > 15) text += `\n_...dan ${products.length - 15} produk lainnya_`;
            text += "\n\n_Mau pesan? Langsung bilang aja, misal \"mau pesan [nama produk]\"_ 😊";
            await lenwyreply(text);
          }
          return;
        }

        // 10. Menu
        if (intent === "menu") {
          const greeting = new Date().getHours() < 12 ? "Pagi" : new Date().getHours() < 15 ? "Siang" : new Date().getHours() < 18 ? "Sore" : "Malam";
          let text = `Selamat ${greeting}! Saya bisa bantu kamu untuk:\n\n`;
          text += `🛍️ *Lihat Katalog* — ketik "lihat produk" atau "ada barang apa aja"\n`;
          text += `🛒 *Pesan Barang* — ketik "mau pesan" atau langsung sebut produknya\n`;
          text += `📋 *Cek Pesanan* — ketik "cek pesanan saya"\n`;
          text += `💳 *Info Pembayaran* — ketik "cara bayar" atau "info pembayaran"\n`;
          text += `❓ *Tanya-Tanya* — langsung tanya aja, misal "ada promo gak?"\n`;
          text += `🎫 *Buat Tiket Support* — kalau ada keluhan, bilang aja "mau buat tiket"\n`;
          text += `💎 *Cek Poin Loyalty* — ketik "cek poin" atau "loyalty"\n`;
          text += `🎁 *Program Referral* — ketik "referral" untuk dapat kode\n`;
          text += `⭐ *Kasih Rating* — ketik "rating" untuk review pesanan\n`;
          text += `📦 *Paket Bundling* — ketik "paket" atau "bundle"\n`;
          text += `👤 *Ngomong Sama CS* — ketik "mau ngomong sama cs" atau "admin"\n\n`;
          text += `_Langsung chat aja ya, gak perlu pakai format khusus!_ 😊`;
          await lenwyreply(text);
          return;
        }

        // 11. AI assistant fallback
        if (!aiInFlight.has(normalizedSender)) {
          aiInFlight.add(normalizedSender);
          try {
            await lenwy.sendPresenceUpdate("composing", replyJid).catch(() => {});
            let answer = await askBusinessAssistant(body, ownerId, normalizedSender);
            await lenwy.sendPresenceUpdate("paused", replyJid).catch(() => {});
            if (hasOrder) {
              const orderState = getOrderFlowState(normalizedSender);
              if (orderState) {
                pauseOrderFlow(normalizedSender);
                answer = (answer || "Maaf, saya kurang paham pertanyaannya 🙏") + "\n\n_Btw, pesanan kamu masih ada lho. Mau lanjutin? Tinggal balas sesuai yang diminta sebelumnya ya_ 😊";
              }
            }
            await lenwyreply(
              answer || `Maaf, asisten sedang tidak tersedia 🙏\n\nKetik "menu" untuk lihat layanan yang tersedia`,
            );
          } finally {
            aiInFlight.delete(normalizedSender);
          }
        }
      } else {
        const lastReply = lastFallbackReply.get(normalizedSender) || 0;
        if (Date.now() - lastReply > 60000) {
          lastFallbackReply.set(normalizedSender, Date.now());
          setTimeout(() => lastFallbackReply.delete(normalizedSender), 60000);
          await lenwyreply(
            `Maaf, saya tidak mengerti pesan teks bebas. 🙏\n\nKetik "menu" untuk lihat layanan yang tersedia.`,
          );
        }
      }
    }
    return;
  }

  const args = usedPrefix
    ? body.slice(usedPrefix.length).trim().split(" ")
    : body.trim().split(" ");

  const command = args.shift().toLowerCase();
  const q = args.join(" ");

  // Helper
  const LenwyText = (text) =>
    replySend(lenwy, replyJid, { text }, { quoted: len }, botId || "default");

  const LenwyWait = () => lenwyreply(globalThis.mess.wait);

  // Send Video
  const LenwyVideo = (url, caption = "") =>
    replySend(lenwy, replyJid, { video: { url }, caption }, { quoted: len }, botId || "default");

  // Send Image
  const LenwyImage = (url, caption = "") =>
    replySend(lenwy, replyJid, { image: { url }, caption }, { quoted: len }, botId || "default");

  // Send Audio
  const LenwyAudio = (url, ptt = false) =>
    replySend(
      lenwy,
      replyJid,
      { audio: { url }, mimetype: "audio/mpeg", ptt },
      { quoted: len },
      botId || "default",
    );

  // Send File
  const LenwyFile = (buffer, fileName, mime) =>
    replySend(
      lenwy,
      replyJid,
      { document: buffer, fileName, mimetype: mime },
      { quoted: len },
      botId || "default",
    );

  // Label Menu
  function getLabel(info) {
    if (info.owner) return "Owner";
    if (info.premium) return "Premium";
    if (info.admin) return "Admin";
    if (info.botAdmin) return "BotAdmin";
    if (info.group) return "Group";
    if (info.private) return "Private";
    return "Public";
  }

  const labelPriority = {
    Public: 0,
    Owner: 1,
    Premium: 2,
    Admin: 3,
    BotAdmin: 4,
    Group: 5,
    Private: 6,
  };

  // All Menu
  if (command === "allmenu") {
    let text = globalThis.lenwymenu;

    for (let [cat, list] of categories) {
      const visible = list.filter((i) => !i.hidden);
      if (visible.length === 0) continue;

      text += `\n*[ ${cat.toUpperCase()} ]*\n`;

      visible
        .sort((a, b) => {
          const labelA = getLabel(a);
          const labelB = getLabel(b);

          const priorityDiff = labelPriority[labelA] - labelPriority[labelB];

          if (priorityDiff !== 0) return priorityDiff;

          return a.name.localeCompare(b.name);
        })
        .forEach((item) => {
          const label = getLabel(item);
          let tag = label !== "Public" ? ` [${label}]` : "";

          if (item.maintenance) tag += " [Main]";
          if (item.enabled === false) tag += " [Off]";

          item.menu
            .sort((a, b) => a.localeCompare(b))
            .forEach((cmd) => {
              text += `*[+] .${cmd}${tag}*\n`;
            });
        });
    }

    await lenwyreply(`${text}`);
  }

  // Category Menu
  if (command === "menu") {
    let casePath = path.join(__dirname, "case");
    let folders = fs
      .readdirSync(casePath)
      .filter((v) => fs.statSync(path.join(casePath, v)).isDirectory());

    let text = globalThis.lenwymenu || "*📂 Daftar Menu*\n";

    text += "\n*[ Available Categories ]*\n";

    folders
      .sort((a, b) => a.localeCompare(b))
      .forEach((folder) => {
        text += `*[+] ${folder.toUpperCase()}MENU*\n`;
      });

    await lenwyreply(`${text}`);
  }

  // Category Menu Dynamic
  if (command.endsWith("menu") && command !== "allmenu") {
    const fs = await import("fs");
    const path = await import("path");

    const casePath = path.join(process.cwd(), "WhatsApp", "case");

    const folders = fs
      .readdirSync(casePath)
      .filter((f) => fs.statSync(path.join(casePath, f)).isDirectory());

    const kategori = command.replace("menu", "").toLowerCase();

    if (!folders.includes(kategori)) return;

    let text = `*[ ${kategori.toUpperCase()} MENU ]*\n`;

    const list = categories.get(kategori) || [];

    const visible = list.filter((i) => !i.hidden);

    visible
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((item) => {
        const label = getLabel(item);
        let tag = label !== "Public" ? ` [${label}]` : "";

        if (item.maintenance) tag += " [Main]";
        if (item.enabled === false) tag += " [Off]";

        item.menu
          .sort((a, b) => a.localeCompare(b))
          .forEach((cmd) => {
            text += `*[+] .${cmd}${tag}*\n`;
          });
      });

    await lenwyreply(`${text}`);
  }

  if (!commands.has(command)) return;

  const pluginData = commands.get(command);
  const { execute, info } = pluginData;

  // Control
  if (info.enabled === false) return LenwyText(globalThis.mess.disable);

  if (info.maintenance === true && !isLenwy)
    return LenwyText(globalThis.mess.maintenance);

  if (!isGroup) {
    if (!isPremium && !isLenwy) {
      if (!info.allowPrivate) {
        return LenwyText(
          "⚠️ *Kamu Bukan User Premium!*\n\n" +
            "Fitur ini tidak tersedia di Private Chat.\n\n" +
            "Silakan upgrade ke Premium untuk akses penuh.",
        );
      }
    }
  }

  if (info.owner && !isLenwy) return LenwyText(globalThis.mess.creator);

  if (info.premium && !isPremium && !isLenwy)
    return LenwyText(globalThis.mess.premium);

  if (info.group && !isGroup) return LenwyText(globalThis.mess.group);

  if (info.private && isGroup) return LenwyText(globalThis.mess.private);

  if (info.admin && !isAdmin) return LenwyText(globalThis.mess.admin);

  if (info.botAdmin && !isBotAdmin) return LenwyText(globalThis.mess.botadmin);

  await execute({
    command,
    args,
    q,
    lenwy,
    m,
    msg,
    len,
    replyJid,
    senderJid,
    lenwyreply,
    LenwyText,
    LenwyWait,
    LenwyVideo,
    LenwyImage,
    LenwyAudio,
    LenwyFile,
    isGroup,
    isAdmin,
    isBotAdmin,
    isPremium,
    isLenwy,
    plugins,
    commands,
    normalizedSender,
    deleteMessage,
    ownerId,
    botId,
  });
};
