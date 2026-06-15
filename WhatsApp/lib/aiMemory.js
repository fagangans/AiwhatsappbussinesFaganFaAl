// Memori percakapan AI jangka pendek (per user).
// Disimpan di memori (RAM) dengan auto-expire, agar bot "ingat" konteks obrolan.

const memory = new Map(); // userId -> { messages: [{role, text}], lastActive }

const MAX_MESSAGES = 8; // simpan 8 pesan terakhir (~4 giliran tanya-jawab)
const TTL = 30 * 60 * 1000; // reset otomatis setelah 30 menit tidak aktif

const extractId = (jid) => (jid || "").split("@")[0].split(":")[0];

export function getHistory(userId) {
  const id = extractId(userId);
  const m = memory.get(id);
  if (!m) return [];
  if (Date.now() - m.lastActive > TTL) {
    memory.delete(id);
    return [];
  }
  return m.messages;
}

export function addMessage(userId, role, text) {
  const id = extractId(userId);
  let m = memory.get(id);
  if (!m || Date.now() - m.lastActive > TTL) {
    m = { messages: [], lastActive: Date.now() };
  }
  m.messages.push({ role, text });
  if (m.messages.length > MAX_MESSAGES) {
    m.messages = m.messages.slice(-MAX_MESSAGES);
  }
  m.lastActive = Date.now();
  memory.set(id, m);
}

export function clearHistory(userId) {
  memory.delete(extractId(userId));
}
