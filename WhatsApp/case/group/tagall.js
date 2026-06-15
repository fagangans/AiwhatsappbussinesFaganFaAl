// Metadata
export const info = {
  name: "Tag All",

  menu: ["Tagall"],
  case: ["tagall", "everyone"],

  description: "Mention semua anggota grup",
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

    let text = `📢 *${q || "Mention Semua Anggota"}*\n\n`;
    for (const id of members) {
      text += `➤ @${id.split("@")[0].split(":")[0]}\n`;
    }

    await lenwy.sendMessage(replyJid, { text, mentions: members });
  } catch (err) {
    console.error("Tagall Error:", err);
    LenwyText("❌ Gagal. Pastikan ini di grup.");
  }
}
