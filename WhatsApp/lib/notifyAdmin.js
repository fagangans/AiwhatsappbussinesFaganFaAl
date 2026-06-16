import fs from "fs";
import path from "path";

const CreatorPath = path.join(process.cwd(), "WhatsApp", "database", "creator.json");

function readCreators() {
  try {
    return JSON.parse(fs.readFileSync(CreatorPath, "utf8"));
  } catch {
    return [];
  }
}

export async function notifyAdmins(lenwy, text) {
  const admins = readCreators();
  for (const jid of admins) {
    try {
      await lenwy.sendMessage(jid, { text });
    } catch (err) {
      console.error("Gagal kirim notifikasi admin:", err?.message || err);
    }
  }
}
