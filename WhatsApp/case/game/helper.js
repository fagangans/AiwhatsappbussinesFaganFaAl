import { getSession, deleteSession } from "../../lib/gameSession.js";
import { addLoss, getPlayer } from "../../lib/player.js";

export const info = {
  name: "Game Helper",

  menu: ["Hint", "Nyerah"],
  case: ["hint", "nyerah"],

  description: "Bantuan saat bermain game",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

export default async function handler(leni) {
  const { command, LenwyText, replyJid, normalizedSender } = leni;

  const session = getSession(replyJid, normalizedSender);

  switch (command) {
    case "hint": {
      if (!session) return LenwyText("⚠️ Kamu tidak sedang bermain game.");

      if (session.type === "siapakahaku" && session.clues) {
        const nextIdx = (session.clueIndex || 0) + 1;
        if (nextIdx >= session.clues.length) {
          return LenwyText("💡 Tidak ada petunjuk lagi! Coba tebak atau ketik *.nyerah*");
        }
        session.clueIndex = nextIdx;
        return LenwyText(
          `💡 *Petunjuk ${nextIdx + 1}:*\n${session.clues[nextIdx]}`,
        );
      }

      if (!session.hint) return LenwyText("💡 Tidak ada hint untuk game ini.");
      return LenwyText(`💡 *Hint:* ${session.hint}`);
    }

    case "nyerah": {
      if (!session) return LenwyText("⚠️ Kamu tidak sedang bermain game.");

      deleteSession(replyJid, normalizedSender);
      addLoss(normalizedSender);

      const answer = session.correctAnswer || "Tidak tersedia";
      return LenwyText(`🏳️ *Menyerah!*\nJawaban: *${answer}*`);
    }
  }
}
