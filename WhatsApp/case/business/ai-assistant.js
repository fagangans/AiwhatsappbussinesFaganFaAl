import axios from "axios";
import { getProfile, getAllProducts, getAllFaq } from "../../database/business/db.js";
import Ai4Chat from "../../scrape/Ai4Chat.js";

const conversationHistory = new Map();
const MAX_HISTORY = 10;
const HISTORY_TTL = 30 * 60 * 1000;

function getHistory(senderId) {
  const entry = conversationHistory.get(senderId);
  if (!entry) return [];
  if (Date.now() - entry.lastUpdate > HISTORY_TTL) {
    conversationHistory.delete(senderId);
    return [];
  }
  return entry.messages;
}

function addToHistory(senderId, role, text) {
  let entry = conversationHistory.get(senderId);
  if (!entry) {
    entry = { messages: [], lastUpdate: Date.now() };
    conversationHistory.set(senderId, entry);
  }
  entry.messages.push({ role, text: text.slice(0, 500) });
  if (entry.messages.length > MAX_HISTORY) {
    entry.messages = entry.messages.slice(-MAX_HISTORY);
  }
  entry.lastUpdate = Date.now();
}

function buildKnowledgeContext(ownerId) {
  const profile = getProfile(ownerId);
  const products = getAllProducts(null, ownerId) || [];
  const faqs = getAllFaq(ownerId) || [];

  const hasData = !!(profile.description?.trim()) || products.length > 0 || faqs.length > 0;
  if (!hasData) return { hasData: false, context: "" };

  let context = `Nama Bisnis: ${profile.name || "Tidak diketahui"}\n`;
  if (profile.description) context += `Deskripsi: ${profile.description}\n`;
  if (profile.category) context += `Kategori: ${profile.category}\n`;
  if (profile.address) context += `Alamat: ${profile.address}\n`;
  if (profile.open_hour != null && profile.close_hour != null) {
    context += `Jam Operasional: ${String(profile.open_hour).padStart(2, "0")}:00 - ${String(profile.close_hour).padStart(2, "0")}:00\n`;
  }

  if (products.length > 0) {
    context += `\nDaftar Produk:\n`;
    products.slice(0, 30).forEach((p) => {
      context += `- ${p.name}${p.sku ? ` (${p.sku})` : ""}: Rp${p.price}${p.description ? " - " + p.description : ""}\n`;
    });
  }

  if (faqs.length > 0) {
    context += `\nFAQ:\n`;
    faqs.slice(0, 30).forEach((f) => {
      context += `Q: ${f.question}\nA: ${f.answer}\n`;
    });
  }

  return { hasData: true, context };
}

function cleanResponse(text) {
  if (!text) return text;
  return text
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*{3,}/g, "*")
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, "").trim())
    .replace(/^[\s]*[-•]\s+/gm, "- ")
    .replace(/^\d+\.\s+/gm, (m) => m)
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\\n/g, "\n")
    .replace(/^"|"$/g, "")
    .trim();
}

const INTENT_PATTERNS = [
  { intent: "menu", patterns: [/\b(lihat|tampil|kasih|mau|bisa)\b.*\b(menu|fitur|layanan|bantuan)\b/i, /\b(menu|fitur|layanan)\b.*\b(apa|aja|saja|nya)\b/i, /\bhelp\b/i] },
  { intent: "katalog", patterns: [/\b(lihat|tampil|tunjuk|kasih|mau)\b.*\b(katalog|produk|barang|daftar.*produk|jualan)\b/i, /\b(produk|barang|jualan)\b.*\b(apa|aja|saja)\b/i, /\b(ada|punya|jual)\b.*\bapa\b/i] },
  { intent: "pesan", patterns: [/\b(mau|ingin|pengen|mw)\b.*\b(pesan|order|beli|ambil)\b/i, /\b(cara|gimana|bagaimana)\b.*\b(pesan|order|beli)\b/i] },
  { intent: "faq", patterns: [/\b(pertanyaan|tanya|faq)\b.*\b(umum|sering)\b/i, /\b(sering)\b.*\b(ditanya|tanyakan)\b/i] },
  { intent: "cekorder", patterns: [/\b(cek|status|lacak|track|mana)\b.*\b(pesanan|order|orderan|paket|kiriman)\b/i, /\bpesanan\b.*\b(saya|ku|gw|gua|gue)\b/i] },
  { intent: "buattiket", patterns: [/\b(buat|bikin|ajukan|kirim)\b.*\b(tiket|keluhan|komplain|laporan|aduan)\b/i, /\b(mau|ingin)\b.*\b(komplain|keluhan|lapor)\b/i] },
  { intent: "bayar", patterns: [/\b(cara|gimana|bagaimana)\b.*\b(bayar|pembayaran|transfer)\b/i, /\b(info|informasi)\b.*\b(pembayaran|bayar|rekening)\b/i] },
];

