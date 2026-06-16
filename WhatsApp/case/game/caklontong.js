import { hasSession, setSession, deleteSession } from "../../lib/gameSession.js";
import { addReward, addLoss, getPlayer } from "../../lib/player.js";

// Metadata
export const info = {
  name: "Cak Lontong",

  menu: ["Caklontong"],
  case: ["caklontong"],

  description: "Kuis lucu dan absurd ala Cak Lontong",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

const QUESTIONS = [
  { question: "Kambing kalau masuk air jadi apa?", answer: "basah" },
  { question: "Kenapa kucing kalau lari selalu di depan?", answer: "kalau di belakang namanya ngejar" },
  { question: "Apa bahasa Arabnya sandal jepit?", answer: "jalapan nagini" },
  { question: "Nasi goreng kalau ditulis 9 huruf?", answer: "nasi goren" },
  { question: "Apa yang ada di ujung langit?", answer: "huruf t" },
  { question: "Hitam putih bersuara, apakah itu?", answer: "piano" },
  { question: "Monyet apa yang bisa terbang?", answer: "monyet bersayap" },
  { question: "Kenapa Superman bajunya ketat?", answer: "karena ukurannya s" },
  { question: "Apa bedanya kucing sama kucring?", answer: "huruf r" },
  { question: "Kenapa air laut rasanya asin?", answer: "karena ikannya keringetan" },
  { question: "Gajah apa yang belalainya pendek?", answer: "gajah pesek" },
  { question: "Sapi apa yang bikin orang jengkel?", answer: "sapi lih" },
  { question: "Ikan apa yang nggak bisa berenang?", answer: "ikan asin" },
  { question: "Sayur apa yang paling dingin?", answer: "kembang kool" },
  { question: "Pintu apa yang didorong-dorong nggak bisa dibuka?", answer: "pintu yang tulisannya tarik" },
  { question: "Kenapa Bruce Lee mati?", answer: "karena dia nggak hidup" },
  { question: "Buah apa yang bisa bikin kaget?", answer: "lemon" },
  { question: "Kenapa matematika itu sedih?", answer: "karena banyak masalah" },
  { question: "Apa persamaan antara uang dan rahasia?", answer: "susah dijaga" },
  { question: "Rambut putih namanya uban, kalau rambut merah namanya apa?", answer: "pirang" },
  { question: "Tikus apa yang jalannya dua kaki?", answer: "mickey mouse" },
  { question: "Bebek apa yang jalannya selalu bergerombol?", answer: "bebek angsa" },
  { question: "Nasi apa yang enak banget dimakan?", answer: "nasi padang" },
  { question: "Hewan apa yang paling kurang ajar?", answer: "kutu busuk" },
  { question: "Pohon apa yang paling menyebalkan?", answer: "pohon kelapa karena buahnya suka jatuh" },
  { question: "Apa bedanya matahari sama bulan?", answer: "kalau matahari nggak ada bulannya" },
  { question: "Kenapa ayam kalau berkokok matanya merem?", answer: "karena sudah hafal liriknya" },
  { question: "Bis apa yang bisa dimakan?", answer: "biskuit" },
  { question: "Apa bedanya sepatu sama jengkol?", answer: "kalau sepatu kaki masuk ke sepatu kalau jengkol masuk ke mulut" },
];

// Handler
export default async function handler(leni) {
  const { command, LenwyText, replyJid, normalizedSender, pushname } = leni;

  if (hasSession(replyJid, normalizedSender)) {
    return LenwyText("⚠️ Kamu masih punya sesi game yang aktif! Jawab dulu atau tunggu sampai waktu habis.");
  }

  const item = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
  const correctAnswer = item.answer.toLowerCase().trim();
  const hint = `Diawali huruf "${correctAnswer[0].toUpperCase()}"`;

  const timer = setTimeout(async () => {
    deleteSession(replyJid, normalizedSender);
    addLoss(normalizedSender);
    await LenwyText(
      `⏰ *Waktu Habis!*\n\n` +
      `Jawaban yang benar adalah: *${item.answer}*\n` +
      `Coba lagi dengan *.caklontong*`
    );
  }, 45000);

  setSession(replyJid, normalizedSender, {
    type: "caklontong",
    hint,
    correctAnswer,
    timer,
    onAnswer: async (input, ctx) => {
      const guess = input.toLowerCase().trim();
      if (!guess) return false;
      if (guess === correctAnswer) {
        deleteSession(replyJid, normalizedSender);
        const player = addReward(normalizedSender, 40, 90);
        await ctx.LenwyText(
          `🎉 *Benar!*\n\n` +
          `Jawabannya memang *${item.answer}*\n\n` +
          `🏅 *+40 XP* | 💰 *+90 Balance*\n` +
          `📊 Level: ${player.level} | XP: ${player.xp} | Balance: ${player.balance}`
        );
        return true;
      }
      await ctx.LenwyText(
        `❌ *Jawaban salah!*\n\nSilahkan jawab lagi, waktu masih berjalan!`
      );
      return true;
    },
  });

  await LenwyText(
    `🤡 *CAK LONTONG*\n\n` +
    `❓ *Pertanyaan:*\n${item.question}\n\n` +
    `💡 *Hint:* ${hint}\n` +
    `⏱️ Waktu: 45 detik\n\n` +
    `Kirim jawabanmu sekarang!`
  );
}
