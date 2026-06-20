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

(async () => {
  try {
    let dashboardApp = null;
    if (config.dashboard) {
      console.log(chalk.green.bold("\n🖥️  Menjalankan Business Dashboard"));
      const { default: startDashboard } = await import("./dashboard/server.js");
      dashboardApp = startDashboard();
    }

    const { default: startWhatsApp, stopBot } = await import("./WhatsApp/index.js");

    if (dashboardApp) {
      dashboardApp.connectBot = (botConfig) => startWhatsApp(dashboardApp, botConfig);
      dashboardApp.stopBot = stopBot;
    }

    const dbBots = getAllBots();
    const activeBots = dbBots.filter(b => {
      const sessionPath = path.resolve(__dirname, "sessions", b.id);
      return b.is_active && fs.existsSync(sessionPath);
    });

    if (activeBots.length > 0) {
      console.log(chalk.green.bold(`\n🎁  Menjalankan ${activeBots.length} WhatsApp Business CS Bot`));
      for (const bot of activeBots) {
        await startWhatsApp(dashboardApp, { id: bot.id, name: bot.name, phone: bot.phone, owner_id: bot.owner_id });
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
