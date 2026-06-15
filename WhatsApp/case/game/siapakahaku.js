import {
  hasSession,
  setSession,
  deleteSession,
} from "../../lib/gameSession.js";
import { addReward, addLoss, getPlayer } from "../../lib/player.js";

const riddles = [
  {
    answer: "spongebob",
    clues: ["Aku tinggal di bawah laut", "Aku berwarna kuning", "Aku bekerja di Krusty Krab"],
  },
  {
    answer: "matahari",
    clues: ["Aku terbit dari timur", "Aku memberikan cahaya", "Aku adalah bintang terdekat"],
  },
  {
    answer: "buku",
    clues: ["Aku punya banyak halaman", "Aku teman belajar", "Aku ada di perpustakaan"],
  },
  {
    answer: "gajah",
    clues: ["Aku hewan terbesar di darat", "Aku punya belalai", "Aku punya gading"],
  },
  {
    answer: "doraemon",
    clues: ["Aku robot dari masa depan", "Aku berwarna biru", "Aku punya kantong ajaib"],
  },
  {
    answer: "pensil",
    clues: ["Aku digunakan untuk menulis", "Aku bisa dihapus", "Aku terbuat dari kayu dan grafit"],
  },
  {
    answer: "kucing",
    clues: ["Aku hewan peliharaan populer", "Aku suka mengeong", "Aku suka mengejar tikus"],
  },
  {
    answer: "bulan",
    clues: ["Aku terlihat di malam hari", "Aku mengelilingi bumi", "Aku bisa berbentuk sabit"],
  },
  {
    answer: "sepeda",
    clues: ["Aku punya dua roda", "Aku dikayuh dengan kaki", "Aku ramah lingkungan"],
  },
  {
    answer: "api",
    clues: ["Aku bisa menghangatkan", "Aku berwarna merah dan oranye", "Aku bisa membakar"],
  },
  {
    answer: "naruto",
    clues: ["Aku seorang ninja", "Aku bermimpi menjadi Hokage", "Aku punya rubah berekor sembilan"],
  },
  {
    answer: "gitar",
    clues: ["Aku alat musik petik", "Aku punya 6 senar", "Aku sering dimainkan di konser"],
  },
  {
    answer: "hujan",
    clues: ["Aku turun dari langit", "Aku berupa tetesan air", "Aku membuat payung dibutuhkan"],
  },
  {
    answer: "telur",
    clues: ["Aku berbentuk oval", "Aku bisa direbus atau digoreng", "Aku berasal dari ayam"],
  },
  {
    answer: "handphone",
    clues: ["Aku digunakan setiap hari", "Aku punya layar sentuh", "Aku bisa untuk menelepon dan chat"],
  },
  {
    answer: "batman",
    clues: ["Aku superhero yang tidak punya kekuatan super", "Aku tinggal di gua", "Aku memakai jubah hitam"],
  },
  {
    answer: "es krim",
    clues: ["Aku makanan dingin yang manis", "Aku punya banyak rasa", "Aku bisa meleleh jika terlalu lama"],
  },
  {
    answer: "peta",
    clues: ["Aku menunjukkan arah", "Aku menggambarkan daratan dan lautan", "Aku ada di dinding kelas"],
  },
  {
    answer: "mickey mouse",
    clues: ["Aku karakter Disney terkenal", "Aku seekor tikus", "Aku selalu memakai celana merah"],
  },
  {
    answer: "gunung",
    clues: ["Aku sangat tinggi", "Aku bisa meletus jika aktif", "Pendaki suka mendaki diriku"],
  },
  {
    answer: "dokter",
    clues: ["Aku bekerja di rumah sakit", "Aku memakai jas putih", "Aku menyembuhkan orang sakit"],
  },
  {
    answer: "pizza",
    clues: ["Aku makanan dari Italia", "Aku berbentuk bulat", "Aku punya topping keju"],
  },
  {
    answer: "elsa",
    clues: ["Aku seorang putri", "Aku bisa membuat es dan salju", "Aku menyanyi Let It Go"],
  },
  {
    answer: "kamera",
    clues: ["Aku menangkap momen", "Aku punya lensa", "Aku menghasilkan foto"],
  },
];

const rewards = [
  { xp: 40, balance: 90 },  // First clue
  { xp: 30, balance: 70 },  // Second clue
  { xp: 20, balance: 50 },  // Third clue
];

