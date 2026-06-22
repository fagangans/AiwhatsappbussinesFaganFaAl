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
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
  getContentType,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import pino from "pino";
import chalk from "chalk";
import readline from "readline";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import attachSticker from "./lib/sticker.js";

// Path ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Track active connection per bot to prevent reconnect stampede
const activeSessions = new Map();
const currentSockets = new Map();
const reconnectAttempts = new Map();
const reconnectTimers = new Map();
const latestQr = new Map();
const connectErrors = new Map();

// QR code mentah (string) terbaru untuk bot yang sedang pairing via QR.
// Di-render jadi gambar oleh dashboard (lihat dashboard/server.js), bukan di sini.
export function getLatestQr(botId) {
  return latestQr.get(botId) || null;
}

// Error terakhir saat mencoba membuat koneksi pertama kali (sebelum socket
// terbuka), supaya dashboard tidak polling QR selamanya kalau koneksi gagal
// total (misal gagal fetch versi WA) sebelum sempat emit event QR apapun.
export function getConnectError(botId) {
  return connectErrors.get(botId) || null;
}

// Hentikan koneksi/percobaan reconnect untuk bot yang dihapus dari dashboard
export function stopBot(botId) {
  activeSessions.delete(botId);
  reconnectAttempts.delete(botId);
  latestQr.delete(botId);
  connectErrors.delete(botId);
  const timer = reconnectTimers.get(botId);
  if (timer) {
    clearTimeout(timer);
    reconnectTimers.delete(botId);
  }
  const sock = currentSockets.get(botId);
  currentSockets.delete(botId);
  if (sock) {
    try {
      sock.end(new Error("Bot dihapus dari dashboard"));
    } catch {}
  }
}

// Fungsi Input Terminal
async function question(prompt) {
  process.stdout.write(prompt);
  const r1 = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    r1.question("", (ans) => {
      r1.close();
      resolve(ans);
    });
  });
}

