import fs from "fs";
import path from "path";

const DB_PATH = path.join(
  process.cwd(),
  "WhatsApp",
  "database",
  "cs",
  "followups.json",
);

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return [];
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// chatId = JID tujuan kirim pesan follow-up (chat tempat percakapan order berlangsung)
// customerId = JID ternormalisasi milik pelanggan (dipakai untuk cancel/dedupe)
export function scheduleFollowUp({
  chatId,
  customerId,
  customerName,
  product,
  reason,
  delayMs,
}) {
  const list = load();
  // Hapus follow-up lama yang belum terkirim untuk pelanggan & produk yang sama agar tidak dobel
  const filtered = list.filter(
    (f) => !(f.customerId === customerId && f.product === product && !f.sent),
  );
  const id = list.length ? Math.max(...list.map((f) => f.id || 0)) + 1 : 1;
  filtered.push({
    id,
    chatId,
    customerId,
    customerName,
    product,
    reason,
    sendAt: Date.now() + delayMs,
    sent: false,
    createdAt: Date.now(),
  });
  save(filtered);
}

export function getDueFollowUps() {
  const now = Date.now();
  return load().filter((f) => !f.sent && f.sendAt <= now);
}

export function markSent(id) {
  const list = load();
  const item = list.find((f) => f.id === id);
  if (item) item.sent = true;
  save(list);
}

// Batalkan semua follow-up yang belum terkirim milik pelanggan (mis. setelah dia berhasil order)
export function cancelFollowUps(customerId) {
  const list = load().filter((f) => !(f.customerId === customerId && !f.sent));
  save(list);
}
