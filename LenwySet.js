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

const terminalWidth = process.stdout.columns || 80;
const maxWidth = Math.min(terminalWidth, 50);

// Konfigurasi Bot
const config = {
  telegram: false,
  dashboard: true,
  bots: [
    { id: "bot1", name: "Bot 1" },
    { id: "bot2", name: "Bot 2" },
    { id: "bot3", name: "Bot 3" },
    { id: "bot4", name: "Bot 4" },
    { id: "bot5", name: "Bot 5" },
    { id: "bot6", name: "Bot 6" },
    { id: "bot7", name: "Bot 7" },
    { id: "bot8", name: "Bot 8" },
    { id: "bot9", name: "Bot 9" },
    { id: "bot10", name: "Bot 10" },
  ],
};

// Fungsi utama
(async () => {
  try {
    // Start Dashboard
    let dashboardApp = null;
    if (config.dashboard) {
      console.log(chalk.green.bold("\n🖥️  Menjalankan Business Dashboard"));
      const { default: startDashboard } = await import("./dashboard/server.js");
      dashboardApp = startDashboard();
    }

    if (config.bots.length > 0) {
      console.log(chalk.green.bold(`\n🎁  Menjalankan ${config.bots.length} WhatsApp Business CS Bot`));
      const { default: startWhatsApp } = await import("./WhatsApp/index.js");
      for (const botConfig of config.bots) {
        await startWhatsApp(dashboardApp, botConfig);
      }
    } else {
      console.log(
        chalk.red.bold("\n❌  Tidak ada bot WhatsApp yang dikonfigurasi"),
      );
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
🎁  Bots: ${config.bots.length} bot dikonfigurasi
🎁  Features : CRM, Order, Ticket, Broadcast, FAQ, Analytics

${chalk.green.bold("🎁  Business Ready!")}\n`),
    );
  } catch (err) {
    console.error(
      chalk.red.bold("\n⚠️  Terjadi Kesalahan : " + err.message + "\n"),
    );
  }
})();
