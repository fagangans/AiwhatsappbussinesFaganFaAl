// Metadata
export const info = {
  name: "Hide Tag",

  menu: ["Hidetag"],
  case: ["hidetag", "h"],

  description: "Mention semua anggota tanpa menampilkan tag",
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
  const { q, lenwy, replyJid, LenwyText } = leni;

  try {
    const metadata = await lenwy.groupMetadata(replyJid);
    const members = metadata.participants.map((p) => p.id);

    await lenwy.sendMessage(replyJid, {
      text: q || "📢 Perhatian semua!",
      mentions: members,
    });
  } catch (err) {
    console.error("Hidetag Error:", err);
    LenwyText("❌ Gagal. Pastikan ini di grup.");
  }
}
