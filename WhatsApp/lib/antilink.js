// Penyimpanan status Anti-Link per grup (persisten ke JSON).
// Bila aktif, pesan berisi link grup WhatsApp dari anggota biasa akan dihapus.

import fs from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "WhatsApp", "database", "system");
const FILE = path.join(DIR, "antilink.json");

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "[]");

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function isAntilink(jid) {
  return load().includes(jid);
}

export function setAntilink(jid, on) {
  let d = load();
  if (on) {
    if (!d.includes(jid)) d.push(jid);
  } else {
    d = d.filter((g) => g !== jid);
  }
  save(d);
  return on;
}

// Deteksi link grup WhatsApp (yang paling sering dipakai untuk spam undangan).
export function containsGroupLink(text) {
  return /chat\.whatsapp\.com\/[A-Za-z0-9]+/i.test(text || "");
}
