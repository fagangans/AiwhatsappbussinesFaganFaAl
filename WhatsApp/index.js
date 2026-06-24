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

// 401 "Connection Failure" yang muncul SAAT BELUM pair adalah kegagalan di
// SISI SERVER WhatsApp (server menutup koneksi saat tahap companion_hello),
// bukan logout asli dan bukan bug di kode ini. Retry otomatis berkali-kali
// TIDAK menyembuhkan ini — yang ada malah menambah jejak permintaan pairing
// beruntun dari IP yang sama, yang justru bisa memperburuk peluang sukses
// berikutnya. Jadi dibatasi 1x percobaan saja, lalu berhenti dengan pesan
// jelas — minta user coba lagi manual nanti via dashboard kalau sudah siap.
const MAX_PAIRING_RETRIES = 1;

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

// Cache versi WA supaya tidak fetch ke jaringan tiap kali connect/retry.
// Di-refresh maksimal sekali per jam. Kalau fetch gagal, pakai versi terakhir
// yang berhasil di-cache (atau biarkan Baileys pakai default-nya).
let cachedWaVersion = null;
let cachedWaVersionAt = 0;
const WA_VERSION_TTL = 60 * 60 * 1000;
async function getWaVersion() {
  const now = Date.now();
  if (cachedWaVersion && now - cachedWaVersionAt < WA_VERSION_TTL) {
    return cachedWaVersion;
  }
  try {
    const result = await fetchLatestBaileysVersion();
    cachedWaVersion = result;
    cachedWaVersionAt = now;
    return result;
  } catch (err) {
    if (cachedWaVersion) return cachedWaVersion;
    throw err;
  }
}

