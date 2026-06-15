// Metadata
export const info = {
  name: "Truth or Dare",

  menu: ["Truth", "Dare"],
  case: ["truth", "dare"],

  description: "Main Truth or Dare! Pilih truth atau dare.",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

const TRUTHS = [
  "Siapa orang yang paling sering kamu stalking di media sosial?",
  "Apa rahasia terbesar yang belum pernah kamu ceritakan ke siapapun?",
  "Siapa crush pertamamu dan apakah dia tahu?",
  "Apa hal paling memalukan yang pernah kamu lakukan di depan umum?",
  "Pernahkah kamu berbohong ke sahabatmu? Tentang apa?",
  "Apa kebiasaan aneh yang kamu lakukan saat sendirian?",
  "Siapa orang di grup ini yang menurutmu paling menarik?",
  "Apa hal yang paling kamu sesali dalam hidupmu?",
  "Pernahkah kamu membaca chat pribadi orang lain tanpa izin?",
  "Apa ketakutan terbesarmu yang tidak diketahui orang lain?",
  "Siapa mantanmu yang paling susah kamu lupakan?",
  "Apa kebohongan terbesar yang pernah kamu katakan ke orang tua?",
  "Kalau bisa menghapus satu memori, memori apa yang akan kamu hapus?",
  "Apa hal paling childish yang masih kamu lakukan sampai sekarang?",
  "Pernahkah kamu nangis gara-gara film atau lagu? Yang mana?",
  "Siapa orang yang diam-diam kamu iri dengannya? Kenapa?",
  "Apa impian terpendam yang belum pernah kamu ceritakan?",
  "Kalau harus jujur ke satu orang, siapa dan tentang apa?",
  "Apa hal terjahat yang pernah kamu pikirkan tentang seseorang?",
  "Pernahkah kamu pura-pura sakit untuk menghindari sesuatu?",
  "Apa password WiFi kamu dan kenapa memilih itu?",
  "Siapa orang terakhir yang kamu lihat profilnya sebelum tidur?",
  "Apa hal paling bodoh yang pernah kamu lakukan demi cinta?",
  "Kalau bisa tukar hidup dengan seseorang selama sehari, siapa?",
  "Apa guilty pleasure terbesarmu?",
];

const DARES = [
  "Kirim voice note bernyanyi lagu anak-anak sekarang!",
  "Ganti foto profil WA kamu jadi selfie jelek selama 1 jam!",
  "Kirim chat 'aku kangen kamu' ke kontak terakhir yang kamu chat!",
  "Buat status WA yang memalukan dan biarkan selama 30 menit!",
  "Kirim voice note ketawa selama 15 detik penuh!",
  "Screenshot isi chat terakhirmu dan kirim ke grup ini!",
  "Tulis puisi romantis untuk orang di sebelahmu dan kirim di sini!",
  "Telepon orang random di kontak dan bilang 'aku sayang kamu'!",
  "Kirim emoji hati ke 3 kontak terakhir yang kamu chat!",
  "Buat pantun tentang dirimu sendiri dan kirim di sini!",
  "Ceritakan pengalaman paling memalukan dengan voice note!",
  "Kirim foto selfie tanpa filter sekarang juga!",
  "Tulis nama crushmu di sini sekarang!",
  "Ganti nama WA kamu jadi 'Si Paling Ganteng/Cantik' selama 1 jam!",
  "Kirim chat 'kapan kita jalan?' ke crush kamu sekarang!",
  "Buat video 10 detik joget dan kirim di sini!",
  "Kirim stiker paling aneh yang kamu punya 5 kali berturut-turut!",
  "Reply story orang terakhir dengan pujian berlebihan!",
  "Kirim voice note membaca pesan ini dengan gaya reporter berita!",
  "Screenshot battery HP kamu dan kirim di sini!",
  "Kirim pesan 'miss you' ke orang yang sudah lama tidak kamu hubungi!",
  "Tulis 3 hal yang kamu suka dari orang yang mengirimmu dare ini!",
  "Ganti bio WA kamu jadi 'budak cinta' selama 1 jam!",
  "Kirim foto galeri ke-7 dari kamera roll kamu!",
  "Buat lelucon dan kirim di sini, harus bikin orang ketawa!",
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Handler
export default async function handler(leni) {
  const { command, LenwyText, pushname } = leni;

  switch (command) {
    case "truth": {
      const question = pickRandom(TRUTHS);
      await LenwyText(
        `🤔 *TRUTH*\n\n` +
          `Hai ${pushname}, jawab dengan jujur ya!\n\n` +
          `❓ ${question}`,
      );
      break;
    }

    case "dare": {
      const challenge = pickRandom(DARES);
      await LenwyText(
        `🔥 *DARE*\n\n` +
          `Hai ${pushname}, kamu harus melakukan ini!\n\n` +
          `💪 ${challenge}`,
      );
      break;
    }
  }
}
