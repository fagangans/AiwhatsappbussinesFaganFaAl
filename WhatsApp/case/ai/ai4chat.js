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
import { askGemini } from "../../scrape/Gemini.js";
import { getHistory, addMessage, clearHistory } from "../../lib/aiMemory.js";
import { getKnowledgeText } from "../../lib/knowledge.js";
import { getModel } from "../../lib/aiModel.js";
import { getProductCatalogText } from "../../lib/products.js";
import { searchWeb } from "../../scrape/WebSearch.js";

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

// Kata kunci yang menandakan butuh info terkini/real-time dari internet
const WEB_SEARCH_KEYWORDS = [
  "hari ini", "sekarang", "terbaru", "terkini", "terbaru ini", "saat ini",
  "berita", "kabar", "viral", "trending", "update", "skor", "pertandingan",
  "cuaca", "ramalan", "harga emas", "harga bbm", "kurs", "nilai tukar",
  "kapan", "tanggal berapa", "jam berapa", "siapa presiden", "siapa menteri",
  "hasil pemilu", "covid", "gempa", "bencana", "rilis", "launching",
];

const GREETING_REGEX =
  /^(hai|halo|hallo|hello|hi|p|pagi|siang|sore|malam|test|tes|woi|woy|ok|oke|sip|makasih|terima kasih|thanks)\b/i;

// Tentukan apakah query butuh pencarian web (info terkini) atau cukup dijawab dari pengetahuan AI
function needsWebSearch(q) {
  const text = q.toLowerCase().trim();
  if (text.length < 4) return false;
  if (GREETING_REGEX.test(text)) return false;
  return WEB_SEARCH_KEYWORDS.some((k) => text.includes(k));
}

// Cegah web search menggantung lama — kalau lewat batas waktu, lanjut tanpa hasil web
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

// Fungsi AI yang bisa dipakai ulang (oleh perintah .ai maupun mode Auto AI).
// Mendukung multi-model: gemini-flash, gemini-pro, atau default (Ai4Chat scraper).
export async function getAIAnswer(q, userId = null) {
  const persona = globalThis.aiPersona || "";
  const model = userId ? getModel(userId) : "gemini-flash";

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

  // Katalog produk toko (untuk jawab FAQ ketersediaan/harga barang)
  const catalog = getProductCatalogText();

  // Web search — hanya dijalankan kalau pertanyaan memang butuh info terkini,
  // dan dibatasi waktu maksimum agar tidak memperlambat chat biasa (sapaan, dll).
  let webResult = null;
  if (needsWebSearch(q)) {
    webResult = await withTimeout(searchWeb(q).catch(() => null), 12000);
  }
  const webContext = webResult
    ? "\n\nHasil pencarian web (gunakan sebagai referensi tambahan, rangkum dengan bahasa sendiri, jangan copy-paste mentah):\n" +
      webResult
    : "";

  const fullPrompt = `${persona}${knowledge}${catalog}${webContext}${context}\n\nUser: ${q}`;

  let answer = null;

  // Gemini models (gemini-flash / gemini-pro)
  if (model.startsWith("gemini")) {
    try {
      answer = await askGemini(fullPrompt, model);
    } catch (err) {
      console.error(`Gemini (${model}) gagal:`, err?.message || err);
    }

    // Fallback ke Ai4Chat bila Gemini gagal
    if (!answer) {
      try {
        answer = await Ai4Chat(fullPrompt);
      } catch (err) {
        console.error("Ai4Chat fallback gagal:", err.message);
      }
    }
  } else {
    // Default model: Ai4Chat → PublicAI fallback
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

  await LenwyText(answer);
}
