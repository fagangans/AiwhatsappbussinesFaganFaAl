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

import chalk from "chalk";
import figlet from "figlet";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAllBots } from "./WhatsApp/database/business/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const terminalWidth = process.stdout.columns || 80;
const maxWidth = Math.min(terminalWidth, 50);

const config = {
  telegram: false,
  dashboard: true,
};

process.on("unhandledRejection", (reason) => {
  console.error(chalk.red.bold("⚠️  Unhandled Rejection:"), reason);
});
process.on("uncaughtException", (err) => {
  console.error(chalk.red.bold("⚠️  Uncaught Exception:"), err);
});

// Cek apakah sebuah sesi sudah benar-benar TERDAFTAR (pairing/QR sudah tuntas).
// useMultiFileAuthState menyimpan creds.json; field `registered` true berarti
// device sudah tertaut ke WhatsApp & bisa langsung reconnect (login node).
// Folder sesi yang ADA tapi registered=false adalah sesi "setengah-jadi" dari
// percobaan pairing yang BELUM tuntas — JANGAN auto-start saat boot, karena:
//   (1) tidak ada yang menonton dashboard untuk memasukkan kode → kode pairing
//       kedaluwarsa percuma (408 "QR refs attempts ended"),
//   (2) retry berulang saat boot bisa memicu pembatasan nomor oleh WhatsApp.
// Bot seperti ini harus menunggu user melakukan pairing via dashboard saat siap.
function isSessionRegistered(sessionPath) {
  try {
    const credsPath = path.join(sessionPath, "creds.json");
    if (!fs.existsSync(credsPath)) return false;
    const creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
    return !!creds.registered;
  } catch {
    return false;
  }
}

// Diisi setelah modul WhatsApp/index.js berhasil di-import di bawah, supaya
// shutdown handler bisa menutup socket dengan rapi tanpa import ulang.
let closeAllWaSockets = null;

let isShuttingDown = false;
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(chalk.yellow.bold(`\n⏹  ${signal} diterima, menutup aplikasi...`));

  // Jaga-jaga kalau proses penutupan macet — jangan sampai systemd/PM2
  // terpaksa SIGKILL paksa sebelum sempat menyimpan apapun.
  const forceExitTimer = setTimeout(() => {
    console.log(chalk.red.bold("⚠️  Penutupan terlalu lama, keluar paksa."));
    process.exit(1);
  }, 5000);

  try {
    if (closeAllWaSockets) {
      await closeAllWaSockets();
    }
    // Beri sedikit waktu agar penulisan file sesi WhatsApp (creds.json dkk)
    // yang mungkin masih berjalan sempat selesai sebelum proses benar-benar
    // dimatikan — ini mencegah sesi WhatsApp hilang/corrupt saat VPS di-reboot.
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (err) {
    console.error(chalk.red.bold("⚠️  Gagal menutup koneksi dengan rapi:"), err);
  } finally {
    clearTimeout(forceExitTimer);
    process.exit(0);
  }
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

(async () => {
  try {
    let dashboardApp = null;
    if (config.dashboard) {
      console.log(chalk.green.bold("\n🖥️  Menjalankan Business Dashboard"));
      const { default: startDashboard } = await import("./dashboard/server.js");
      dashboardApp = startDashboard();
    }

    const { default: startWhatsApp, stopBot, closeAllSockets } = await import("./WhatsApp/index.js");
    closeAllWaSockets = closeAllSockets;

    if (dashboardApp) {
      dashboardApp.connectBot = (botConfig) => startWhatsApp(dashboardApp, botConfig);
      dashboardApp.stopBot = stopBot;
    }

    const dbBots = getAllBots();
    const activeBots = dbBots.filter(b => {
      const sessionPath = path.resolve(__dirname, "sessions", b.id);
      return b.is_active && isSessionRegistered(sessionPath);
    });

    if (activeBots.length > 0) {
      console.log(chalk.green.bold(`\n🎁  Menjalankan ${activeBots.length} WhatsApp Business CS Bot`));
      for (const bot of activeBots) {
        // Reconnect dari sesi yang tersimpan — TIDAK perlu pair ulang. Kalau
        // satu bot gagal start, jangan sampai menghentikan bot lain.
        try {
          await startWhatsApp(dashboardApp, { id: bot.id, name: bot.name, phone: bot.phone, owner_id: bot.owner_id });
        } catch (err) {
          console.error(chalk.red.bold(`⚠️  Gagal memulai bot ${bot.name}:`), err.message || err);
        }
        // Beri jeda antar-bot supaya tidak ada banyak handshake WhatsApp
        // serentak saat startup (bisa memicu pembatasan dari sisi WhatsApp/IP).
        await new Promise((r) => setTimeout(r, 1500));
      }
    } else {
      console.log(chalk.yellow.bold("\n⚠️  Tidak ada bot yang sudah ter-pair. Tambahkan bot via Dashboard."));
    }

    if (config.telegram) {
      console.log(chalk.green.bold("\n🎁  Menjalankan Lenwy Bot Telegram"));
      const { default: startTelegram } = await import("./Telegram/index.js");
      startTelegram();
    } else {
      console.log(
        chalk.red.bold("\n❌  Bot Telegram Dinonaktifkan Di LenwySet.js\n"),
      );
    }

    const logo = await figlet.text("Business CS", {
      font: "ANSI Shadow",
      horizontalLayout: "default",
      verticalLayout: "default",
      width: maxWidth,
      whitespaceBreak: false,
    });

    console.log(chalk.blue.bold(logo));

    console.log(
      chalk.white.bold(`${chalk.green.bold("📃  Informasi :")}
✉️  WhatsApp Business Customer Service Bot
✉️  Base : Lenwy SCM
✉️  Dashboard: http://localhost:${process.env.DASHBOARD_PORT || 3000}
🎁  Bots: ${activeBots.length} bot aktif (${dbBots.length} total terdaftar)
🎁  Features : CRM, Order, Ticket, Broadcast, FAQ, Analytics

${chalk.green.bold("🎁  Business Ready!")}\n`),
    );
  } catch (err) {
    console.error(
      chalk.red.bold("\n⚠️  Terjadi Kesalahan : " + err.message + "\n"),
    );
  }
})();
