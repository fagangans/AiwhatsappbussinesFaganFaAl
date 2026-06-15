import { hasSession, setSession, deleteSession } from "../../lib/gameSession.js";
import { addReward, addLoss, getPlayer } from "../../lib/player.js";

// Metadata
export const info = {
  name: "Teka-teki",

  menu: ["Tekateki"],
  case: ["tekateki"],

  description: "Jawab teka-teki klasik Indonesia",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

const RIDDLES = [
  { question: "Semakin diambil semakin banyak, apakah itu?", answer: "langkah" },
  { question: "Apa yang punya kaki tapi tidak bisa berjalan?", answer: "meja" },
  { question: "Apa yang selalu datang tapi tidak pernah sampai?", answer: "besok" },
  { question: "Semakin panjang semakin pendek, apakah itu?", answer: "umur" },
  { question: "Punya mata tapi tidak bisa melihat, apakah itu?", answer: "jarum" },
  { question: "Apa yang bisa naik tapi tidak bisa turun?", answer: "usia" },
  { question: "Apa yang punya leher tapi tidak punya kepala?", answer: "botol" },
  { question: "Apa yang kalau dipukul malah senang?", answer: "drum" },
  { question: "Apa yang bisa berjalan tanpa kaki?", answer: "waktu" },
  { question: "Apa yang punya gigi tapi tidak bisa menggigit?", answer: "sisir" },
  { question: "Apa yang semakin dipotong semakin panjang?", answer: "jalan" },
  { question: "Apa yang punya tangan tapi tidak bisa memegang?", answer: "jam" },
  { question: "Apa yang selalu basah meskipun di tempat kering?", answer: "lidah" },
  { question: "Apa yang masuk air tidak basah?", answer: "bayangan" },
  { question: "Apa yang punya daun tapi bukan tumbuhan?", answer: "pintu" },
  { question: "Apa yang punya mulut tapi tidak bisa bicara?", answer: "sungai" },
  { question: "Apa yang bisa ditangkap tapi tidak bisa dilempar?", answer: "flu" },
  { question: "Apa yang punya kulit tapi bukan hewan?", answer: "buah" },
  { question: "Apa yang punya kepala dan ekor tapi tidak punya badan?", answer: "koin" },
  { question: "Apa yang hitam saat bersih dan putih saat kotor?", answer: "papan tulis" },
  { question: "Apa yang ada di depan kamu tapi tidak bisa dilihat?", answer: "masa depan" },
  { question: "Apa yang punya telinga tapi tidak bisa mendengar?", answer: "cangkir" },
  { question: "Apa yang selalu di tanah tapi tidak pernah kotor?", answer: "bayangan" },
  { question: "Apa yang bisa pecah tapi tidak pernah jatuh?", answer: "hati" },
  { question: "Apa yang bisa terbang tanpa sayap?", answer: "waktu" },
  { question: "Apa yang punya banyak kunci tapi tidak bisa membuka pintu?", answer: "piano" },
  { question: "Apa yang punya punggung tapi tidak bisa membungkuk?", answer: "buku" },
  { question: "Apa yang makin besar makin ringan?", answer: "balon" },
];

function makeHint(answer) {
  return `${answer.length} huruf, diawali huruf "${answer[0].toUpperCase()}"`;
}

// Handler
export default async function handler(leni) {
  const { command, LenwyText, replyJid, normalizedSender, pushname } = leni;

  if (hasSession(replyJid, normalizedSender)) {
    return LenwyText("⚠️ Kamu masih punya sesi game yang aktif! Jawab dulu atau tunggu sampai waktu habis.");
  }

  const item = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
  const correctAnswer = item.answer.toLowerCase().trim();
  const hint = makeHint(item.answer);

  const timer = setTimeout(async () => {
    deleteSession(replyJid, normalizedSender);
    addLoss(normalizedSender);
    await LenwyText(
      `⏰ *Waktu Habis!*\n\n` +
      `Jawaban yang benar adalah: *${item.answer}*\n` +
      `Coba lagi dengan *.tekateki*`
    );
  }, 60000);

  setSession(replyJid, normalizedSender, {
    type: "tekateki",
    hint,
    correctAnswer,
    timer,
    onAnswer: async (input, ctx) => {
      const guess = input.toLowerCase().trim();
      if (guess === correctAnswer) {
        deleteSession(replyJid, normalizedSender);
        const player = addReward(normalizedSender, 35, 80);
        await ctx.LenwyText(
          `🎉 *Benar!*\n\n` +
          `Jawabannya memang *${item.answer}*\n\n` +
          `🏅 *+35 XP* | 💰 *+80 Balance*\n` +
          `📊 Level: ${player.level} | XP: ${player.xp} | Balance: ${player.balance}`
        );
        return true;
      }
      return false;
    },
  });

  await LenwyText(
    `❓ *TEKA-TEKI*\n\n` +
    `🧩 *Pertanyaan:*\n${item.question}\n\n` +
    `💡 *Hint:* ${hint}\n` +
    `⏱️ Waktu: 60 detik\n\n` +
    `Kirim jawabanmu sekarang!`
  );
}
