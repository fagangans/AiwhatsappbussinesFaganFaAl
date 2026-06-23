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
  Browsers,
} from "@whiskeysockets/baileys";
import pino from "pino";
import chalk from "chalk";
import readline from "readline";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import attachSticker from "./lib/sticker.js";
import { updateBroadcastMessageStatus, getBroadcastIdByMessageId, refreshBroadcastCounts } from "./database/business/db.js";

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
const conflictStreaks = new Map();
const latestPairingCode = new Map();
const pairingRetryAttempts = new Map();

// 401 "Connection Failure" yang muncul SAAT BELUM pair (kode pairing baru
// dimasukkan) adalah kegagalan transien yang dikenal umum terjadi di sisi
// WhatsApp/Baileys, bukan logout asli — jadi dicoba ulang otomatis dengan
// kode baru, dibatasi supaya tidak retry selamanya kalau memang ada masalah
// lain (nomor salah, dll).
const MAX_PAIRING_RETRIES = 6;

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

// Pairing code (string) terbaru untuk bot yang sedang pairing via kode nomor.
// Server bisa generate kode baru otomatis kalau percobaan sebelumnya gagal
// (lihat penanganan statusCode 401 di connection.update), jadi dashboard
// perlu polling endpoint ini, bukan cuma mengandalkan respons HTTP pertama.
export function getLatestPairingCode(botId) {
  return latestPairingCode.get(botId) || null;
}

// Tutup semua socket bot yang aktif dengan rapi — dipakai saat aplikasi
// dimatikan (SIGTERM/SIGINT, misalnya saat VPS di-reboot atau `pm2 stop`).
// Beda dengan stopBot(): ini TIDAK menghapus sesi dari disk dan tidak
// menyentuh state lain, hanya menutup koneksi supaya tidak ada penulisan
// file sesi (creds.json dkk) yang terpotong di tengah jalan saat proses
// node dimatikan.
export async function closeAllSockets() {
  for (const timer of reconnectTimers.values()) {
    clearTimeout(timer);
  }
  reconnectTimers.clear();
  activeSessions.clear();

  const sockets = [...currentSockets.values()];
  currentSockets.clear();

  await Promise.all(
    sockets.map(
      (sock) =>
        new Promise((resolve) => {
          try {
            sock.end(new Error("Aplikasi dimatikan"));
          } catch {}
          resolve();
        }),
    ),
  );
}

