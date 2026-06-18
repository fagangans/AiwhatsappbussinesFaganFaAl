import { getProfile, updateProfile } from "../../database/business/db.js";
import { formatCurrency } from "../../database/business/helpers.js";

export const info = {
  name: "Business Profile",
  menu: ["bisnisprofil", "setbisnis"],
  case: ["bisnisprofil", "setbisnis", "setprofile", "businessinfo"],
  description: "Lihat & atur profil bisnis",
  hidden: false,
  owner: true,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,
  allowPrivate: true,
};

export default async function handler(leni) {
  const { command, q, LenwyText, LenwyWait } = leni;

  switch (command) {
    case "bisnisprofil":
    case "businessinfo": {
      const p = getProfile();
      let text = `🏢 *PROFIL BISNIS*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `*Nama:* ${p.name || "Belum diatur"}\n`;
      text += `*Deskripsi:* ${p.description || "-"}\n`;
      text += `*Kategori:* ${p.category || "-"}\n`;
      text += `*Alamat:* ${p.address || "-"}\n`;
      text += `*Email:* ${p.email || "-"}\n`;
      text += `*Telepon:* ${p.phone || "-"}\n`;
      text += `*Website:* ${p.website || "-"}\n\n`;
      text += `*Jam Operasional:* ${String(p.open_hour).padStart(2, "0")}:00 - ${String(p.close_hour).padStart(2, "0")}:00\n`;
      text += `*Auto Reply:* ${p.auto_reply_enabled ? "Aktif" : "Nonaktif"}\n`;
      text += `*AI CS:* ${p.ai_enabled ? "Aktif" : "Nonaktif"}\n\n`;
      text += `*Welcome Message:*\n${p.welcome_message}\n\n`;
      text += `*Away Message:*\n${p.away_message}\n\n`;
      text += `_Gunakan .setbisnis untuk mengatur_`;
      await LenwyText(text);
      break;
    }

    case "setbisnis":
    case "setprofile": {
      if (!q) {
        let text = `⚙️ *ATUR PROFIL BISNIS*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
        text += `Gunakan format:\n`;
        text += `.setbisnis nama | [Nama Bisnis]\n`;
        text += `.setbisnis deskripsi | [Deskripsi]\n`;
        text += `.setbisnis alamat | [Alamat]\n`;
        text += `.setbisnis email | [Email]\n`;
        text += `.setbisnis telepon | [No Telepon]\n`;
        text += `.setbisnis website | [URL Website]\n`;
        text += `.setbisnis kategori | [Kategori]\n`;
        text += `.setbisnis jam | [buka]-[tutup]\n`;
        text += `.setbisnis welcome | [Pesan Welcome]\n`;
        text += `.setbisnis away | [Pesan Away]\n`;
        text += `.setbisnis autoreply | on/off\n`;
        text += `.setbisnis ai | on/off\n`;
        await LenwyText(text);
        return;
      }

      const [key, ...valueParts] = q.split("|").map(s => s.trim());
      const value = valueParts.join("|").trim();

      if (!value) {
        await LenwyText("❌ Format: .setbisnis [field] | [value]");
        return;
      }

      const fieldMap = {
        nama: "name",
        name: "name",
        deskripsi: "description",
        description: "description",
        alamat: "address",
        address: "address",
        email: "email",
        telepon: "phone",
        phone: "phone",
        website: "website",
        kategori: "category",
        category: "category",
      };

      if (key.toLowerCase() === "jam") {
        const [open, close] = value.split("-").map(v => parseInt(v.trim()));
        if (isNaN(open) || isNaN(close) || open < 0 || close > 24) {
          await LenwyText("❌ Format jam: .setbisnis jam | 8-21");
          return;
        }
        updateProfile({ open_hour: open, close_hour: close });
        await LenwyText(`✅ Jam operasional diatur: ${String(open).padStart(2, "0")}:00 - ${String(close).padStart(2, "0")}:00`);
        return;
      }

      if (key.toLowerCase() === "welcome") {
        updateProfile({ welcome_message: value });
        await LenwyText(`✅ Welcome message diperbarui`);
        return;
      }

      if (key.toLowerCase() === "away") {
        updateProfile({ away_message: value });
        await LenwyText(`✅ Away message diperbarui`);
        return;
      }

      if (key.toLowerCase() === "autoreply") {
        const enabled = value.toLowerCase() === "on" ? 1 : 0;
        updateProfile({ auto_reply_enabled: enabled });
        await LenwyText(`✅ Auto Reply: ${enabled ? "Aktif" : "Nonaktif"}`);
        return;
      }

      if (key.toLowerCase() === "ai") {
        const enabled = value.toLowerCase() === "on" ? 1 : 0;
        updateProfile({ ai_enabled: enabled });
        await LenwyText(`✅ AI Customer Service: ${enabled ? "Aktif" : "Nonaktif"}`);
        return;
      }

      const dbField = fieldMap[key.toLowerCase()];
      if (!dbField) {
        await LenwyText("❌ Field tidak dikenali. Gunakan: nama, deskripsi, alamat, email, telepon, website, kategori, jam, welcome, away, autoreply, ai");
        return;
      }

      updateProfile({ [dbField]: value });
      await LenwyText(`✅ ${key} berhasil diperbarui menjadi: ${value}`);
      break;
    }
  }
}
