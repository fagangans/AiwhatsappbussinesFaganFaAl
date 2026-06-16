import { hasSession, setSession, deleteSession } from "../../lib/gameSession.js";
import { addReward, addLoss, getPlayer } from "../../lib/player.js";

// Metadata
export const info = {
  name: "Asah Otak",

  menu: ["Asahotak"],
  case: ["asahotak"],

  description: "Jawab pertanyaan logika dan matematika yang menjebak",
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
  { question: "Berapa hasil 1+1+1+1+1+1+1+1+1+1+1×0?", answer: "10", hint: "Ingat urutan operasi hitung (perkalian dulu)" },
  { question: "Ada 3 apel, kamu ambil 2. Berapa apel yang kamu punya?", answer: "2", hint: "Baca lagi pertanyaannya dengan teliti" },
  { question: "Seorang pria memiliki 5 anak perempuan. Setiap anak perempuan punya 1 saudara laki-laki. Berapa total anak pria itu?", answer: "6", hint: "Saudara laki-laki yang sama untuk semua" },
  { question: "Berapa kali angka 9 muncul dari 1 sampai 100?", answer: "20", hint: "Jangan lupa angka 90-an" },
  { question: "Jika 5 mesin membutuhkan 5 menit untuk membuat 5 widget, berapa lama 100 mesin membuat 100 widget?", answer: "5", hint: "Setiap mesin membuat 1 widget dalam waktu yang sama" },
  { question: "Seekor siput naik 3 meter di siang hari dan turun 2 meter di malam hari. Berapa hari untuk naik 10 meter?", answer: "8", hint: "Di hari terakhir siput langsung sampai puncak" },
  { question: "Berapa hasil 0.1 + 0.2? (jawab dalam desimal sederhana)", answer: "0.3", hint: "Ini matematika biasa, bukan bug komputer" },
  { question: "Seorang ayah umurnya 4 kali umur anaknya. 20 tahun lagi, umur ayah 2 kali umur anak. Berapa umur anak sekarang?", answer: "10", hint: "Gunakan aljabar sederhana" },
  { question: "Ada berapa segitiga dalam sebuah bintang 5 sudut (pentagram)?", answer: "10", hint: "Hitung yang besar dan yang kecil" },
  { question: "Jika kamu berlari dan melewati orang di posisi ke-2, kamu sekarang di posisi berapa?", answer: "2", hint: "Kamu menggantikan posisi orang itu" },
  { question: "Berapa hasil dari 8 ÷ 2(2+2)?", answer: "16", hint: "Selesaikan dari kiri ke kanan setelah kurung" },
  { question: "Petani punya 17 ekor sapi. Semua kecuali 9 mati. Berapa sapi yang tersisa?", answer: "9", hint: "Baca kalimatnya pelan-pelan" },
  { question: "Berapa jumlah sudut pada 3 buah segitiga dan 2 buah persegi?", answer: "17", hint: "Segitiga = 3 sudut, Persegi = 4 sudut" },
  { question: "Sebuah jam menunjukkan pukul 3:15. Berapa derajat sudut antara jarum jam dan jarum menit?", answer: "7.5", hint: "Jarum jam juga bergerak sedikit" },
  { question: "Berapa angka selanjutnya: 1, 1, 2, 3, 5, 8, ...?", answer: "13", hint: "Jumlahkan dua angka sebelumnya" },
  { question: "Jika ada 12 ikan di kolam, 3 tenggelam, 4 berenang pergi, 2 mati. Berapa ikan yang masih di kolam?", answer: "12", hint: "Ikan mati dan tenggelam tetap di kolam" },
  { question: "Berapa huruf dalam kata 'EMPAT PULUH SATU'?", answer: "14", hint: "Hitung hurufnya satu per satu (tanpa spasi)" },
  { question: "3 dokter mengatakan Robert adalah saudara mereka. Tapi Robert bilang dia tidak punya saudara. Siapa yang bohong?", answer: "tidak ada", hint: "Dokter tidak harus laki-laki" },
  { question: "Ada berapa bulan yang memiliki 28 hari?", answer: "12", hint: "Semua bulan punya minimal 28 hari" },
  { question: "Jika 2 = 6, 3 = 12, 4 = 20, maka 6 = ?", answer: "42", hint: "Coba kalikan angka dengan angka+1" },
  { question: "Berapa banyak kotak dalam papan catur 8x8? (termasuk semua ukuran)", answer: "204", hint: "Bukan cuma kotak kecil, ada kotak 2x2, 3x3, dst" },
  { question: "Seorang ibu punya 6 anak laki-laki dan masing-masing punya 1 saudara perempuan. Berapa total anak ibu itu?", answer: "7", hint: "Saudara perempuannya cuma satu" },
  { question: "Dua orang ayah dan dua orang anak pergi mancing. Mereka masing-masing mendapat 1 ikan. Total ikan hanya 3. Kenapa? Berapa orang yang mancing?", answer: "3", hint: "Kakek, ayah, dan cucu" },
  { question: "Berapa angka terkecil yang habis dibagi 1 sampai 10?", answer: "2520", hint: "Cari KPK dari 1 sampai 10" },
  { question: "Jika kamu menyalakan korek api dan masuk ke ruangan gelap yang ada lilin, lampu minyak, dan kompor kayu, apa yang kamu nyalakan duluan?", answer: "korek api", hint: "Apa yang sudah kamu pegang?" },
  { question: "Berapa hasil 111.111.111 × 111.111.111?", answer: "12345678987654321", hint: "Hasilnya membentuk pola palindrom" },
];

// Handler
export default async function handler(leni) {
  const { command, LenwyText, replyJid, normalizedSender, pushname } = leni;

  if (hasSession(replyJid, normalizedSender)) {
    return LenwyText("⚠️ Kamu masih punya sesi game yang aktif! Jawab dulu atau tunggu sampai waktu habis.");
  }

  const item = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
  const correctAnswer = item.answer.toLowerCase().trim();

  const timer = setTimeout(async () => {
    deleteSession(replyJid, normalizedSender);
    addLoss(normalizedSender);
    await LenwyText(
      `⏰ *Waktu Habis!*\n\n` +
      `Jawaban yang benar adalah: *${item.answer}*\n` +
      `Coba lagi dengan *.asahotak*`
    );
  }, 60000);

  setSession(replyJid, normalizedSender, {
    type: "asahotak",
    hint: item.hint,
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
    `🧠 *ASAH OTAK*\n\n` +
    `❓ *Pertanyaan:*\n${item.question}\n\n` +
    `💡 *Hint:* ${item.hint}\n` +
    `⏱️ Waktu: 60 detik\n\n` +
    `Kirim jawabanmu sekarang!`
  );
}