// Hentikan koneksi/percobaan reconnect untuk bot yang dihapus dari dashboard
export function stopBot(botId) {
  activeSessions.delete(botId);
  reconnectAttempts.delete(botId);
  latestQr.delete(botId);
  latestPairingCode.delete(botId);
  pairingRetryAttempts.delete(botId);
  connectErrors.delete(botId);
  conflictStreaks.delete(botId);
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

  // Tutup socket lama (kalau masih ada) sebelum buat yang baru, supaya tidak
  // ada 2 socket hidup bersamaan untuk botId yang sama — itu sendiri bisa
  // memicu stream conflict di sisi server WhatsApp.
  const staleSock = currentSockets.get(botId);
  if (staleSock) {
    currentSockets.delete(botId);
    try { staleSock.end(new Error("Membuat ulang koneksi, menutup socket lama")); } catch {}
  }

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
      browser: Browsers.ubuntu("Chrome"),
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
      if (dashboardApp && dashboardApp.removeWaSocket) {
        dashboardApp.removeWaSocket(botId);
      }

      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reasonText = lastDisconnect?.error?.output?.payload?.message || lastDisconnect?.error?.message || "";

      // WhatsApp memakai statusCode 401 untuk TIGA kasus berbeda:
      // 1) logout asli (perangkat dihapus dari WhatsApp) — HANYA mungkin
      //    terjadi pada sesi yang SUDAH terdaftar/registered.
      // 2) stream conflict sementara (device lain login bersamaan dengan
      //    nomor yang sama).
      // 3) kegagalan pairing sementara — terjadi PERSIS setelah kode pairing
      //    baru dimasukkan, SEBELUM sesi terdaftar. Ini bukan logout asli
      //    (tidak mungkin "logout" dari sesi yang belum pernah terdaftar),
      //    melainkan bug/kegagalan transien yang umum terjadi di sisi
      //    WhatsApp/Baileys saat validasi kode pairing.
      // Baileys tidak membedakan ini lewat statusCode saja, jadi kita cek
      // status registrasi & teks alasannya juga.
      const isAlreadyRegistered = !!lenwy.authState?.creds?.registered;
      const isStreamConflict = statusCode === DisconnectReason.loggedOut && /conflict/i.test(reasonText);
      const isPairingFailure = (statusCode === DisconnectReason.loggedOut && !isStreamConflict && !isAlreadyRegistered)
        || (statusCode === DisconnectReason.connectionClosed && !isAlreadyRegistered);
      const isLoggedOut = statusCode === DisconnectReason.loggedOut && !isStreamConflict && isAlreadyRegistered;
      const isBadSession = statusCode === DisconnectReason.badSession;
      const isReplaced = statusCode === DisconnectReason.connectionReplaced;

      if (isLoggedOut || isBadSession) {
        console.log(chalk.red(`❌  ${tag} Bot logged out / sesi rusak — perlu pair ulang (statusCode: ${statusCode}, alasan: ${reasonText || "tidak diketahui"})`));
        activeSessions.delete(botId);
        reconnectAttempts.delete(botId);
        conflictStreaks.delete(botId);
        if (isBadSession) {
          try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch {}
        }
        return;
      }

      if (isReplaced) {
        console.log(chalk.red(`❌  ${tag} Koneksi digantikan (login dari device lain) — berhenti reconnect`));
        activeSessions.delete(botId);
        reconnectAttempts.delete(botId);
        conflictStreaks.delete(botId);
        return;
      }

      if (isPairingFailure) {
        const pairingAttempts = (pairingRetryAttempts.get(botId) || 0) + 1;
        pairingRetryAttempts.set(botId, pairingAttempts);

        if (pairingAttempts > MAX_PAIRING_RETRIES) {
          console.log(chalk.red(`❌  ${tag} Gagal pairing setelah ${pairingAttempts} percobaan otomatis (statusCode 401, alasan: ${reasonText || "tidak diketahui"}) — berhenti. Pastikan nomor HP benar & WhatsApp di HP dalam keadaan aktif/online, lalu minta kode pairing baru lewat dashboard.`));
          activeSessions.delete(botId);
          pairingRetryAttempts.delete(botId);
          latestPairingCode.delete(botId);
          return;
        }

        console.log(chalk.yellow(`⚠️  ${tag} Pairing gagal (statusCode 401, alasan: ${reasonText || "Connection Failure"}) — ini kegagalan umum & sementara dari sisi WhatsApp, mencoba lagi otomatis dengan kode baru (percobaan ke-${pairingAttempts}/${MAX_PAIRING_RETRIES})...`));

        const retryTimer = setTimeout(() => {
          reconnectTimers.delete(botId);
          if (activeSessions.get(botId) === sessionId) {
            // isReconnect=false supaya kode pairing BARU diminta (kode lama
            // sudah tidak valid setelah gagal).
            connectToWhatsApp(dashboardApp, botConfig, false).catch((err) => {
              console.error(chalk.red(`${tag} Pairing retry error:`), err.message);
            });
          }
        }, 3000 + Math.floor(Math.random() * 2000));
        reconnectTimers.set(botId, retryTimer);
        return;
      }

      if (isStreamConflict) {
        const streak = (conflictStreaks.get(botId) || 0) + 1;
        conflictStreaks.set(botId, streak);
        if (streak >= 3) {
          console.log(chalk.red(`❌  ${tag} Konflik sesi berulang ${streak}x — kemungkinan ada device lain (WhatsApp Web/Desktop/HP lain) yang login bersamaan dengan nomor ini. Berhenti reconnect. Sesi TIDAK dihapus, TIDAK perlu pair ulang — cukup pastikan tidak ada device lain yang login, lalu restart bot via dashboard.`));
          activeSessions.delete(botId);
          reconnectAttempts.delete(botId);
          conflictStreaks.delete(botId);
          return;
        }
        console.log(chalk.yellow(`⚠️  ${tag} Konflik sesi terdeteksi (statusCode 401, conflict) — kemungkinan sementara, percobaan ke-${streak}/3 sebelum berhenti...`));
      } else {
        conflictStreaks.delete(botId);
      }

      const attempts = (reconnectAttempts.get(botId) || 0) + 1;
      reconnectAttempts.set(botId, attempts);

      if (attempts > 15) {
        console.log(chalk.red(`❌  ${tag} Gagal reconnect setelah ${attempts} percobaan — berhenti. Cek koneksi internet / restart bot via dashboard.`));
        activeSessions.delete(botId);
        reconnectAttempts.delete(botId);
        conflictStreaks.delete(botId);
        return;
      }

      // Konflik sesi butuh waktu lebih lama supaya device lain yang bentrok
      // sempat melepas koneksinya dulu, sebelum kita coba lagi.
      const baseDelay = isStreamConflict
        ? Math.min(10000 * Math.pow(2, attempts - 1), 300000)
        : Math.min(5000 * Math.pow(2, attempts - 1), 300000);
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
      conflictStreaks.delete(botId);
      pairingRetryAttempts.delete(botId);
      latestPairingCode.delete(botId);
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

  // Track delivery/read status updates for broadcast open-rate tracking
  lenwy.ev.on("messages.update", (updates) => {
    for (const { key, update } of updates) {
      if (!update.status || !key.id) continue;
      // WAMessageStatus: 2=SERVER_ACK, 3=DELIVERY_ACK, 4=READ, 5=PLAYED
      if (update.status >= 3) {
        const status = update.status >= 4 ? "read" : "delivered";
        try {
          updateBroadcastMessageStatus(key.id, status);
          const bcId = getBroadcastIdByMessageId(key.id);
          if (bcId) refreshBroadcastCounts(bcId);
        } catch (err) {
          // Silently ignore — most messages aren't broadcasts
        }
      }
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
      await new Promise(r => setTimeout(r, 5000));
      const code = await lenwy.requestPairingCode(phoneNumber.trim());
      console.log(`🎁 ${tag} Pairing Code : ${code}`);
      latestPairingCode.set(botId, code);
      connectErrors.delete(botId);
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
