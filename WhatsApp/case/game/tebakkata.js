import { hasSession, setSession, deleteSession } from "../../lib/gameSession.js";
import { addReward, addLoss, getPlayer } from "../../lib/player.js";

// Metadata
export const info = {
  name: "Tebak Kata",

  menu: ["Tebakkata"],
  case: ["tebakkata"],

  description: "Tebak kata dari deskripsi yang diberikan",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

const WORDS = [
  { definition: "Hewan berkaki empat yang setia pada manusia", answer: "anjing" },
  { definition: "Tempat untuk meminjam dan membaca buku", answer: "perpustakaan" },
  { definition: "Alat untuk menulis di papan tulis", answer: "kapur" },
  { definition: "Planet ketiga dari matahari", answer: "bumi" },
  { definition: "Cairan berwarna merah dalam tubuh manusia", answer: "darah" },
  { definition: "Bangunan tempat tinggal manusia", answer: "rumah" },
  { definition: "Alat elektronik untuk berkomunikasi jarak jauh", answer: "telepon" },
  { definition: "Benda langit yang bersinar di malam hari", answer: "bulan" },
  { definition: "Kendaraan beroda dua yang dikayuh", answer: "sepeda" },
  { definition: "Tempat untuk memasak makanan di rumah", answer: "dapur" },
  { definition: "Hewan yang bisa terbang dan memiliki bulu", answer: "burung" },
  { definition: "Buah berwarna kuning dan bentuknya melengkung", answer: "pisang" },
  { definition: "Alat untuk memotong kertas atau kain", answer: "gunting" },
  { definition: "Tempat belajar dan menuntut ilmu", answer: "sekolah" },
  { definition: "Bagian tubuh yang digunakan untuk berpikir", answer: "otak" },
  { definition: "Hewan laut yang memiliki delapan lengan", answer: "gurita" },
  { definition: "Musim saat hujan turun terus-menerus", answer: "hujan" },
  { definition: "Sayuran berwarna oranye yang baik untuk mata", answer: "wortel" },
  { definition: "Alat musik yang dipetik dan memiliki enam senar", answer: "gitar" },
  { definition: "Tempat menyimpan uang dan melakukan transaksi", answer: "bank" },
  { definition: "Hewan besar yang memiliki belalai panjang", answer: "gajah" },
  { definition: "Minuman berwarna cokelat yang berasal dari biji kopi", answer: "kopi" },
  { definition: "Benda yang digunakan untuk melindungi dari hujan", answer: "payung" },
  { definition: "Profesi seseorang yang mengobati orang sakit", answer: "dokter" },
  { definition: "Bagian tumbuhan yang biasanya berwarna hijau", answer: "daun" },
  { definition: "Alat transportasi yang berjalan di atas rel", answer: "kereta" },
  { definition: "Benda langit yang memberikan cahaya dan panas di siang hari", answer: "matahari" },
  { definition: "Alat yang digunakan untuk mengukur waktu", answer: "jam" },
  { definition: "Hewan yang hidup di air dan bernapas dengan insang", answer: "ikan" },
  { definition: "Tempat luas yang ditanami padi", answer: "sawah" },
  { definition: "Makanan pokok orang Indonesia yang berasal dari padi", answer: "nasi" },
  { definition: "Bangunan tempat beribadah umat Islam", answer: "masjid" },
  { definition: "Hewan reptil yang berjemur dan bisa memutus ekornya", answer: "cicak" },
  { definition: "Alat untuk melihat benda yang sangat kecil", answer: "mikroskop" },
  { definition: "Kumpulan air yang sangat luas dan asin", answer: "laut" },
];

function makeHint(word) {
  if (word.length <= 2) return word;
  const middle = "_".repeat(word.length - 2);
  return `${word[0]}${middle}${word[word.length - 1]}`;
}

// Handler
export default async function handler(leni) {
  const { command, LenwyText, replyJid, normalizedSender, pushname } = leni;

  if (hasSession(replyJid, normalizedSender)) {
    return LenwyText("⚠️ Kamu masih punya sesi game yang aktif! Jawab dulu atau tunggu sampai waktu habis.");
  }

  const item = WORDS[Math.floor(Math.random() * WORDS.length)];
  const correctAnswer = item.answer.toLowerCase().trim();
  const hint = makeHint(correctAnswer);

  const timer = setTimeout(async () => {
    deleteSession(replyJid, normalizedSender);
    addLoss(normalizedSender);
    await LenwyText(
      `⏰ *Waktu Habis!*\n\n` +
      `Jawaban yang benar adalah: *${item.answer}*\n` +
      `Coba lagi dengan *.tebakkata*`
    );
  }, 60000);

  setSession(replyJid, normalizedSender, {
    type: "tebakkata",
    hint,
    correctAnswer,
    timer,
    onAnswer: async (input, ctx) => {
      const guess = input.toLowerCase().trim();
      if (!guess) return false;
      if (guess === correctAnswer) {
        deleteSession(replyJid, normalizedSender);
        const player = addReward(normalizedSender, 30, 75);
        await ctx.LenwyText(
          `🎉 *Benar!*\n\n` +
          `Jawabannya memang *${item.answer}*\n\n` +
          `🏅 *+30 XP* | 💰 *+75 Balance*\n` +
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
    `🔤 *TEBAK KATA*\n\n` +
    `📖 *Deskripsi:*\n${item.definition}\n\n` +
    `💡 *Hint:* ${hint}\n` +
    `⏱️ Waktu: 60 detik\n\n` +
    `Kirim jawabanmu sekarang!`
  );
}
