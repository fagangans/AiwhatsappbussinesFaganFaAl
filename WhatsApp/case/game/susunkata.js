import {
  hasSession,
  setSession,
  deleteSession,
} from "../../lib/gameSession.js";
import { addReward, addLoss, getPlayer } from "../../lib/player.js";

const wordList = [
  "belajar", "sekolah", "komputer", "handphone", "perpustakaan",
  "kucing", "matahari", "pelangi", "gunung", "laut",
  "pantai", "hujan", "petir", "bunga", "mawar",
  "pisang", "jeruk", "anggur", "kertas", "pensil",
  "rumah", "pohon", "langit", "bintang", "bulan",
  "awan", "sungai", "danau", "jembatan", "pasar",
  "serigala", "harimau", "gajah", "kerbau", "lumba-lumba",
];

function scrambleWord(word) {
  const letters = word.split("");
  let scrambled;
  let attempts = 0;
  do {
    scrambled = [...letters];
    for (let i = scrambled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [scrambled[i], scrambled[j]] = [scrambled[j], scrambled[i]];
    }
    attempts++;
  } while (scrambled.join("") === word && attempts < 20);
  return scrambled.join("");
}

// Metadata
export const info = {
  name: "Susun Kata",

  menu: ["Susunkata"],
  case: ["susunkata"],

  description: "Susun huruf acak menjadi kata yang benar!",
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

  const originalWord = wordList[Math.floor(Math.random() * wordList.length)];
  const scrambled = scrambleWord(originalWord);

  const hintText = `Huruf pertama: *${originalWord.charAt(0).toUpperCase()}* | Huruf terakhir: *${originalWord.charAt(originalWord.length - 1).toUpperCase()}*`;

  const timer = setTimeout(async () => {
    deleteSession(replyJid, normalizedSender);
    addLoss(normalizedSender);
    await LenwyText(
      `*Waktu Habis!*\n\n` +
        `Huruf acak: *${scrambled.toUpperCase()}*\n` +
        `Jawaban yang benar: *${originalWord}*\n\n` +
        `Sayang sekali, ${pushname}! Coba lagi ya.`,
    );
  }, 60000);

  setSession(replyJid, normalizedSender, {
    type: "susunkata",
    hint: hintText,
    correctAnswer: originalWord,
    timer,
    onAnswer: async (input, ctx) => {
      const answer = input.trim().toLowerCase();
      if (!answer) return false;

      // Only process if the answer uses roughly the same letters
      if (answer.length !== originalWord.length) return false;

      deleteSession(replyJid, normalizedSender);

      if (answer === originalWord.toLowerCase()) {
        const player = addReward(normalizedSender, 35, 80);
        await ctx.LenwyText(
          `*Benar!*\n\n` +
            `Huruf acak: *${scrambled.toUpperCase()}*\n` +
            `Jawaban: *${originalWord}*\n\n` +
            `+35 XP | +80 Balance\n\n` +
            `*Stats:*\n` +
            `- XP: ${player.xp}\n` +
            `- Balance: ${player.balance}\n` +
            `- Level: ${player.level}`,
        );
      } else {
        addLoss(normalizedSender);
        await ctx.LenwyText(
          `*Salah!*\n\n` +
            `Jawabanmu: *${answer}*\n` +
            `Jawaban benar: *${originalWord}*\n\n` +
            `Jangan menyerah, coba lagi!`,
        );
      }
      return true;
    },
  });

  await LenwyText(
    `*SUSUN KATA*\n\n` +
      `Susun huruf acak berikut menjadi kata yang benar!\n\n` +
      `*${scrambled.toUpperCase()}*\n\n` +
      `Jumlah huruf: *${originalWord.length}*\n` +
      `Waktu: 60 detik\n` +
      `Hadiah: +35 XP | +80 Balance\n\n` +
      `Ketik *.hint* untuk petunjuk!`,
  );
}