async function connectToWhatsApp(dashboardApp, botConfig, isReconnect = false) {
  const botId = botConfig.id;
  const botName = botConfig.name;
  const usePairingCode = botConfig.method !== "qr";
  const sessionPath = path.resolve(__dirname, "../sessions", botId);
  const tag = `[${botName}]`;

  const sessionId = Date.now();
  activeSessions.set(botId, sessionId);
  connectErrors.delete(botId);

  let lenwy, saveCreds;
  try {
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    const authState = await useMultiFileAuthState(sessionPath);
    saveCreds = authState.saveCreds;

    const { version, isLatest } = await fetchLatestBaileysVersion();
    if (!isReconnect) {
      console.log(`${tag} Using WA v${version.join(".")}, isLatest: ${isLatest}`);
    }

    lenwy = makeWASocket({
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      auth: authState.state,
      browser: ["Lenwy CS", "Chrome", "120.0.0"],
      version,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      retryRequestDelayMs: 250,
      getMessage: async () => undefined,
    });
  } catch (err) {
    connectErrors.set(botId, err.message || String(err));
    activeSessions.delete(botId);
    throw err;
  }

  // Bot was stopped/deleted while we were setting up — abort immediately
  if (activeSessions.get(botId) !== sessionId) {
    try { lenwy.end(new Error("Bot dihapus dari dashboard")); } catch {}
    return;
  }
  currentSockets.set(botId, lenwy);

  attachSticker(lenwy);

  // Register event handlers FIRST — before pairing code request — so no
  // connection/QR events are missed during the delay.
  lenwy.ev.on("creds.update", saveCreds);

  lenwy.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Mode QR: Baileys emit string QR baru tiap kali kode lama kedaluwarsa
    if (qr && !usePairingCode) {
      latestQr.set(botId, qr);
      connectErrors.delete(botId);
    }

    if (connection === "close") {
      // If this session is no longer the active one for this bot, stop
      if (activeSessions.get(botId) !== sessionId) {
        return;
      }
      currentSockets.delete(botId);

      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const isBadSession = statusCode === DisconnectReason.badSession;
      const isReplaced = statusCode === DisconnectReason.connectionReplaced;

      if (isLoggedOut || isBadSession) {
        const reason = lastDisconnect?.error?.output?.payload?.message || lastDisconnect?.error?.message || "tidak diketahui";
        console.log(chalk.red(`❌  ${tag} Bot logged out / sesi rusak — perlu pair ulang (statusCode: ${statusCode}, alasan: ${reason})`));
        activeSessions.delete(botId);
        reconnectAttempts.delete(botId);
        if (isBadSession) {
          try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch {}
        }
        return;
      }

      if (isReplaced) {
        console.log(chalk.red(`❌  ${tag} Koneksi digantikan (login dari device lain) — berhenti reconnect`));
        activeSessions.delete(botId);
        reconnectAttempts.delete(botId);
        return;
      }

      const attempts = (reconnectAttempts.get(botId) || 0) + 1;
      reconnectAttempts.set(botId, attempts);

      if (attempts > 15) {
        console.log(chalk.red(`❌  ${tag} Gagal reconnect setelah ${attempts} percobaan — berhenti. Cek koneksi internet / restart bot via dashboard.`));
        activeSessions.delete(botId);
        reconnectAttempts.delete(botId);
        return;
      }

      const baseDelay = Math.min(5000 * Math.pow(2, attempts - 1), 300000);
      const jitter = Math.floor(Math.random() * 2000);
      const delay = baseDelay + jitter;

      console.log(chalk.yellow(`⏳  ${tag} Koneksi terputus (${statusCode || "unknown"}), reconnect attempt ${attempts}/15 dalam ${Math.round(delay / 1000)}s...`));

      const timer = setTimeout(() => {
        reconnectTimers.delete(botId);
        if (activeSessions.get(botId) === sessionId) {
          connectToWhatsApp(dashboardApp, botConfig, true).catch((err) => {
            console.error(chalk.red(`${tag} Reconnect error:`), err.message);
          });
        }
      }, delay);
      reconnectTimers.set(botId, timer);
    } else if (connection === "open") {
      reconnectAttempts.delete(botId);
      latestQr.delete(botId);
      connectErrors.delete(botId);
      console.log(chalk.green(`✔  ${tag} Bot Berhasil Terhubung Ke WhatsApp`));
      if (dashboardApp && dashboardApp.setWaSocket) {
        dashboardApp.setWaSocket(botId, botName, lenwy);
        console.log(chalk.green(`✔  ${tag} Dashboard terhubung`));
      }
      if (dashboardApp && dashboardApp.onBotConnected) {
        const actualNumber = lenwy.user?.id?.split(":")[0]?.split("@")[0] || "";
        dashboardApp.onBotConnected(botId, actualNumber);
      }
    }
  });

  // Console Log
  lenwy.ev.on("messages.upsert", async (m) => {
    try {
      await handleIncomingMessage(m);
    } catch (err) {
      console.error(chalk.red.bold(`❌  ${tag} Gagal memproses pesan masuk:`), err);
    }
  });

  // Handle Pairing — only on first connect, NEVER on reconnect.
  // Placed AFTER event handlers so connection events are not missed.
  if (usePairingCode && !lenwy.authState.creds.registered && !isReconnect) {
    try {
      let phoneNumber;
      if (botConfig.phone) {
        phoneNumber = botConfig.phone;
      } else {
        phoneNumber = await question(
          `☘️ ${tag} Masukan Nomor Yang Diawali Dengan 62 :\n`,
        );
      }
      await lenwy.waitForSocketOpen();
      const code = await lenwy.requestPairingCode(phoneNumber.trim());
      console.log(`🎁 ${tag} Pairing Code : ${code}`);
      if (typeof botConfig.onPairingCode === "function") {
        botConfig.onPairingCode(code);
      }
    } catch (err) {
      console.error(`${tag} Failed to get pairing code:`, err);
      if (typeof botConfig.onPairingError === "function") {
        botConfig.onPairingError(err);
      }
    }
  }

  async function handleIncomingMessage(m) {
    const msg = m.messages[0];
    if (!msg.message) return;
    if (msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const pushname = msg.pushName || "User";

    // Deteksi Tipe Pesan
    const messageType = getContentType(msg.message);
    let body = "";
    let mediaType = null;

    switch (messageType) {
      case "conversation":
        body = msg.message.conversation;
        break;
      case "extendedTextMessage":
        body = msg.message.extendedTextMessage.text;
        break;
      case "imageMessage":
        mediaType = "Image";
        body = msg.message.imageMessage.caption || "";
        break;
      case "videoMessage":
        mediaType = "Video";
        body = msg.message.videoMessage.caption || "";
        break;
      case "stickerMessage":
        mediaType = "Sticker";
        break;
      case "audioMessage":
        mediaType = "Audio";
        break;
      case "documentMessage":
        mediaType = "Document";
        break;
      default:
        body = "";
    }

    lenwy.downloadMediaMessage = async (message) => {
      let mime = (message.msg || message).mimetype || "";

      let messageType = message.mtype
        ? message.mtype.replace(/Message/gi, "")
        : mime.split("/")[0];

      const stream = await downloadContentFromMessage(message, messageType);

      let buffer = Buffer.from([]);

      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      return buffer;
    };

    // Filter Pesan Kosong
    if (!body.trim() && !mediaType) return;

    // Log Pesan
    const listColor = [
      "red",
      "green",
      "yellow",
      "magenta",
      "cyan",
      "white",
      "blue",
    ];
    const randomColor = listColor[Math.floor(Math.random() * listColor.length)];
    const logTag = mediaType ? `[${mediaType}]` : "";

    console.log(
      chalk.yellow.bold("Credit : Lenwy"),
      chalk.green.bold(tag),
      chalk[randomColor](pushname),
      chalk[randomColor](" : "),
      chalk.magenta.bold(`${logTag}`),
      chalk.white(` ${body}`),
    );

    // Import Handler
    const { default: handler } = await import("./lenwy.js");
    await handler(lenwy, m, { body, mediaType, sender, pushname, botId, dashboardApp, ownerId: botConfig.owner_id || 1 });
  }
}

// Export
export default connectToWhatsApp;
