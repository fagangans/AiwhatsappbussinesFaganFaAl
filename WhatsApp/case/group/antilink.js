import { isAntilink, setAntilink } from "../../lib/antilink.js";

// Metadata
export const info = {
  name: "Anti Link",

  menu: ["Antilink"],
  case: ["antilink"],

  description: "Hapus otomatis link grup WA dari anggota (.antilink on/off)",
  hidden: false,

  owner: false,
  premium: false,
  group: true,
  private: false,
  admin: true,
  botAdmin: false,

  allowPrivate: false,
};

// Handler
export default async function handler(leni) {
  const { q, replyJid, LenwyText } = leni;

  const arg = (q || "").trim().toLowerCase();

  if (arg !== "on" && arg !== "off") {
    const status = isAntilink(replyJid) ? "AKTIF 🟢" : "NONAKTIF 🔴";
    return LenwyText(
      `🛡️ *Anti-Link*\n\nStatus saat ini: *${status}*\n\nGunakan:\n.antilink on\n.antilink off`,
    );
  }

  setAntilink(replyJid, arg === "on");
  await LenwyText(
    arg === "on"
      ? "🛡️ *Anti-Link AKTIF.* Link grup WA dari anggota biasa akan dihapus."
      : "🛡️ *Anti-Link NONAKTIF.*",
  );
}
