import { getModel, setModel, getValidModels } from "../../lib/aiModel.js";

// Metadata
export const info = {
  name: "Pilih Model AI",

  menu: ["Aimodel"],
  case: ["aimodel", "modelai", "gantimodel"],

  description: "Pilih model AI yang ingin digunakan",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

const LABELS = {
  "default": "Default (Ai4Chat) — AI scraper gratis",
  "gemini-flash": "Gemini 2.5 Flash — cepat & pintar (Rekomendasi)",
  "gemini-pro": "Gemini 2.5 Pro — paling pintar, sedikit lebih lambat",
};

// Handler
export default async function handler(leni) {
  const { q, normalizedSender, LenwyText } = leni;

  const current = getModel(normalizedSender);

  // Tanpa argumen → tampilkan status + daftar model
  if (!q) {
    let text = `🤖 *Pilih Model AI*\n\n`;
    text += `Model kamu saat ini: *${current}*\n\n`;
    text += `*Model yang tersedia:*\n`;

    for (const m of getValidModels()) {
      const active = m === current ? " ✅" : "";
      text += `➤ .aimodel ${m}${active}\n   _${LABELS[m] || m}_\n`;
    }

    text += `\n*Contoh:* .aimodel gemini-flash`;
    return LenwyText(text);
  }

  const choice = q.trim().toLowerCase();

  if (!getValidModels().includes(choice)) {
    return LenwyText(
      `❌ Model "${choice}" tidak tersedia.\n\nPilihan: ${getValidModels().join(", ")}`,
    );
  }

  setModel(normalizedSender, choice);

  await LenwyText(
    `✅ Model AI berhasil diganti ke *${choice}*\n\n_${LABELS[choice] || ""}_`,
  );
}
