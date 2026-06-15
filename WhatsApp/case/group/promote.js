// Metadata
export const info = {
  name: "Promote & Demote",

  menu: ["Promote", "Demote"],
  case: ["promote", "demote"],

  description: "Jadikan/cabut admin anggota (reply pesannya)",
  hidden: false,

  owner: false,
  premium: false,
  group: true,
  private: false,
  admin: true,
  botAdmin: true,

  allowPrivate: false,
};

// Handler
export default async function handler(leni) {
  const { command, lenwy, msg, replyJid, LenwyText } = leni;

  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const mentioned = ctx?.mentionedJid?.[0];
  const replied = ctx?.participant;
  const target = mentioned || replied;

  if (!target)
    return LenwyText(
      `❌ Reply pesan / tag anggota yang ingin di-${command}.`,
    );

  const action = command === "promote" ? "promote" : "demote";
  const label = command === "promote" ? "dijadikan Admin" : "dicabut Adminnya";

  try {
    await lenwy.groupParticipantsUpdate(replyJid, [target], action);
    await lenwy.sendMessage(replyJid, {
      text: `✅ @${target.split("@")[0]} berhasil ${label}.`,
      mentions: [target],
    });
  } catch (err) {
    console.error("Promote/Demote Error:", err);
    LenwyText("⚠️ Gagal. Pastikan bot adalah Admin di grup ini.");
  }
}