// Metadata
export const info = {
  name: "Siapakah Aku",

  menu: ["Siapakahaku"],
  case: ["siapakahaku"],

  description: "Tebak siapakah aku dari petunjuk yang diberikan!",
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

  const riddle = riddles[Math.floor(Math.random() * riddles.length)];

  // Mutable state shared across closures
  const state = { clueIndex: 0 };

  const timer = setTimeout(async () => {
    deleteSession(replyJid, normalizedSender);
    addLoss(normalizedSender);
    await LenwyText(
      `*Waktu Habis!*\n\n` +
        `Petunjuk yang diberikan:\n` +
        riddle.clues.slice(0, state.clueIndex + 1).map((c, i) => `${i + 1}. ${c}`).join("\n") +
        `\n\nJawaban yang benar: *${riddle.answer}*\n\n` +
        `Sayang sekali, ${pushname}! Coba lagi ya.`,
    );
  }, 90000);

  // Named onAnswer function so it can reference itself when updating session
  async function onAnswer(input, ctx) {
    const answer = input.trim().toLowerCase();
    if (!answer) return false;

    // Handle hint request
    if (answer === ".hint" || answer === "hint") {
      if (state.clueIndex >= riddle.clues.length - 1) {
        await ctx.LenwyText(
          `Tidak ada petunjuk lagi!\n\n` +
            `Semua petunjuk:\n` +
            riddle.clues.map((c, i) => `${i + 1}. ${c}`).join("\n") +
            `\n\nSilakan tebak jawabannya!`,
        );
        return true;
      }

      state.clueIndex += 1;

      // Update session hint for next clue
      const nextHint = state.clueIndex < riddle.clues.length - 1
        ? riddle.clues[state.clueIndex + 1]
        : "Tidak ada petunjuk lagi!";

      setSession(replyJid, normalizedSender, {
        type: "siapakahaku",
        hint: nextHint,
        correctAnswer: riddle.answer,
        timer,
        onAnswer,
      });

      const reward = rewards[state.clueIndex] || rewards[rewards.length - 1];
      await ctx.LenwyText(
        `*Petunjuk ${state.clueIndex + 1}:*\n` +
          `"${riddle.clues[state.clueIndex]}"\n\n` +
          `Semua petunjuk:\n` +
          riddle.clues.slice(0, state.clueIndex + 1).map((c, i) => `${i + 1}. ${c}`).join("\n") +
          `\n\nHadiah berkurang: +${reward.xp} XP | +${reward.balance} Balance\n` +
          (state.clueIndex < riddle.clues.length - 1 ? `Ketik *.hint* untuk petunjuk selanjutnya!` : `Ini petunjuk terakhir!`),
      );
      return true;
    }

    // Check answer
    if (answer === riddle.answer.toLowerCase()) {
      deleteSession(replyJid, normalizedSender);

      const reward = rewards[Math.min(state.clueIndex, rewards.length - 1)];
      const player = addReward(normalizedSender, reward.xp, reward.balance);

      await ctx.LenwyText(
        `*Benar!*\n\n` +
          `Jawaban: *${riddle.answer}*\n` +
          `Petunjuk digunakan: *${state.clueIndex + 1}/${riddle.clues.length}*\n\n` +
          `+${reward.xp} XP | +${reward.balance} Balance\n\n` +
          `*Stats:*\n` +
          `- XP: ${player.xp}\n` +
          `- Balance: ${player.balance}\n` +
          `- Level: ${player.level}`,
      );
    } else {
      // Wrong answer but don't end game
      await ctx.LenwyText(
        `*Bukan!* Itu bukan jawabannya.\n\n` +
          `Petunjuk saat ini:\n` +
          riddle.clues.slice(0, state.clueIndex + 1).map((c, i) => `${i + 1}. ${c}`).join("\n") +
          (state.clueIndex < riddle.clues.length - 1 ? `\n\nKetik *.hint* untuk petunjuk selanjutnya!` : `\n\nIni petunjuk terakhir, coba lagi!`),
      );
    }

    return true;
  }

  setSession(replyJid, normalizedSender, {
    type: "siapakahaku",
    hint: riddle.clues.length > 1 ? riddle.clues[1] : "Tidak ada petunjuk lagi!",
    correctAnswer: riddle.answer,
    timer,
    onAnswer,
  });

  await LenwyText(
    `*SIAPAKAH AKU?*\n\n` +
      `Tebak siapakah aku dari petunjuk berikut!\n\n` +
      `*Petunjuk 1:*\n` +
      `"${riddle.clues[0]}"\n\n` +
      `Waktu: 90 detik\n` +
      `Hadiah: +40 XP | +90 Balance (petunjuk 1)\n\n` +
      `Ketik *.hint* untuk petunjuk selanjutnya (hadiah berkurang)\n` +
      `Ketik jawabanmu langsung untuk menebak!`,
  );
}
