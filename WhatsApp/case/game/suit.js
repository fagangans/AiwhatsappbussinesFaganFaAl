import { addReward, addLoss } from "../../lib/player.js";

// Metadata
export const info = {
  name: "Suit",

  menu: ["Suit"],
  case: ["suit", "rps"],

  description: "Main suit (batu gunting kertas) lawan bot!",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

const CHOICES = {
  batu: { emoji: "✊", beats: "gunting" },
  gunting: { emoji: "✌", beats: "kertas" },
  kertas: { emoji: "🖐", beats: "batu" },
};

const CHOICE_KEYS = Object.keys(CHOICES);

// Handler
export default async function handler(leni) {
  const { q, LenwyText, normalizedSender, pushname } = leni;

  const input = (q || "").toLowerCase().trim();

  if (!input || !CHOICES[input]) {
    return LenwyText(
      `✊✌🖐 *SUIT (Rock Paper Scissors)*\n\n` +
        `Cara bermain:\n` +
        `• .suit batu\n` +
        `• .suit gunting\n` +
        `• .suit kertas\n\n` +
        `Contoh: *.suit batu*`,
    );
  }

  const playerChoice = input;
  const botChoice = CHOICE_KEYS[Math.floor(Math.random() * CHOICE_KEYS.length)];

  const playerEmoji = CHOICES[playerChoice].emoji;
  const botEmoji = CHOICES[botChoice].emoji;

  let resultText;

  if (playerChoice === botChoice) {
    // Draw
    addReward(normalizedSender, 5, 0);
    resultText =
      `🤝 *Seri!*\n\n` +
      `${pushname}: ${playerEmoji} ${playerChoice}\n` +
      `Bot: ${botEmoji} ${botChoice}\n\n` +
      `🎁 +5 XP`;
  } else if (CHOICES[playerChoice].beats === botChoice) {
    // Player wins
    const player = addReward(normalizedSender, 25, 50);
    resultText =
      `🎉 *${pushname} Menang!*\n\n` +
      `${pushname}: ${playerEmoji} ${playerChoice}\n` +
      `Bot: ${botEmoji} ${botChoice}\n\n` +
      `🎁 +25 XP | +50 Balance\n` +
      `📊 XP: ${player.xp} | Balance: ${player.balance} | Level: ${player.level}`;
  } else {
    // Bot wins
    addLoss(normalizedSender);
    resultText =
      `😔 *Bot Menang!*\n\n` +
      `${pushname}: ${playerEmoji} ${playerChoice}\n` +
      `Bot: ${botEmoji} ${botChoice}\n\n` +
      `Coba lagi ya!`;
  }

  await LenwyText(`✊✌🖐 *SUIT*\n\n${resultText}`);
}
