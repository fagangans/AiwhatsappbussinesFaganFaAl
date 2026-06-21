import { getOrCreateCustomer, createTicket } from "../../database/business/db.js";
import { formatPriority, formatTicketStatus, formatDate } from "../../database/business/helpers.js";

const ticketFlowState = new Map();
const FLOW_TTL = 10 * 60 * 1000;

function getState(senderId) {
  const entry = ticketFlowState.get(senderId);
  if (!entry) return null;
  if (Date.now() - entry.updatedAt > FLOW_TTL) {
    ticketFlowState.delete(senderId);
    return null;
  }
  return entry;
}

function setState(senderId, data) {
  ticketFlowState.set(senderId, { ...data, updatedAt: Date.now() });
}

function clearState(senderId) {
  ticketFlowState.delete(senderId);
}

export function hasActiveTicketFlow(senderId) {
  return !!getState(senderId);
}

function isCancel(text) {
  return /^(batal|cancel|gak jadi|nggak jadi|tidak jadi|stop)\b/i.test(text.trim());
}

function isYes(text) {
  return /^(ya|iya|y|ok|oke|okay|yes|benar|betul|lanjut|setuju|gas)\b/i.test(text.trim());
}

function isNo(text) {
  return /^(tidak|gak|nggak|enggak|no|nope|skip)\b/i.test(text.trim());
}

function extractSubjectFromText(text) {
  const cleaned = text.replace(/\b(mau|ingin|pengen|tolong|bisa|saya|dong|nih|ya|buat|bikin|ajukan|kirim)\b\s*(tiket|keluhan|komplain|laporan|aduan|report)\b/gi, "").trim();
  if (cleaned.length > 5) return cleaned.slice(0, 200);
  return null;
}

export function startTicketFlow(text, ctx) {
  const { senderId, ownerId, botId } = ctx;
  const subject = extractSubjectFromText(text);
  if (subject) {
    setState(senderId, { step: "description", subject, ownerId, botId });
    return `Oke, saya catat keluhannya tentang *"${subject}"*.\n\nBisa jelaskan lebih detail masalahnya? Atau ketik *tidak* kalau sudah cukup.`;
  }
  setState(senderId, { step: "subject", ownerId, botId });
  return "Tentu, saya bantu buatkan tiket support ya. Ceritakan dulu masalahnya apa?";
}

export function continueTicketFlow(text, ctx) {
  const { senderId, ownerId, botId, pushName } = ctx;
  const state = getState(senderId);
  if (!state) return null;

  if (isCancel(text)) {
    clearState(senderId);
    return "Oke, pembuatan tiket dibatalkan. Kalau butuh bantuan lagi, bilang aja ya! 😊";
  }

  if (state.step === "subject") {
    const subject = text.trim().slice(0, 200);
    if (subject.length < 3) {
      return "Coba jelaskan sedikit lebih detail ya, masalahnya tentang apa?";
    }
    setState(senderId, { ...state, step: "description", subject });
    return `Oke, saya catat *"${subject}"*.\n\nAda detail tambahan yang mau ditambahkan? Atau ketik *tidak* kalau sudah cukup.`;
  }

  if (state.step === "description") {
    const description = isNo(text) ? "" : text.trim().slice(0, 500);
    setState(senderId, { ...state, step: "priority", description });
    return "Seberapa mendesak masalahnya?\n\n1. Rendah — bisa ditangani nanti\n2. Sedang — perlu ditangani\n3. Tinggi — cukup mendesak\n4. Mendesak — butuh penanganan segera\n\nBalas angka atau nama prioritasnya.";
  }

  if (state.step === "priority") {
    const priorityMap = { "1": "low", "2": "medium", "3": "high", "4": "urgent", "rendah": "low", "sedang": "medium", "tinggi": "high", "mendesak": "urgent", "urgent": "urgent", "high": "high", "medium": "medium", "low": "low" };
    const priority = priorityMap[text.trim().toLowerCase()] || "medium";
    setState(senderId, { ...state, step: "confirm", priority });
    let confirm = `Ringkasan tiket:\n\n`;
    confirm += `📌 *Masalah:* ${state.subject}\n`;
    if (state.description) confirm += `📝 *Detail:* ${state.description}\n`;
    confirm += `⚡ *Prioritas:* ${formatPriority(priority)}\n`;
    confirm += `\nSudah benar? Balas *ya* untuk kirim, atau *batal* untuk membatalkan.`;
    return confirm;
  }

  if (state.step === "confirm") {
    if (isYes(text)) {
      const customer = getOrCreateCustomer(senderId, pushName || "Customer", ownerId, botId);
      const ticket = createTicket(customer.id, state.subject, state.description || "", state.priority || "medium", ownerId, botId);
      clearState(senderId);
      return `Tiket berhasil dibuat! ✅\n\nNo. Tiket: *${ticket.ticket_number}*\nMasalah: ${ticket.subject}\nPrioritas: ${formatPriority(ticket.priority)}\n\nTim kami akan segera menangani ya. Kalau mau cek statusnya, tinggal bilang aja "cek tiket saya". 😊`;
    }
    if (isNo(text)) {
      clearState(senderId);
      return "Oke, pembuatan tiket dibatalkan. Kalau butuh bantuan lagi, bilang aja ya! 😊";
    }
    return "Balas *ya* untuk kirim tiket, atau *batal* untuk membatalkan.";
  }

  clearState(senderId);
  return null;
}
