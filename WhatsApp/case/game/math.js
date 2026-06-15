import {
  hasSession,
  setSession,
  deleteSession,
} from "../../lib/gameSession.js";
import { addReward, addLoss } from "../../lib/player.js";

// Metadata
export const info = {
  name: "Math Quiz",

  menu: ["Math"],
  case: ["math", "matematika"],

  description: "Jawab soal matematika acak dan dapatkan hadiah!",
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
    return LenwyText("⚠️ Kamu masih punya soal yang belum dijawab!");
  }

  // Pick random difficulty
  const difficulties = ["easy", "medium", "hard"];
  const difficulty = difficulties[Math.floor(Math.random() * difficulties.length)];

  let min, max;
  switch (difficulty) {
    case "easy":
      min = 1;
      max = 20;
      break;
    case "medium":
      min = 10;
      max = 100;
      break;
    case "hard":
      min = 50;
      max = 500;
      break;
  }

  const ops = ["+", "-", "×", "÷"];
  const op = ops[Math.floor(Math.random() * ops.length)];

  let a = Math.floor(Math.random() * (max - min + 1)) + min;
  let b = Math.floor(Math.random() * (max - min + 1)) + min;
  let correctAnswer;

  switch (op) {
    case "+":
      correctAnswer = a + b;
      break;
    case "-":
      // Ensure non-negative result
      if (b > a) [a, b] = [b, a];
      correctAnswer = a - b;
      break;
    case "×":
      // Keep multiplication manageable
      if (difficulty === "hard") {
        a = Math.floor(Math.random() * 50) + 10;
        b = Math.floor(Math.random() * 20) + 2;
      }
      correctAnswer = a * b;
      break;
    case "÷":
      // Ensure clean division
      b = Math.floor(Math.random() * (max - min + 1)) + min;
      if (b === 0) b = 1;
      a = b * (Math.floor(Math.random() * 20) + 1);
      correctAnswer = a / b;
      break;
  }

  const diffLabel =
    difficulty === "easy" ? "🟢 Mudah" : difficulty === "medium" ? "🟡 Sedang" : "🔴 Sulit";

  const timer = setTimeout(async () => {
    deleteSession(replyJid, normalizedSender);
    addLoss(normalizedSender);
    await LenwyText(
      `⏰ *Waktu Habis!*\n\n` +
        `Jawaban yang benar: *${correctAnswer}*\n` +
        `Sayang sekali, ${pushname}! Coba lagi ya.`,
    );
  }, 45000);

  setSession(replyJid, normalizedSender, {
    type: "math",
    hint: `Soal: ${a} ${op} ${b}`,
    correctAnswer,
    timer,
    onAnswer: async (input, ctx) => {
      const answer = parseInt(input, 10);
      if (isNaN(answer)) return false;

      deleteSession(replyJid, normalizedSender);

      if (answer === correctAnswer) {
        const player = addReward(normalizedSender, 50, 100);
        await ctx.LenwyText(
          `✅ *Benar!*\n\n` +
            `Jawaban: *${correctAnswer}*\n` +
            `🎁 +50 XP | +100 Balance\n\n` +
            `📊 *Stats:*\n` +
            `• XP: ${player.xp}\n` +
            `• Balance: ${player.balance}\n` +
            `• Level: ${player.level}`,
        );
      } else {
        addLoss(normalizedSender);
        await ctx.LenwyText(
          `❌ *Salah!*\n\n` +
            `Jawabanmu: *${answer}*\n` +
            `Jawaban benar: *${correctAnswer}*\n` +
            `Jangan menyerah, coba lagi!`,
        );
      }
      return true;
    },
  });

  await LenwyText(
    `🧮 *MATH QUIZ*\n` +
      `Difficulty: ${diffLabel}\n\n` +
      `Berapa hasil dari:\n\n` +
      `*${a} ${op} ${b} = ?*\n\n` +
      `⏱️ Waktu: 45 detik\n` +
      `💰 Hadiah: +50 XP | +100 Balance`,
  );
}
