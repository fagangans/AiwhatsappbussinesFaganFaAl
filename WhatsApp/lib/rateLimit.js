// Rate limiter sederhana per user untuk cegah spam & kurangi risiko ban.
// Mengembalikan: "ok" (boleh), "warn" (kirim 1x peringatan), "blocked" (abaikan diam).

const buckets = new Map(); // userId -> { hits: number[], warnedAt: number }

const extractId = (jid) => (jid || "").split("@")[0].split(":")[0];

export function checkRate(userId, max = 15, windowMs = 60 * 1000) {
  const id = extractId(userId);
  const now = Date.now();

  let b = buckets.get(id) || { hits: [], warnedAt: 0 };
  b.hits = b.hits.filter((t) => now - t < windowMs);

  if (b.hits.length >= max) {
    const shouldWarn = now - b.warnedAt > windowMs;
    if (shouldWarn) b.warnedAt = now;
    buckets.set(id, b);
    return shouldWarn ? "warn" : "blocked";
  }

  b.hits.push(now);
  buckets.set(id, b);
  return "ok";
}
