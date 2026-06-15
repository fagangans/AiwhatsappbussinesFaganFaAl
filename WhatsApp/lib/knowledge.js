// Basis pengetahuan (knowledge base) untuk AI.
// Owner bisa menambah data (mis. info produk/bisnis) lewat perintah .tambahdata,
// lalu data ini otomatis disuntikkan ke prompt AI agar bot bisa menjawab seperti
// "customer service" yang paham bisnis kamu (pendekatan RAG sederhana).

import fs from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "WhatsApp", "database", "system");
const FILE = path.join(DIR, "knowledge.json");

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

export function addFact(text) {
  const d = load();
  d.push(text.trim());
  save(d);
  return d.length;
}

export function listFacts() {
  return load();
}

export function removeFact(index) {
  const d = load();
  if (index < 1 || index > d.length) return false;
  d.splice(index - 1, 1);
  save(d);
  return true;
}

export function clearFacts() {
  save([]);
}

// Teks pengetahuan yang akan disuntikkan ke prompt AI.
export function getKnowledgeText() {
  const d = load();
  if (!d.length) return "";
  return (
    "\n\nBasis pengetahuan (pakai info ini bila relevan, jangan mengarang di luar ini):\n" +
    d.map((f, i) => `${i + 1}. ${f}`).join("\n")
  );
}
