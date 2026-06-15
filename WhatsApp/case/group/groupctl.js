// Metadata
export const info = {
  name: "Buka/Tutup Grup",

  menu: ["Open", "Close"],
  case: ["open", "close", "buka", "tutup"],

  description: "Atur siapa yang bisa kirim pesan di grup",
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
  const { command, lenwy, replyJid, LenwyText } = leni;

  const isOpen = command === "open" || command === "buka";
  const setting = isOpen ? "not_announcement" : "announcement";

  try {
    await lenwy.groupSettingUpdate(replyJid, setting);
    await LenwyText(
      isOpen
        ? "🔓 *Grup Dibuka.* Semua anggota bisa kirim pesan."
        : "🔒 *Grup Ditutup.* Hanya Admin yang bisa kirim pesan.",
    );
  } catch (err) {
    console.error("GroupCtl Error:", err);
    LenwyText("⚠️ Gagal. Pastikan bot adalah Admin di grup ini.");
  }
}
