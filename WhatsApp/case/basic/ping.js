// Metadata
export const info = {
  name: "Ping",

  menu: ["Ping"],
  case: ["ping"],

  description: "Cek status & kecepatan bot",
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

  const start = Date.now();
  const uptime = process.uptime();
  const jam = Math.floor(uptime / 3600);
  const menit = Math.floor((uptime % 3600) / 60);
  const detik = Math.floor(uptime % 60);

  const speed = Date.now() - start;

  await LenwyText(
    `🏓 *Pong!*\n\n` +
      `⚡ *Speed:* ${speed} ms\n` +
      `🕒 *Uptime:* ${jam}j ${menit}m ${detik}d\n` +
      `✅ *Status:* Bot Aktif`,
  );
}
