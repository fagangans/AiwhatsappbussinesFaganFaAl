import {
  hasSession,
  setSession,
  deleteSession,
} from "../../lib/gameSession.js";
import { addReward, addLoss, getPlayer } from "../../lib/player.js";

const categories = [
  {
    question: "Sebutkan warna pelangi!",
    answers: ["merah", "jingga", "kuning", "hijau", "biru", "nila", "ungu"],
  },
  {
    question: "Sebutkan planet di tata surya!",
    answers: ["merkurius", "venus", "bumi", "mars", "jupiter", "saturnus", "uranus", "neptunus"],
  },
  {
    question: "Sebutkan hewan berkaki 4!",
    answers: ["kucing", "anjing", "sapi", "kuda", "kambing", "kelinci", "harimau", "singa"],
  },
  {
    question: "Sebutkan buah berwarna merah!",
    answers: ["apel", "strawberry", "semangka", "ceri", "delima", "tomat"],
  },
  {
    question: "Sebutkan alat musik!",
    answers: ["gitar", "piano", "drum", "biola", "seruling", "harmonika", "bass"],
  },
  {
    question: "Sebutkan negara di Asia Tenggara!",
    answers: ["indonesia", "malaysia", "singapura", "thailand", "filipina", "vietnam", "myanmar", "kamboja", "laos", "brunei"],
  },
  {
    question: "Sebutkan bagian tubuh manusia!",
    answers: ["kepala", "tangan", "kaki", "mata", "hidung", "mulut", "telinga", "jari"],
  },
  {
    question: "Sebutkan mata pelajaran di sekolah!",
    answers: ["matematika", "bahasa indonesia", "bahasa inggris", "ipa", "ips", "agama", "olahraga", "seni"],
  },
  {
    question: "Sebutkan sayuran hijau!",
    answers: ["bayam", "kangkung", "brokoli", "selada", "seledri", "kacang panjang", "sawi"],
  },
  {
    question: "Sebutkan hewan yang bisa terbang!",
    answers: ["burung", "kupu-kupu", "lebah", "capung", "kelelawar", "elang", "gagak"],
  },
  {
    question: "Sebutkan alat transportasi darat!",
    answers: ["mobil", "motor", "bus", "kereta", "sepeda", "truk", "bajaj"],
  },
  {
    question: "Sebutkan peralatan dapur!",
    answers: ["panci", "wajan", "pisau", "sendok", "garpu", "piring", "kompor", "spatula"],
  },
  {
    question: "Sebutkan olahraga populer!",
    answers: ["sepak bola", "basket", "bulu tangkis", "tenis", "renang", "voli", "tinju"],
  },
  {
    question: "Sebutkan benda di dalam kelas!",
    answers: ["meja", "kursi", "papan tulis", "penghapus", "spidol", "buku", "tas", "pensil"],
  },
  {
    question: "Sebutkan minuman populer!",
    answers: ["teh", "kopi", "susu", "jus", "air mineral", "es jeruk", "coklat"],
  },
  {
    question: "Sebutkan pakaian yang sering dipakai!",
    answers: ["baju", "celana", "kaos", "jaket", "rok", "kemeja", "sweater"],
  },
];

// Metadata
export const info = {
  name: "Family 100",

  menu: ["Family100"],
  case: ["family100"],

  description: "Tebak semua jawaban dari kategori yang diberikan!",
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

  const category = categories[Math.floor(Math.random() * categories.length)];
  const answers = [...category.answers];
  const found = [];

  const timer = setTimeout(async () => {
    deleteSession(replyJid, normalizedSender);
    addLoss(normalizedSender);

    const missed = answers.filter((a) => !found.includes(a));
    await LenwyText(
      `*Waktu Habis!*\n\n` +
        `Pertanyaan: *${category.question}*\n` +
        `Terjawab: ${found.length}/${answers.length}\n\n` +
        (found.length > 0
          ? found.map((a) => `${a}`).join(", ") + "\n\n"
          : "") +
        `Jawaban yang belum ditemukan:\n` +
        missed.map((a) => `- ${a}`).join("\n") +
        `\n\nSayang sekali, ${pushname}! Coba lagi ya.`,
    );
  }, 120000);

  setSession(replyJid, normalizedSender, {
    type: "family100",
    hint: `Sisa jawaban: ${answers.length - found.length}`,
    correctAnswer: answers.join(", "),
    found,
    answers,
    timer,
    onAnswer: async (input, ctx) => {
      const guess = input.trim().toLowerCase();
      if (!guess) return false;

      const matchIndex = answers.findIndex(
        (a) => a.toLowerCase() === guess && !found.includes(a),
      );

      if (matchIndex === -1) return false;

      found.push(answers[matchIndex]);

      const player = addReward(normalizedSender, 15, 30);

      if (found.length === answers.length) {
        deleteSession(replyJid, normalizedSender);
        const bonusPlayer = addReward(normalizedSender, 50, 100);

        await ctx.LenwyText(
          `*SEMPURNA! Semua Jawaban Ditemukan!*\n\n` +
            `Pertanyaan: *${category.question}*\n` +
            `Terjawab: ${found.length}/${answers.length}\n\n` +
            found.map((a) => `${a}`).join(", ") +
            `\n\n` +
            `*+50 XP Bonus | +100 Balance Bonus*\n\n` +
            `*Stats:*\n` +
            `- XP: ${bonusPlayer.xp}\n` +
            `- Balance: ${bonusPlayer.balance}\n` +
            `- Level: ${bonusPlayer.level}`,
        );
      } else {
        await ctx.LenwyText(
          `*Benar!* "${answers[matchIndex]}"\n\n` +
            `+15 XP | +30 Balance\n\n` +
            `Terjawab: ${found.length}/${answers.length}\n` +
            found.map((a) => `${a}`).join(", ") +
            `\n\nSisa jawaban: ${answers.length - found.length}`,
        );
      }

      return true;
    },
  });

  await LenwyText(
    `*FAMILY 100*\n\n` +
      `${category.question}\n\n` +
      `Jumlah jawaban: *${answers.length}*\n` +
      `Waktu: 120 detik\n` +
      `Hadiah: +15 XP | +30 Balance per jawaban\n` +
      `Bonus: +50 XP | +100 Balance jika semua terjawab!\n\n` +
      `Silakan jawab satu per satu!`,
  );
}