async function connectToWhatsApp(dashboardApp, botConfig, isReconnect = false) {
  const botId = botConfig.id;
  const botName = botConfig.name;
  // Tentukan mode koneksi:
  // - method "qr"        → mode QR
  // - method lain        → mode pairing code
  // - method tidak diset (mis. auto-start dari LenwySet yang tak menyimpan
  //   'method' di DB) → simpulkan dari nomor: ADA nomor = pairing code,
  //   TANPA nomor = QR. Ini mencegah bot QR ter-auto-start sebagai pairing lalu
  //   menggantung di prompt nomor saat startup non-interaktif (PM2).
  const usePairingCode = botConfig.method
    ? botConfig.method !== "qr"
    : !!botConfig.phone;
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

  let lenwy, saveCreds, pairingPhoneNumber = null;
  try {
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    let authState = await useMultiFileAuthState(sessionPath);

    // === FIX AKAR MASALAH PAIRING CODE / QR ===
    // requestPairingCode() mengisi creds.me lalu menyimpannya ke creds.json.
    // Saat handshake, Baileys mengirim LOGIN node bila creds.me terisi, atau
    // REGISTRATION node bila kosong (cek di validateConnection, berlaku untuk
    // SEMUA mode — pairing maupun QR). Sesi "setengah-jadi" (creds.me sudah
    // terisi dari percobaan pairing sebelumnya yang gagal, tapi registered masih
    // false) membuat handshake mengirim LOGIN node → server WhatsApp menolak
    // dengan 401 "Connection Failure" di SETIAP percobaan berikutnya. Inilah
    // sebab pairing selalu gagal walau nomor sudah didiamkan semalaman. (QR yang
    // user-nya pakai dari sesi bersih tetap bisa, karena tak menyentuh creds.me.)
    // Solusi: untuk SETIAP connect-baru (bukan reconnect) atas sesi yang belum
    // registered tapi creds.me-nya terisi, reset sesi agar mulai dari kondisi
    // bersih (creds.me kosong → REGISTRATION node yang benar).
    if (
      !isReconnect &&
      !authState.state.creds.registered &&
      authState.state.creds.me
    ) {
      console.log(chalk.yellow(`♻️  ${tag} Sesi setengah-jadi terdeteksi — mereset sesi agar pairing/QR dimulai bersih.`));
      try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch {}
      fs.mkdirSync(sessionPath, { recursive: true });
      authState = await useMultiFileAuthState(sessionPath);
    }
    saveCreds = authState.saveCreds;

    // Siapkan nomor untuk pairing SEBELUM socket dibuat, supaya saat sinyal
    // siap-registrasi muncul kita bisa langsung minta kode tanpa menunda.
    if (usePairingCode && !isReconnect && !authState.state.creds.registered) {
      if (botConfig.phone) {
        pairingPhoneNumber = String(botConfig.phone);
      } else if (process.stdin.isTTY) {
        // Hanya prompt interaktif kalau benar-benar ada terminal. Di PM2/systemd
        // tidak ada TTY — question() akan menggantung selamanya & membekukan
        // loop startup, jadi lewati saja (pairing dijalankan via dashboard).
        pairingPhoneNumber = await question(`☘️ ${tag} Masukan Nomor Yang Diawali Dengan 62 :\n`);
      } else {
        console.log(chalk.yellow(`⚠️  ${tag} Mode pairing tapi nomor kosong & tidak ada input interaktif — lewati. Lakukan pairing/QR via dashboard.`));
      }
    }

    const { version, isLatest } = await getWaVersion();
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

  // Minta kode pairing TEPAT saat server WhatsApp siap menerima registrasi.
  // Baileys memancarkan connection.update {qr} setelah server mengirim
  // 'pair-device' — artinya REGISTRATION node sudah terkirim & handshake selesai.
  // Memanggil requestPairingCode pada momen ini (bukan dengan jeda tetap yang
  // rawan race) menjamin urutan benar: registration dulu, baru companion_hello —
  // sehingga creds.me tidak pernah mendahului handshake (yang akan memicu LOGIN
  // node + 401). Dijaga agar hanya diminta sekali per umur socket.
  let pairingCodeRequested = false;
  const requestPairingCodeOnce = async () => {
    if (pairingCodeRequested) return;
    pairingCodeRequested = true;
    try {
      const code = await lenwy.requestPairingCode(pairingPhoneNumber.trim());
      console.log(`🎁 ${tag} Pairing Code : ${code}`);
      latestPairingCode.set(botId, code);
      connectErrors.delete(botId);
      if (typeof botConfig.onPairingCode === "function") {
        botConfig.onPairingCode(code);
      }
    } catch (err) {
      const errStatus = err?.output?.statusCode;
      const isTransient =
        errStatus === DisconnectReason.connectionClosed ||
        errStatus === DisconnectReason.connectionLost ||
        errStatus === DisconnectReason.timedOut ||
        /connection closed|timed out|connection lost/i.test(err?.message || "");

      // Kegagalan transien (428/408 dll): JANGAN laporkan sebagai fatal —
      // handler "close" akan mendeteksinya sebagai isPairingFailure lalu retry
      // (dengan sesi yang sudah direset bersih). Melapor onPairingError di sini
      // membuat dashboard menghapus bot & membatalkan auto-retry.
      if (isTransient) {
        console.log(chalk.yellow(`⏳  ${tag} Gagal minta kode pairing sementara (${errStatus || "connection closed"}) — akan dicoba ulang otomatis...`));
      } else {
        console.error(`${tag} Failed to get pairing code:`, err);
        if (typeof botConfig.onPairingError === "function") {
          botConfig.onPairingError(err);
        }
      }
    }
  };

  lenwy.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      if (usePairingCode) {
        // Mode pairing code: pakai munculnya 'qr' sebagai sinyal siap-registrasi;
        // string QR-nya sendiri tidak dipakai/ditampilkan.
        if (!isReconnect && pairingPhoneNumber && !lenwy.authState.creds.registered) {
          requestPairingCodeOnce();
        }
      } else {
        // Mode QR: simpan string QR baru untuk ditampilkan/polling dashboard.
        latestQr.set(botId, qr);
        connectErrors.delete(botId);
      }
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
      const isLoggedOut = statusCode === DisconnectReason.loggedOut && !isStreamConflict && isAlreadyRegistered;
      const isBadSession = statusCode === DisconnectReason.badSession;
      const isReplaced = statusCode === DisconnectReason.connectionReplaced;
      // Selama sesi BELUM pernah 'registered', koneksi yang tertutup berarti
      // proses pairing belum tuntas (kode kelewat waktu, handshake ditutup
      // server, dll) — apa pun status code-nya. Recovery yang benar BUKAN
      // reconnect biasa (itu malah memuat creds.me beracun → LOGIN node → 401),
      // melainkan mulai ulang pairing dari sesi BERSIH dengan kode baru.
      // Pengecualian: badSession (sesi korup, ditangani terpisah), replaced, dan
      // restartRequired (515) — yang TERAKHIR adalah sinyal NORMAL tepat setelah
      // pairing BERHASIL ("server minta restart"); ini harus reconnect biasa
      // (login node), JANGAN direset, supaya sesi yang baru ter-pair tak hilang.
      const isRestartRequired = statusCode === DisconnectReason.restartRequired;
      const isPairingFailure = !isAlreadyRegistered && !isStreamConflict && !isBadSession && !isReplaced && !isRestartRequired;

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
          console.log(chalk.red(`❌  ${tag} Gagal pairing setelah ${pairingAttempts - 1} percobaan otomatis (statusCode ${statusCode}, alasan: ${reasonText || "Connection Failure"}) — berhenti.\n   Pastikan: (1) nomor ${botConfig.phone || ""} benar & diawali kode negara (mis. 62), (2) WhatsApp di HP aktif, ada internet/sinyal bagus, (3) kode dimasukkan SEGERA setelah muncul (Tautkan Perangkat → Tautkan dengan nomor telepon).\n   Minta kode baru lewat dashboard saat HP sudah siap, lalu masukkan kodenya secepatnya.`));
          activeSessions.delete(botId);
          pairingRetryAttempts.delete(botId);
          latestPairingCode.delete(botId);
          return;
        }

        // Backoff bertingkat (8s, 16s, 32s, lalu 60s) memberi user waktu cukup
        // memasukkan kode sebelum socket diperbarui. Tiap retry memulai sesi
        // BERSIH (creds.me beracun sudah di-reset di awal connectToWhatsApp),
        // jadi handshake selalu mengirim REGISTRATION node yang benar.
        const baseDelay = Math.min(8000 * Math.pow(2, pairingAttempts - 1), 60000);
        const delay = baseDelay + Math.floor(Math.random() * 2000);

        console.log(chalk.yellow(`⚠️  ${tag} Pairing belum selesai (statusCode ${statusCode}, alasan: ${reasonText || "Connection Failure"}) — reset sesi & siapkan ${usePairingCode ? "kode" : "QR"} baru dalam ${Math.round(delay / 1000)}s (percobaan ke-${pairingAttempts}/${MAX_PAIRING_RETRIES})...`));

        const retryTimer = setTimeout(() => {
          reconnectTimers.delete(botId);
          if (activeSessions.get(botId) === sessionId) {
            // isReconnect=false supaya kode pairing BARU diminta (kode lama
            // sudah tidak valid setelah gagal).
            connectToWhatsApp(dashboardApp, botConfig, false).catch((err) => {
              console.error(chalk.red(`${tag} Pairing retry error:`), err.message);
            });
          }
        }, delay);
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