export function detectIntent(text) {
  const lower = text.toLowerCase();
  for (const { intent, patterns } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(lower)) return intent;
    }
  }
  return null;
}

async function callGemini(prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const { data } = await axios.post(url, { contents: [{ parts: [{ text: prompt }] }] }, { timeout: 20000 });
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

async function callOpenAI(prompt, apiKey) {
  const { data } = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    { model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }] },
    { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 20000 },
  );
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

async function callAIProvider(prompt) {
  const provider = process.env.AI_PROVIDER || "free";
  const apiKey = process.env.AI_API_KEY || "";

  if (provider === "gemini" && apiKey) return callGemini(prompt, apiKey);
  if (provider === "openai" && apiKey) return callOpenAI(prompt, apiKey);
  return Ai4Chat(prompt);
}

export async function askBusinessAssistant(question, ownerId = 1, senderId = "") {
  const { hasData, context } = buildKnowledgeContext(ownerId);

  const history = senderId ? getHistory(senderId) : [];
  let historyBlock = "";
  if (history.length > 0) {
    historyBlock = "\nRiwayat Percakapan Terakhir:\n" +
      history.map(h => `${h.role === "customer" ? "Customer" : "Kamu"}: ${h.text}`).join("\n") +
      "\n";
  }

  const formatRule = `ATURAN FORMAT JAWABAN (WAJIB DIPATUHI):
- Kamu sedang chatting di WhatsApp, BUKAN menulis artikel atau dokumen.
- DILARANG KERAS menggunakan heading (#), bullet list (*/-), code block (\`\`\`), atau format markdown apapun.
- DILARANG menggunakan bold (**) lebih dari 2 kali per jawaban, dan hanya untuk kata kunci penting.
- Tulis jawaban dalam paragraf pendek (2-3 kalimat per paragraf), pisahkan dengan satu baris kosong.
- Gunakan bahasa Indonesia sehari-hari yang sopan dan hangat, seperti CS profesional tapi ramah.
- Jangan gunakan emoji berlebihan, maksimal 1-2 emoji per jawaban.
- Jangan mulai jawaban dengan "Halo!" atau sapaan jika customer tidak menyapa.
- Jika jawaban panjang, bagi jadi beberapa paragraf pendek yang enak dibaca, BUKAN list.
- Kata "menu" dalam konteks ini berarti fitur/layanan bot, BUKAN menu makanan/minuman, kecuali bisnis ini memang restoran.`;

  const prompt = hasData
    ? `Kamu adalah asisten customer service profesional untuk bisnis berikut. Kamu HANYA boleh menjawab pertanyaan yang berkaitan dengan bisnis ini. Jika customer bertanya hal di luar topik bisnis ini, tolak dengan sopan lalu tawarkan bantuan seputar bisnis ini.\n\n${formatRule}\n\nInformasi Bisnis:\n${context}${historyBlock}\nCustomer: ${question}`
    : `Kamu adalah asisten customer service profesional yang cerdas dan membantu. Jawab dengan natural dan informatif.\n\n${formatRule}${historyBlock}\nCustomer: ${question}`;

  try {
    const answer = await callAIProvider(prompt);
    const cleaned = cleanResponse(answer);
    if (senderId && cleaned) {
      addToHistory(senderId, "customer", question);
      addToHistory(senderId, "assistant", cleaned);
    }
    return cleaned || null;
  } catch (err) {
    console.error("AI Assistant Error:", err.message);
    return null;
  }
}
