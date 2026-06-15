import { getPlayer, getLeaderboard } from "../../lib/player.js";

export const info = {
  name: "Game Profile",

  menu: ["Profile", "Leaderboard"],
  case: ["profile", "leaderboard", "lb"],

  description: "Lihat profil & leaderboard game",
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
  const { command, LenwyText, normalizedSender, pushname } = leni;

  switch (command) {
    case "profile": {
      const p = getPlayer(normalizedSender, pushname);
      const winrate =
        p.gamesPlayed > 0
          ? ((p.wins / p.gamesPlayed) * 100).toFixed(1)
          : "0.0";

      const text =
        `╔┈┈┈┈「 *YOUR PROFILE* 」┈┈┈┈✧\n` +
        `╎🎮 *Nama:* ${p.name}\n` +
        `╎⭐ *Level:* ${p.level}\n` +
        `╎📊 *XP:* ${p.xp}\n` +
        `╎💰 *Balance:* ${p.balance}\n` +
        `╎🏆 *Menang:* ${p.wins}\n` +
        `╎💔 *Kalah:* ${p.losses}\n` +
        `╎🎲 *Total Game:* ${p.gamesPlayed}\n` +
        `╎📈 *Winrate:* ${winrate}%\n` +
        `╰─────────────────✧`;

      return LenwyText(text);
    }

    case "leaderboard":
    case "lb": {
      const top = getLeaderboard(10);

      if (top.length === 0) {
        return LenwyText("📊 Belum ada pemain terdaftar.");
      }

      const medals = ["🥇", "🥈", "🥉"];
      let text = `╔┈┈┈「 *LEADERBOARD* 」┈┈┈✧\n`;

      top.forEach((p, i) => {
        const medal = medals[i] || `${i + 1}.`;
        text += `╎${medal} *${p.name}* — Lv.${p.level} | XP: ${p.xp} | 💰${p.balance}\n`;
      });

      text += `╰─────────────────✧`;
      return LenwyText(text);
    }
  }
}
