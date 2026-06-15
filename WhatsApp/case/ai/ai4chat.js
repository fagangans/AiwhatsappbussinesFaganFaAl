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

import axios from "axios";
import Ai4Chat from "../../scrape/Ai4Chat.js";
import { getHistory, addMessage, clearHistory } from "../../lib/aiMemory.js";
import { getKnowledgeText } from "../../lib/knowledge.js";

export const info = {
  name: "AI4Chat",

  menu: ["AI"],
  case: ["ai", "resetai"],

  description: "Tanyakan Apa Saja!",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

// Sumber AI cadangan bila Ai4Chat sedang down
async function askPublicAI(q) {
  const url = `https://api.fromscratch.web.id/v1/api/ai/publicai?query=${encodeURIComponent(q)}`;
  const { data } = await axios.get(url, { timeout: 20000 });
  return data?.data?.response || null;
}

// Fungsi AI yang bisa dipakai ulang (oleh perintah .ai maupun mode Auto AI).
// Bila diberi userId, AI akan ingat konteks percakapan sebelumnya.
export async function getAIAnswer(q, userId = null) {
  const persona = globalThis.aiPersona || "";

  // Susun konteks dari riwayat percakapan
  let context = "";
  if (userId) {
    const history = getHistory(userId);
    if (history.length) {
      context =
        "\n\nRiwayat percakapan (konteks):\n" +
        history
          .map((h) => `${h.role === "user" ? "User" : "Kamu"}: ${h.text}`)
          .join("\n");
    }
  }

  // Basis pengetahuan (data bisnis/produk yang diajarkan Owner)
  const knowledge = getKnowledgeText();

  const fullPrompt = `${persona}${knowledge}${context}\n\nUser: ${q}`;

  let answer = null;

  try {
    answer = await Ai4Chat(fullPrompt);
  } catch (err) {
    console.error("Ai4Chat gagal:", err.message);
  }

  if (!answer) {
    try {
      answer = await askPublicAI(fullPrompt);
    } catch (err) {
      console.error("PublicAI gagal:", err.message);
    }
  }

  // Simpan ke memori bila berhasil
  if (userId && answer) {
    addMessage(userId, "user", q);
    addMessage(userId, "assistant", answer);
  }

  return answer;
}

export default async function handler(lenwy) {
  const { command, q, LenwyText, LenwyWait, normalizedSender } = lenwy;

  if (command === "resetai") {
    clearHistory(normalizedSender);
    return LenwyText("🧹 Memori percakapan AI sudah direset. Mulai obrolan baru!");
  }

  if (command !== "ai") return;
  if (!q) return LenwyText("☘️ *Contoh:* .ai Apa itu JavaScript?");

  LenwyWait();

  const answer = await getAIAnswer(q, normalizedSender);

  if (!answer) {
    return LenwyText("⚠️ Semua sumber AI sedang tidak merespon. Coba lagi nanti.");
  }

  await LenwyText(`*Lenwy AI*\n\n${answer}`);
}
