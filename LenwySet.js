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
  whatsapp: true,
  telegram: false,
  dashboard: true,
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

    if (config.whatsapp) {
      console.log(chalk.green.bold("\n🎁  Menjalankan WhatsApp Business CS Bot"));
      const { default: startWhatsApp } = await import("./WhatsApp/index.js");
      startWhatsApp(dashboardApp);
    } else {
      console.log(
        chalk.red.bold("\n❌  Bot WhatsApp Dinonaktifkan Di LenwySet.js"),
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
🎁  Features : CRM, Order, Ticket, Broadcast, FAQ, Analytics

${chalk.green.bold("🎁  Business Ready!")}\n`),
    );
  } catch (err) {
    console.error(
      chalk.red.bold("\n⚠️  Terjadi Kesalahan : " + err.message + "\n"),
    );
  }
})();
