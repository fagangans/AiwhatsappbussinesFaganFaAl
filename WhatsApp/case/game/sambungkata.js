import {
  hasSession,
  setSession,
  deleteSession,
} from "../../lib/gameSession.js";
import { addReward, addLoss, getPlayer } from "../../lib/player.js";

const starterWords = [
  "apel", "buku", "cinta", "dunia", "elang",
  "gajah", "hujan", "ikan", "jeruk", "kuda",
  "laut", "malam", "naga", "obat", "pagi",
  "raja", "singa", "taman", "udara", "waktu",
  "api", "bulan", "daun", "embun", "gunung",
  "hutan", "jalan", "kertas", "lampu", "mesin",
];

// Metadata
export const info = {
  name: "Sambung Kata",

  menu: ["Sambungkata"],
  case: ["sambungkata"],

  description: "Sambung kata - kata berikutnya harus diawali huruf terakhir kata sebelumnya!",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

// Handler
export default async function handler(leni) {
  const { LenwyText, replyJid, normalizedSender, pushname } = leni;

  if (hasSession(replyJid, normalizedSender)) {
    return LenwyText("*Kamu masih punya permainan yang belum selesai!*");
  }

  const startWord = starterWords[Math.floor(Math.random() * starterWords.length)];
  const lastLetter = startWord.charAt(startWord.length - 1).toLowerCase();

  // Mutable game state shared across closures
  const state = {
    lastWord: startWord,
    usedWords: [startWord],
    score: 0,
  };

  function endGame(finalScore) {
    deleteSession(replyJid, normalizedSender);
    if (finalScore > 0) {
      const bonus = finalScore > 5 ? 50 : 0;
      const bonusBalance = finalScore > 5 ? 80 : 0;
      if (bonus > 0) addReward(normalizedSender, bonus, bonusBalance);
      return { bonus, bonusBalance };
    }
    addLoss(normalizedSender);
    return { bonus: 0, bonusBalance: 0 };
  }

  function createTurnTimer() {
    return setTimeout(async () => {
      const { bonus, bonusBalance } = endGame(state.score);

      if (state.score > 0) {
        const player = getPlayer(normalizedSender);
        await LenwyText(
          `*Waktu Habis!*\n\n` +
            `Kata terakhir: *${state.lastWord}*\n` +
            `Skor akhir: *${state.score} kata*\n\n` +
            (bonus > 0 ? `*Bonus: +${bonus} XP | +${bonusBalance} Balance*\n\n` : "") +
            `*Stats:*\n` +
            `- XP: ${player.xp}\n` +
            `- Balance: ${player.balance}\n` +
            `- Level: ${player.level}\n\n` +
            `Waktu habis, ${pushname}! Coba lagi ya.`,
        );
      } else {
        await LenwyText(
          `*Waktu Habis!*\n\n` +
            `Kata terakhir: *${state.lastWord}*\n` +
            `Skor akhir: *0 kata*\n\n` +
            `Sayang sekali, ${pushname}! Coba lagi ya.`,
        );
      }
    }, 30000);
  }

  // The onAnswer handler as a named function so it can reference itself
  async function onAnswer(input, ctx) {
    const word = input.trim().toLowerCase();
    if (!word || word.length < 3) return false;

    const requiredLetter = state.lastWord.charAt(state.lastWord.length - 1).toLowerCase();

    // Wrong starting letter - end game
    if (word.charAt(0).toLowerCase() !== requiredLetter) {
      const { bonus, bonusBalance } = endGame(state.score);

      if (state.score > 0) {
        const player = getPlayer(normalizedSender);
        await ctx.LenwyText(
          `*Salah!* Kata harus diawali huruf *${requiredLetter.toUpperCase()}*\n\n` +
            `Kata kamu: *${word}*\n` +
            `Skor akhir: *${state.score} kata*\n\n` +
            (bonus > 0 ? `*Bonus: +${bonus} XP | +${bonusBalance} Balance*\n\n` : "") +
            `*Stats:*\n` +
            `- XP: ${player.xp}\n` +
            `- Balance: ${player.balance}\n` +
            `- Level: ${player.level}`,
        );
      } else {
        await ctx.LenwyText(
          `*Salah!* Kata harus diawali huruf *${requiredLetter.toUpperCase()}*\n\n` +
            `Kata kamu: *${word}*\n` +
            `Skor akhir: *0 kata*\n\n` +
            `Jangan menyerah, coba lagi!`,
        );
      }
      return true;
    }

    // Duplicate word - end game
    if (state.usedWords.includes(word)) {
      const { bonus, bonusBalance } = endGame(state.score);

      if (state.score > 0) {
        const player = getPlayer(normalizedSender);
        await ctx.LenwyText(
          `*Kata sudah digunakan!* "${word}"\n\n` +
            `Skor akhir: *${state.score} kata*\n\n` +
            (bonus > 0 ? `*Bonus: +${bonus} XP | +${bonusBalance} Balance*\n\n` : "") +
            `*Stats:*\n` +
            `- XP: ${player.xp}\n` +
            `- Balance: ${player.balance}\n` +
            `- Level: ${player.level}`,
        );
      } else {
        await ctx.LenwyText(
          `*Kata sudah digunakan!* "${word}"\n\n` +
            `Skor akhir: *0 kata*\n\n` +
            `Jangan menyerah, coba lagi!`,
        );
      }
      return true;
    }

    // Valid word - update state
    state.score += 1;
    state.usedWords.push(word);
    state.lastWord = word;

    const player = addReward(normalizedSender, 20, 30);
    const nextLetter = word.charAt(word.length - 1).toLowerCase();

    // Reset timer for next turn
    const newTimer = createTurnTimer();

    setSession(replyJid, normalizedSender, {
      type: "sambungkata",
      hint: `Kata harus diawali huruf: *${nextLetter.toUpperCase()}*`,
      correctAnswer: nextLetter,
      timer: newTimer,
      onAnswer,
    });

    await ctx.LenwyText(
      `*Benar!* "${word}"\n\n` +
        `+20 XP | +30 Balance\n` +
        `Skor: *${state.score} kata*\n\n` +
        `Kata selanjutnya harus diawali huruf: *${nextLetter.toUpperCase()}*\n` +
        `Waktu: 30 detik`,
    );

    return true;
  }

  const timer = createTurnTimer();

  setSession(replyJid, normalizedSender, {
    type: "sambungkata",
    hint: `Kata harus diawali huruf: *${lastLetter.toUpperCase()}*`,
    correctAnswer: lastLetter,
    timer,
    onAnswer,
  });

  await LenwyText(
    `*SAMBUNG KATA*\n\n` +
      `Sambung kata berikutnya! Kata harus diawali dengan huruf terakhir dari kata sebelumnya.\n\n` +
      `Kata pertama: *${startWord}*\n` +
      `Huruf selanjutnya: *${lastLetter.toUpperCase()}*\n\n` +
      `Syarat:\n` +
      `- Minimal 3 huruf\n` +
      `- Tidak boleh mengulang kata\n\n` +
      `Waktu: 30 detik per giliran\n` +
      `Hadiah: +20 XP | +30 Balance per kata\n` +
      `Bonus: +50 XP | +80 Balance jika skor > 5!`,
  );
}
