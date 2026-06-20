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

// Pairing Mode
const usePairingCode = true;

// Track active connection per bot to prevent reconnect stampede
const activeSessions = new Map();
const currentSockets = new Map();

// Hentikan koneksi/percobaan reconnect untuk bot yang dihapus dari dashboard
export function stopBot(botId) {
  activeSessions.delete(botId);
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
  const sessionPath = path.resolve(__dirname, "../sessions", botId);
  const tag = `[${botName}]`;

  const sessionId = Date.now();
  activeSessions.set(botId, sessionId);

  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const { version, isLatest } = await fetchLatestBaileysVersion();
  if (!isReconnect) {
    console.log(`${tag} Using WA v${version.join(".")}, isLatest: ${isLatest}`);
  }

  const lenwy = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: !usePairingCode,
    auth: state,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    version,
    syncFullHistory: true,
    generateHighQualityLinkPreview: true,
    getMessage: async (key) => {
      return {};
    },
  });

  // Bot was stopped/deleted while we were setting up — abort immediately
  if (activeSessions.get(botId) !== sessionId) {
    try { lenwy.end(new Error("Bot dihapus dari dashboard")); } catch {}
    return;
  }
  currentSockets.set(botId, lenwy);

  attachSticker(lenwy);

  // Handle Pairing — only on first connect, NEVER on reconnect
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
      await new Promise((resolve) => setTimeout(resolve, 3000));
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

  lenwy.ev.on("creds.update", saveCreds);

  lenwy.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      // If this session is no longer the active one for this bot, stop
      if (activeSessions.get(botId) !== sessionId) {
        return;
      }

      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log(chalk.yellow(`⏳  ${tag} Koneksi terputus (${statusCode || "unknown"}), reconnect dalam 5 detik...`));
        setTimeout(() => {
          // Check again before reconnecting
          if (activeSessions.get(botId) === sessionId) {
            connectToWhatsApp(dashboardApp, botConfig, true);
          }
        }, 5000);
      } else {
        const reason = lastDisconnect?.error?.output?.payload?.message || lastDisconnect?.error?.message || "tidak diketahui";
        console.log(chalk.red(`❌  ${tag} Bot logged out, tidak reconnect (statusCode: ${statusCode}, alasan: ${reason})`));
        activeSessions.delete(botId);
      }
    } else if (connection === "open") {
      console.log(chalk.green(`✔  ${tag} Bot Berhasil Terhubung Ke WhatsApp`));
      if (dashboardApp && dashboardApp.setWaSocket) {
        dashboardApp.setWaSocket(botId, botName, lenwy);
        console.log(chalk.green(`✔  ${tag} Dashboard terhubung`));
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
