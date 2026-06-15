import axios from "axios";

// Metadata
export const info = {
  name: "Text To Speech",

  menu: ["TTS"],
  case: ["tts", "say", "suara"],

  description: "Ubah teks menjadi voice note",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

// Handler — sumber: Google Translate TTS (gratis, tanpa API key)
export default async function handler(leni) {
  const { q, lenwy, replyJid, LenwyText, LenwyWait } = leni;

  if (!q) return LenwyText("🔊 *Contoh:* .tts Halo, apa kabar?");

  // Google TTS membatasi panjang teks ~200 karakter
  const text = q.trim().slice(0, 200);

  LenwyWait();

  try {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
      text,
    )}&tl=id&client=tw-ob`;

    const { data } = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    await lenwy.sendMessage(replyJid, {
      audio: Buffer.from(data),
      mimetype: "audio/mpeg",
      ptt: true,
    });
  } catch (err) {
    console.error("TTS Error:", err?.message || err);
    LenwyText("❌ Gagal membuat suara. Coba teks yang lebih pendek.");
  }
}
