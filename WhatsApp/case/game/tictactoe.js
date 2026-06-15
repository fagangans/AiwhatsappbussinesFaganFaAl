import {
  hasSession,
  setSession,
  deleteSession,
} from "../../lib/gameSession.js";
import { addReward, addLoss } from "../../lib/player.js";

// Metadata
export const info = {
  name: "TicTacToe",

  menu: ["Tictactoe"],
  case: ["ttt", "tictactoe"],

  description: "Main TicTacToe lawan bot!",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

const EMPTY_NUMS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
const PLAYER_MARK = "❌";
const BOT_MARK = "⭕";

const WIN_COMBOS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function renderBoard(board) {
  const display = board.map((cell, i) => {
    if (cell === "X") return PLAYER_MARK;
    if (cell === "O") return BOT_MARK;
    return EMPTY_NUMS[i];
  });
  return (
    `${display[0]} │ ${display[1]} │ ${display[2]}\n` +
    `──┼──┼──\n` +
    `${display[3]} │ ${display[4]} │ ${display[5]}\n` +
    `──┼──┼──\n` +
    `${display[6]} │ ${display[7]} │ ${display[8]}`
  );
}

function checkWinner(board, mark) {
  return WIN_COMBOS.some(
    ([a, b, c]) => board[a] === mark && board[b] === mark && board[c] === mark,
  );
}

function isDraw(board) {
  return board.every((cell) => cell === "X" || cell === "O");
}

function botMove(board) {
  const empty = board
    .map((cell, i) => (cell === null ? i : -1))
    .filter((i) => i !== -1);

  if (empty.length === 0) return -1;

  // Try to win
  for (const pos of empty) {
    board[pos] = "O";
    if (checkWinner(board, "O")) {
      board[pos] = null;
      return pos;
    }
    board[pos] = null;
  }

  // Try to block
  for (const pos of empty) {
    board[pos] = "X";
    if (checkWinner(board, "X")) {
      board[pos] = null;
      return pos;
    }
    board[pos] = null;
  }

  // Center
  if (empty.includes(4)) return 4;

  // Corners
  const corners = [0, 2, 6, 8].filter((c) => empty.includes(c));
  if (corners.length > 0)
    return corners[Math.floor(Math.random() * corners.length)];

  // Edges
  const edges = [1, 3, 5, 7].filter((e) => empty.includes(e));
  if (edges.length > 0)
    return edges[Math.floor(Math.random() * edges.length)];

  return empty[0];
}

// Handler
export default async function handler(leni) {
  const { LenwyText, replyJid, normalizedSender, pushname } = leni;

  if (hasSession(replyJid, normalizedSender)) {
    return LenwyText(
      "⚠️ Kamu masih punya game TicTacToe yang sedang berjalan!\nKetik angka 1-9 untuk bermain.",
    );
  }

  const board = Array(9).fill(null);

  const timer = setTimeout(async () => {
    deleteSession(replyJid, normalizedSender);
    addLoss(normalizedSender);
    await LenwyText(
      `⏰ *Waktu Habis!*\n\n` +
        `Game TicTacToe berakhir karena timeout.\n` +
        `${pushname} dianggap kalah!`,
    );
  }, 120000);

  setSession(replyJid, normalizedSender, {
    type: "tictactoe",
    hint: "Ketik angka 1-9",
    correctAnswer: null,
    board,
    timer,
    onAnswer: async (input, ctx) => {
      const pos = parseInt(input, 10);
      if (isNaN(pos) || pos < 1 || pos > 9) return false;

      const idx = pos - 1;
      const session = { board };

      // Re-read board from the closure's perspective
      if (board[idx] !== null) {
        await ctx.LenwyText("⚠️ Posisi itu sudah terisi! Pilih posisi lain.");
        return true;
      }

      // Player move
      board[idx] = "X";

      // Check player win
      if (checkWinner(board, "X")) {
        deleteSession(replyJid, normalizedSender);
        const player = addReward(normalizedSender, 100, 200);
        await ctx.LenwyText(
          `${renderBoard(board)}\n\n` +
            `🎉 *${pushname} Menang!*\n\n` +
            `🎁 +100 XP | +200 Balance\n` +
            `📊 XP: ${player.xp} | Balance: ${player.balance} | Level: ${player.level}`,
        );
        return true;
      }

      // Check draw after player move
      if (isDraw(board)) {
        deleteSession(replyJid, normalizedSender);
        const player = addReward(normalizedSender, 50, 50);
        await ctx.LenwyText(
          `${renderBoard(board)}\n\n` +
            `🤝 *Seri!*\n\n` +
            `🎁 +50 XP | +50 Balance\n` +
            `📊 XP: ${player.xp} | Balance: ${player.balance} | Level: ${player.level}`,
        );
        return true;
      }

      // Bot move
      const botIdx = botMove(board);
      if (botIdx !== -1) {
        board[botIdx] = "O";
      }

      // Check bot win
      if (checkWinner(board, "O")) {
        deleteSession(replyJid, normalizedSender);
        addLoss(normalizedSender);
        await ctx.LenwyText(
          `${renderBoard(board)}\n\n` +
            `😔 *Bot Menang!*\n\n` +
            `Jangan menyerah, coba lagi!`,
        );
        return true;
      }

      // Check draw after bot move
      if (isDraw(board)) {
        deleteSession(replyJid, normalizedSender);
        const player = addReward(normalizedSender, 50, 50);
        await ctx.LenwyText(
          `${renderBoard(board)}\n\n` +
            `🤝 *Seri!*\n\n` +
            `🎁 +50 XP | +50 Balance\n` +
            `📊 XP: ${player.xp} | Balance: ${player.balance} | Level: ${player.level}`,
        );
        return true;
      }

      // Game continues
      await ctx.LenwyText(
        `${renderBoard(board)}\n\n` +
          `Giliranmu! Ketik angka 1-9.`,
      );
      return true;
    },
  });

  await LenwyText(
    `🎮 *TICTACTOE*\n\n` +
      `${pushname} (${PLAYER_MARK}) vs Bot (${BOT_MARK})\n\n` +
      `${renderBoard(board)}\n\n` +
      `Ketik angka *1-9* untuk menempatkan tanda.\n` +
      `⏱️ Waktu: 120 detik\n` +
      `💰 Menang: +100 XP, +200 Balance\n` +
      `🤝 Seri: +50 XP, +50 Balance`,
  );
}
