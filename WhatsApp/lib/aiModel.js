// Preferensi model AI per user (persistent ke JSON).
// User bisa pilih mau pakai model AI yang mana lewat perintah .aimodel

import fs from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "WhatsApp", "database", "system");
const FILE = path.join(DIR, "aimodel.json");

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "{}");

const extractId = (jid) => (jid || "").split("@")[0].split(":")[0];

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// Model yang tersedia: "default" (Ai4Chat/scraper lama), "gemini-flash", "gemini-pro"
const VALID = ["default", "gemini-flash", "gemini-pro"];

export function getModel(userId) {
  const id = extractId(userId);
  const db = load();
  return db[id] || "gemini-flash";
}

export function setModel(userId, model) {
  if (!VALID.includes(model)) return false;
  const db = load();
  db[extractId(userId)] = model;
  save(db);
  return true;
}

export function getValidModels() {
  return VALID;
}
