// Metadata
export const info = {
  name: "Pengingat",

  menu: ["Remind"],
  case: ["remind", "reminder", "ingatkan"],

  description: "Bot mengingatkanmu (mis. .remind 30m Minum obat)",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

// Ubah "30m" / "1h" / "10s" / "2d" menjadi milidetik
function parseDuration(str) {
  const m = /^(\d+)(s|m|h|d)$/i.exec(str || "");
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return n * mult[unit];
}

// Handler
export default async function handler(leni) {
  const { args, lenwy, replyJid, normalizedSender, LenwyText } = leni;

  if (args.length < 2)
    return LenwyText(
      "⏰ *Pengingat*\n\n*Contoh:*\n.remind 30m Minum obat\n.remind 2h Meeting kerja\n\n*Satuan:* s (detik), m (menit), h (jam), d (hari)",
    );

  const ms = parseDuration(args[0]);
  if (ms === null)
    return LenwyText("❌ Format waktu salah. Contoh: 30m, 2h, 1d");

  if (ms > 86400000)
    return LenwyText("❌ Maksimal pengingat 1 hari (24 jam).");

  const text = args.slice(1).join(" ");
  const tag = `@${(normalizedSender || "").split("@")[0]}`;

  setTimeout(() => {
    lenwy
      .sendMessage(replyJid, {
        text: `⏰ *PENGINGAT untuk ${tag}*\n\n📌 ${text}`,
        mentions: [normalizedSender],
      })
      .catch(() => {});
  }, ms);

  await LenwyText(
    `✅ *Pengingat diset!*\n\n📌 ${text}\n⏱️ Dalam ${args[0]} dari sekarang.`,
  );
}
