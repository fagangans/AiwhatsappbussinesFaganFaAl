import {
  addAgent, getAgent, getAllAgents, updateAgentStatus,
} from "../../database/business/db.js";

export const info = {
  name: "Agent Management",
  menu: ["agent", "addagent", "listagent"],
  case: ["agent", "addagent", "listagent", "delagent", "onlineagent", "offlineagent"],
  description: "Manajemen agent customer service",
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
  const { command, q, LenwyText, isLenwy } = leni;

  switch (command) {
    case "agent":
    case "listagent": {
      const agents = getAllAgents();
      if (agents.length === 0) {
        await LenwyText("👨‍💼 Belum ada agent terdaftar. Tambah dengan .addagent");
        return;
      }

      let text = `👨‍💼 *DAFTAR AGENT CS*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      agents.forEach((a, i) => {
        const statusIcon = a.is_online ? "🟢" : "🔴";
        text += `${statusIcon} *${a.name}* [${a.role}]\n`;
        text += `   📱 ${a.jid.split("@")[0]}\n`;
        text += `   Chat aktif: ${a.active_chats} | Total: ${a.total_handled}\n`;
        text += `   Rating: ${a.rating_avg ? a.rating_avg.toFixed(1) + "/5" : "-"}\n\n`;
      });
      await LenwyText(text);
      break;
    }

    case "addagent": {
      if (!q) {
        await LenwyText("👨‍💼 Format: .addagent [nomor] | [nama] | [role]\n\nRole: agent, supervisor, admin\n\nContoh: .addagent 628123456789 | Budi | agent");
        return;
      }

      const parts = q.split("|").map(s => s.trim());
      if (parts.length < 2) {
        await LenwyText("❌ Format: .addagent [nomor] | [nama]");
        return;
      }

      const phone = parts[0].replace(/[^0-9]/g, "");
      const jid = phone + "@s.whatsapp.net";
      const name = parts[1];
      const role = parts[2] || "agent";

      const agent = addAgent(jid, name, role);
      await LenwyText(`✅ Agent berhasil ditambahkan!\n\nNama: ${name}\nNomor: ${phone}\nRole: ${role}`);
      break;
    }

    case "delagent": {
      if (!q) {
        await LenwyText("🗑️ Ketik .delagent [nomor]");
        return;
      }
      const phone = q.replace(/[^0-9]/g, "");
      const jid = phone + "@s.whatsapp.net";
      const { default: db } = await import("../../database/business/db.js");
      db.prepare("DELETE FROM agents WHERE jid = ?").run(jid);
      await LenwyText(`✅ Agent ${phone} berhasil dihapus`);
      break;
    }

    case "onlineagent": {
      if (!q) {
        await LenwyText("🟢 Ketik .onlineagent [nomor]");
        return;
      }
      const phone = q.replace(/[^0-9]/g, "");
      const jid = phone + "@s.whatsapp.net";
      updateAgentStatus(jid, true);
      await LenwyText(`🟢 Agent ${phone} status: Online`);
      break;
    }

    case "offlineagent": {
      if (!q) {
        await LenwyText("🔴 Ketik .offlineagent [nomor]");
        return;
      }
      const phone = q.replace(/[^0-9]/g, "");
      const jid = phone + "@s.whatsapp.net";
      updateAgentStatus(jid, false);
      await LenwyText(`🔴 Agent ${phone} status: Offline`);
      break;
    }
  }
}
