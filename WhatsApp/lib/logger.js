// Pencatat aktivitas sederhana. Semua perintah masuk dicatat ke file log
// agar mudah dipantau/diaudit. Ditulis async (non-blocking) supaya tidak
// memperlambat bot.

import fs from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "WhatsApp", "database", "system");
const FILE = path.join(DIR, "command.log");

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

export function logCommand(sender, text, chat) {
  const id = (sender || "?").split("@")[0];
  const line = `[${new Date().toISOString()}] ${id} @ ${chat || "?"} : ${text}\n`;
  fs.appendFile(FILE, line, () => {});
}
