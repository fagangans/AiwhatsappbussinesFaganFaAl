import { getOrCreateCustomer, createTicket } from "../../database/business/db.js";
import { formatPriority } from "../../database/business/helpers.js";

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

const TRIGGER_PHRASES = [
  /\b(mau|ingin|pengen|tolong|bisa|saya|dong|nih|ya|yuk|kak|min|gan|bang|mas|mba|sis)\b/gi,
  /\b(buat|bikin|ajukan|kirim|submit)\b\s*(tiket|keluhan|komplain|laporan|aduan|report)\b/gi,
  /\b(tiket|keluhan|komplain|laporan|aduan|report)\b\s*(dong|ya|nih|kak|min)\b/gi,
  /^(tiket|komplain|keluhan|lapor|report)\s*/i,
];

function extractSubjectFromText(text) {
  let cleaned = text;
  for (const pattern of TRIGGER_PHRASES) {
    cleaned = cleaned.replace(pattern, " ");
  }
  cleaned = cleaned.replace(/[,.:;!]+\s*/g, " ").replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/^[,.:;!\s]+/, "").replace(/[,.:;!\s]+$/, "");
  if (cleaned.length >= 5) return cleaned.slice(0, 200);
  return null;
}

function guessPriority(text) {
  const lower = text.toLowerCase();
  if (/\b(darurat|urgent|segera|cepat|parah|gawat|bahaya|fatal)\b/.test(lower)) return "urgent";
  if (/\b(penting|mendesak|butuh|harus|tolong segera)\b/.test(lower)) return "high";
  return null;
}

function isOffScriptQuestion(text) {
  const t = text.trim();
  if (t.length === 0) return false;
  if (/\?$/.test(t)) return true;
  if (/^(apa|gimana|bagaimana|kenapa|mengapa|kapan|dimana|siapa|kok|emang|maksudnya|jelasin|jelaskan|info|tentang)/i.test(t)) return true;
  return false;
}

function getStepHint(step) {
  if (step === "subject") return "_Btw, kamu lagi buat tiket. Ceritakan masalahnya kalau mau lanjut_ 😊";
  if (step === "description") return "_Btw, kamu lagi nambahin detail tiket. Tulis detailnya atau ketik *tidak* untuk skip_ 😊";
  if (step === "priority") return "_Btw, kamu lagi pilih prioritas tiket. Balas 1-4 atau katanya (rendah/sedang/tinggi/mendesak)_ 😊";
  if (step === "confirm") return "_Btw, kamu lagi konfirmasi tiket. Balas *ya* untuk kirim atau *batal* untuk membatalkan_ 😊";
  return "";
}

export function startTicketFlow(text, ctx) {
  const { senderId, ownerId, botId } = ctx;
  const subject = extractSubjectFromText(text);

  if (subject) {
    const autoPriority = guessPriority(text);
    setState(senderId, { step: "description", subject, ownerId, botId, autoPriority });
    return `Oke, saya bantu buatkan tiket untuk masalah *"${subject}"* ya\n\nAda detail tambahan yang mau ditambahkan? Atau langsung ketik *tidak* kalau info di atas sudah cukup`;
  }

  setState(senderId, { step: "subject", ownerId, botId });
  return "Tentu, saya bantu buatkan tiket ya 😊\n\nCeritain dulu masalahnya apa?";
}

export function continueTicketFlow(text, ctx) {
  const { senderId, ownerId, botId, pushName } = ctx;
  const state = getState(senderId);
  if (!state) return null;

  if (isCancel(text)) {
    clearState(senderId);
    return "Oke, pembuatan tiket dibatalkan. Kalau butuh bantuan lagi, bilang aja ya 😊";
  }

  if (state.step === "subject") {
    if (isOffScriptQuestion(text) && text.trim().length < 30) {
      return { fallthrough: true, hint: getStepHint("subject") };
    }
    const subject = text.trim().slice(0, 200);
    if (subject.length < 3) {
      return "Coba ceritain sedikit lebih detail ya, masalahnya tentang apa?";
    }
    const autoPriority = guessPriority(text);
    setState(senderId, { ...state, step: "description", subject, autoPriority });
    return `Oke dicatat, masalahnya tentang *"${subject}"*\n\nAda info tambahan lagi? Kalau sudah cukup, ketik *tidak*`;
  }

  if (state.step === "description") {
    if (isOffScriptQuestion(text) && !isNo(text) && text.trim().length < 30) {
      return { fallthrough: true, hint: getStepHint("description") };
    }
    const description = isNo(text) ? "" : text.trim().slice(0, 500);
    setState(senderId, { ...state, step: "priority", description });
    return `Seberapa mendesak masalahnya?\n\n1. Rendah — bisa ditangani nanti\n2. Sedang — perlu ditangani\n3. Tinggi — cukup mendesak\n4. Mendesak — butuh penanganan segera\n\nBalas angka atau katanya aja`;
  }

  if (state.step === "priority") {
    const priorityMap = { "1": "low", "2": "medium", "3": "high", "4": "urgent", "rendah": "low", "sedang": "medium", "tinggi": "high", "mendesak": "urgent", "urgent": "urgent", "high": "high", "medium": "medium", "low": "low", "biasa": "medium", "penting": "high" };
    const lower = text.trim().toLowerCase();
    let priority = priorityMap[lower];
    if (!priority) {
      for (const [key, val] of Object.entries(priorityMap)) {
        if (lower.includes(key)) { priority = val; break; }
      }
    }
    if (!priority) {
      if (isOffScriptQuestion(text)) {
        return { fallthrough: true, hint: getStepHint("priority") };
      }
      priority = "medium";
    }

    setState(senderId, { ...state, step: "confirm", priority });
    let confirm = `Ringkasan tiket:\n\n`;
    confirm += `📌 *Masalah:* ${state.subject}\n`;
    if (state.description) confirm += `📝 *Detail:* ${state.description}\n`;
    confirm += `⚡ *Prioritas:* ${formatPriority(priority)}\n`;
    confirm += `\nSudah benar? Balas *ya* untuk kirim, atau *batal* untuk membatalkan`;
    return confirm;
  }

  if (state.step === "confirm") {
    if (isYes(text)) {
      const customer = getOrCreateCustomer(senderId, pushName || "Customer", ownerId, botId);
      const ticket = createTicket(customer.id, state.subject, state.description || "", state.priority || "medium", ownerId, botId);
      clearState(senderId);
      return `Tiket berhasil dibuat! ✅\n\nNo. Tiket: *${ticket.ticket_number}*\nMasalah: ${ticket.subject}\nPrioritas: ${formatPriority(ticket.priority)}\n\nTim kami akan segera menangani ya 😊`;
    }
    if (isNo(text)) {
      clearState(senderId);
      return "Oke, pembuatan tiket dibatalkan. Kalau butuh bantuan lagi, bilang aja ya 😊";
    }
    if (isOffScriptQuestion(text)) {
      return { fallthrough: true, hint: getStepHint("confirm") };
    }
    return "Balas *ya* untuk kirim tiket, atau *batal* untuk membatalkan";
  }

  return { fallthrough: true, hint: getStepHint(state.step) };
}
