// Metadata
export const info = {
  name: "Game Menu",

  menu: ["Gamemenu"],
  case: ["gamemenu", "games", "listgame"],

  description: "Tampilkan daftar semua game yang tersedia",
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
  const { LenwyText } = leni;

  const text =
    `🎮 *GAME MENU*\n` +
    `Mainkan game seru dan kumpulkan XP & Balance!\n\n` +
    `*[ KUIS & TEKA-TEKI ]*\n` +
    `➤ .math — Kuis matematika (+50 XP)\n` +
    `➤ .tebakkata — Tebak kata dari deskripsi (+30 XP)\n` +
    `➤ .tekateki — Teka-teki klasik Indonesia (+35 XP)\n` +
    `➤ .asahotak — Pertanyaan logika menjebak (+40 XP)\n` +
    `➤ .caklontong — Kuis absurd ala Cak Lontong (+40 XP)\n` +
    `➤ .susunkata — Susun huruf acak jadi kata (+35 XP)\n\n` +
    `*[ MULTIPLAYER & STRATEGI ]*\n` +
    `➤ .tictactoe — TicTacToe lawan bot (+100 XP)\n` +
    `➤ .suit — Batu gunting kertas (+25 XP)\n` +
    `➤ .sambungkata — Sambung kata berantai (+20 XP/kata)\n\n` +
    `*[ TEBAK-TEBAKAN ]*\n` +
    `➤ .siapakahaku — Tebak dari 3 petunjuk (+50-100 XP)\n` +
    `➤ .family100 — Tebak semua jawaban (+15 XP/jawaban)\n\n` +
    `*[ HIBURAN ]*\n` +
    `➤ .truth — Pertanyaan truth\n` +
    `➤ .dare — Tantangan dare\n\n` +
    `*[ SELAMA BERMAIN ]*\n` +
    `➤ .hint — Minta petunjuk\n` +
    `➤ .nyerah — Menyerah dari game\n\n` +
    `*[ PROFIL ]*\n` +
    `➤ .profile — Lihat XP, level, balance\n` +
    `➤ .leaderboard — Top 10 pemain\n\n` +
    `🏆 Menangkan game untuk naik level!`;

  await LenwyText(text);
}
