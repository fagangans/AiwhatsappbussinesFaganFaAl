import {
  getOrCreateCustomer, createTicket, getTicket, updateTicketStatus,
  getCustomerTickets, getAllTickets, getTicketStats,
  addSatisfactionRating,
} from "../../database/business/db.js";
import { formatDate, formatTicketStatus, formatPriority } from "../../database/business/helpers.js";

export const info = {
  name: "Support Ticket",
  menu: ["tiket", "buattiket", "cektiket", "listtiket", "updatetiket", "rating"],
  case: ["tiket", "buattiket", "cektiket", "listtiket", "updatetiket", "tutuptiket", "rating"],
  description: "Sistem tiket support customer",
  hidden: false,
  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,
  allowPrivate: true,
};

export default async function handler(leni) {
  const { command, q, LenwyText, LenwyWait, normalizedSender, isLenwy, m, ownerId, botId } = leni;
  const pushname = m.messages[0].pushName || "Customer";

  switch (command) {
    case "tiket":
    case "buattiket": {
      if (!q) {
        let text = `🎫 *BUAT TIKET SUPPORT*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
        text += `Format:\n`;
        text += `.buattiket [subjek] | [deskripsi] | [prioritas]\n\n`;
        text += `Prioritas: low, medium, high, urgent\n\n`;
        text += `Contoh:\n`;
        text += `.buattiket Produk rusak | Barang yang diterima cacat | high\n\n`;
        text += `Contoh sederhana:\n`;
        text += `.buattiket Produk rusak`;
        await LenwyText(text);
        return;
      }

      await LenwyWait();
      const customer = getOrCreateCustomer(normalizedSender, pushname, ownerId, botId);
      const parts = q.split("|").map(s => s.trim());
      const subject = parts[0];
      const description = parts[1] || "";
      const priority = parts[2] || "medium";

      const validPriorities = ["low", "medium", "high", "urgent"];
      const finalPriority = validPriorities.includes(priority.toLowerCase()) ? priority.toLowerCase() : "medium";

      const ticket = createTicket(customer.id, subject, description, finalPriority, ownerId, botId);

      let text = `✅ *TIKET BERHASIL DIBUAT!*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `*No. Tiket:* ${ticket.ticket_number}\n`;
      text += `*Subjek:* ${ticket.subject}\n`;
      text += `*Prioritas:* ${formatPriority(ticket.priority)}\n`;
      text += `*Status:* ${formatTicketStatus(ticket.status)}\n`;
      text += `*Dibuat:* ${formatDate(ticket.created_at)}\n\n`;
      text += `Tim kami akan segera menangani tiket Anda.\n`;
      text += `_Cek status: .cektiket ${ticket.ticket_number}_`;
      await LenwyText(text);
      break;
    }

    case "cektiket": {
      if (!q) {
        const customer = getOrCreateCustomer(normalizedSender, pushname, ownerId, botId);
        const tickets = getCustomerTickets(customer.id);

        if (tickets.length === 0) {
          await LenwyText("🎫 Anda belum memiliki tiket support");
          return;
        }

        let text = `🎫 *TIKET ANDA*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
        tickets.slice(0, 10).forEach((t, i) => {
          const icon = t.status === "resolved" || t.status === "closed" ? "✅"
            : t.priority === "urgent" ? "🔴"
            : t.priority === "high" ? "🟠" : "🟡";
          text += `${icon} *${t.ticket_number}*\n`;
          text += `   ${t.subject}\n`;
          text += `   ${formatTicketStatus(t.status)} | ${formatPriority(t.priority)}\n`;
          text += `   ${formatDate(t.created_at)}\n\n`;
        });
        text += `_Ketik .cektiket [no.tiket] untuk detail_`;
        await LenwyText(text);
        return;
      }

      const ticket = getTicket(q.toUpperCase(), ownerId);
      if (!ticket) {
        await LenwyText(`❌ Tiket ${q.toUpperCase()} tidak ditemukan`);
        return;
      }

      let text = `🎫 *DETAIL TIKET*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `*No. Tiket:* ${ticket.ticket_number}\n`;
      text += `*Subjek:* ${ticket.subject}\n`;
      text += `*Deskripsi:* ${ticket.description || "-"}\n`;
      text += `*Prioritas:* ${formatPriority(ticket.priority)}\n`;
      text += `*Status:* ${formatTicketStatus(ticket.status)}\n`;
      text += `*Customer:* ${ticket.customer_name}\n`;
      text += `*Agent:* ${ticket.assigned_agent || "Belum ditugaskan"}\n`;
      text += `*Dibuat:* ${formatDate(ticket.created_at)}\n`;
      if (ticket.resolved_at) text += `*Diselesaikan:* ${formatDate(ticket.resolved_at)}\n`;
      if (ticket.resolution) text += `\n*Resolusi:*\n${ticket.resolution}\n`;

      if (ticket.status === "resolved") {
        text += `\n_Puas dengan penyelesaian? Ketik .rating ${ticket.ticket_number} | [1-5] | [feedback]_`;
      }
      await LenwyText(text);
      break;
    }

    case "listtiket": {
      if (!isLenwy) {
        await LenwyText("⚠️ Fitur ini khusus owner");
        return;
      }

      const status = q || null;
      const tickets = getAllTickets(status, 20, ownerId, botId);
      const stats = getTicketStats(ownerId, botId);

      if (tickets.length === 0) {
        await LenwyText("🎫 Tidak ada tiket");
        return;
      }

      let text = `🎫 *DAFTAR TIKET*\n━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `Open: ${stats.open_tickets} | Progress: ${stats.in_progress} | Resolved: ${stats.resolved}\n\n`;

      tickets.forEach((t, i) => {
        const icon = t.priority === "urgent" ? "🔴"
          : t.priority === "high" ? "🟠"
          : t.priority === "medium" ? "🟡" : "🟢";
        text += `${icon} *${t.ticket_number}* - ${t.customer_name}\n`;
        text += `   ${t.subject}\n`;
        text += `   ${formatTicketStatus(t.status)} | ${formatPriority(t.priority)}\n\n`;
      });

      text += `_Filter: .listtiket [open/in_progress/resolved/closed]_`;
      await LenwyText(text);
      break;
    }

    case "updatetiket": {
      if (!isLenwy) {
        await LenwyText("⚠️ Fitur ini khusus owner");
        return;
      }
      if (!q) {
        let text = `🎫 *UPDATE TIKET*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
        text += `Format: .updatetiket [no.tiket] | [status] | [resolusi]\n\n`;
        text += `Status: in_progress, resolved, closed\n\n`;
        text += `Contoh:\n`;
        text += `.updatetiket TKT-00001 | resolved | Produk sudah diganti`;
        await LenwyText(text);
        return;
      }

      const parts = q.split("|").map(s => s.trim());
      const ticketNum = parts[0].toUpperCase();
      const status = parts[1];
      const resolution = parts[2] || "";

      const validStatuses = ["in_progress", "resolved", "closed"];
      if (!validStatuses.includes(status)) {
        await LenwyText(`❌ Status tidak valid. Pilihan: ${validStatuses.join(", ")}`);
        return;
      }

      const ticket = getTicket(ticketNum, ownerId);
      if (!ticket) {
        await LenwyText(`❌ Tiket ${ticketNum} tidak ditemukan`);
        return;
      }

      updateTicketStatus(ticketNum, status, resolution);
      await LenwyText(`✅ Tiket *${ticketNum}* status diperbarui: *${formatTicketStatus(status)}*${resolution ? `\nResolusi: ${resolution}` : ""}`);
      break;
    }

    case "tutuptiket": {
      if (!q) {
        await LenwyText("🎫 Ketik .tutuptiket [no.tiket]");
        return;
      }

      const ticket = getTicket(q.toUpperCase(), ownerId);
      if (!ticket) {
        await LenwyText(`❌ Tiket ${q.toUpperCase()} tidak ditemukan`);
        return;
      }

      if (!isLenwy) {
        const customer = getOrCreateCustomer(normalizedSender, pushname, ownerId, botId);
        if (ticket.customer_id !== customer.id) {
          await LenwyText("❌ Anda tidak bisa menutup tiket orang lain");
          return;
        }
      }

      updateTicketStatus(q.toUpperCase(), "closed");
      await LenwyText(`✅ Tiket *${q.toUpperCase()}* ditutup`);
      break;
    }

    case "rating": {
      if (!q) {
        await LenwyText("⭐ Format: .rating [no.tiket] | [1-5] | [feedback]\n\nContoh: .rating TKT-00001 | 5 | Pelayanan sangat baik!");
        return;
      }

      const parts = q.split("|").map(s => s.trim());
      const ticketNum = parts[0].toUpperCase();
      const rating = parseInt(parts[1]);
      const feedback = parts[2] || "";

      if (isNaN(rating) || rating < 1 || rating > 5) {
        await LenwyText("❌ Rating harus antara 1-5");
        return;
      }

      const ticket = getTicket(ticketNum, ownerId);
      if (!ticket) {
        await LenwyText(`❌ Tiket ${ticketNum} tidak ditemukan`);
        return;
      }

      const customer = getOrCreateCustomer(normalizedSender, pushname, ownerId, botId);
      addSatisfactionRating(customer.id, rating, feedback, ticket.id);

      const stars = "⭐".repeat(rating) + "☆".repeat(5 - rating);
      await LenwyText(`✅ Terima kasih atas feedback Anda!\n\n${stars} (${rating}/5)\n${feedback ? `Feedback: ${feedback}` : ""}`);
      break;
    }
  }
}
