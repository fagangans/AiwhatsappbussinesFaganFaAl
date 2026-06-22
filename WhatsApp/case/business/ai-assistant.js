import axios from "axios";
import { getProfile, getAllProducts, getAllFaq, getAllAgents } from "../../database/business/db.js";
import Ai4Chat from "../../scrape/Ai4Chat.js";

const AI_BADGE = "\n\n✦⁺ 𝗔𝗜";

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

export function getAgentContact(ownerId) {
  const agents = getAllAgents(ownerId) || [];
  if (agents.length === 0) return null;
  const agent = agents.find((a) => a.is_online) || agents[0];
  return { name: agent.name, phone: agent.jid.split("@")[0] };
}

const ESCALATION_HINTS = /(hubungi admin|belum (punya|ada) info|tanya (langsung )?ke admin|kurang paham|tidak yakin|silakan hubungi|hubungi kami langsung)/i;

function appendAgentContact(text, ownerId) {
  if (!text || !ESCALATION_HINTS.test(text)) return text;
  const agent = getAgentContact(ownerId);
  if (!agent || text.includes(agent.phone)) return text;
  return `${text}\n\nBiar lebih cepat, kamu bisa langsung chat *${agent.name}* di wa.me/${agent.phone} ya 😊`;
}

function cleanResponse(text) {
  if (!text) return text;
  return text
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*{3,}/g, "*")
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, "").trim())
    .replace(/^[\s]*[-•]\s+/gm, "- ")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/^["']|["']$/g, "")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .trim();
}

const INTENT_PATTERNS = [
  { intent: "menu", patterns: [
    /\b(lihat|tampil|kasih|mau|bisa|tolong)\b.*\b(menu|fitur|layanan|bantuan)\b/i,
    /\b(menu|fitur|layanan)\b.*\b(apa|aja|saja|nya)\b/i,
    /\bhelp\b/i,
    /^menu$/i,
    /\bbisa\s+(ngapain|apa)\b/i,
    /\bkamu\s+bisa\b.*\bapa\b/i,
  ] },
  { intent: "katalog", patterns: [
    /\b(lihat|tampil|tunjuk|kasih|mau|cek|show)\b.*\b(katalog|produk|barang|daftar.*produk|jualan|dagangan)\b/i,
    /\b(produk|barang|jualan|dagangan)\b.*\b(apa|aja|saja|nya)\b/i,
    /\b(ada|punya|jual)\b.*\bapa\b/i,
    /^(katalog|produk|barang)$/i,
    /\blist\s*(produk|barang)\b/i,
  ] },
  { intent: "pesan", patterns: [
    /\b(mau|ingin|pengen|mw|mo|pen)\b.*\b(pesan|order|beli|ambil|checkout)\b/i,
    /\b(cara|gimana|bagaimana)\b.*\b(pesan|order|beli)\b/i,
    /\b(order|beli|pesan)\b.*\b(dong|ya|yuk|gan|kak|min)\b/i,
    /^(pesan|order|beli)$/i,
  ] },
  { intent: "faq", patterns: [
    /\b(pertanyaan|tanya|faq)\b.*\b(umum|sering)\b/i,
    /\b(sering)\b.*\b(ditanya|tanyakan)\b/i,
    /^faq$/i,
    /\bfaq\b.*\b(apa|nya|list)\b/i,
    /\b(ada|punya)\b.*\b(faq|pertanyaan)\b/i,
  ] },
  { intent: "cekorder", patterns: [
    /\b(cek|status|lacak|track|mana|dimana)\b.*\b(pesanan|order|orderan|paket|kiriman)\b/i,
    /\bpesanan\b.*\b(saya|ku|gw|gua|gue|aku)\b/i,
    /\border\b.*\b(saya|ku|gw|gua|gue|aku)\b/i,
    /\b(cek|lihat)\b.*\bord-/i,
    /^cek\s*(order|pesanan)$/i,
  ] },
  { intent: "buattiket", patterns: [
    /\b(buat|bikin|ajukan|kirim|mau|ingin|pengen)\b.*\b(tiket|keluhan|komplain|laporan|aduan|report)\b/i,
    /\b(mau|ingin|pengen)\b.*\b(komplain|keluhan|lapor|ngadu)\b/i,
    /\b(ada|punya)\b.*\b(keluhan|masalah|kendala|problem|issue)\b/i,
    /\b(keluhan|komplain|complain)\b/i,
    /^(tiket|komplain|keluhan|lapor)$/i,
  ] },
  { intent: "bayar", patterns: [
    /\b(cara|gimana|bagaimana|info)\b.*\b(bayar|pembayaran|transfer|kirim\s*uang)\b/i,
    /\b(info|informasi)\b.*\b(pembayaran|bayar|rekening|bank|ewallet)\b/i,
    /\b(metode|cara)\b.*\b(bayar|pembayaran)\b/i,
    /\b(rekening|norek|no\s*rek|transfer\s*kemana)\b/i,
    /\b(bayar|pembayaran)\b.*\b(gimana|kemana|ke\s*mana)\b/i,
  ] },
  { intent: "loyalty", patterns: [
    /\b(cek|lihat|berapa|saldo)\b.*\b(poin|point|loyalty|member)\b/i,
    /\b(poin|point|loyalty)\b.*\b(saya|ku|gw|gua|gue|aku)\b/i,
    /^(cek poin|poin saya|loyalty)$/i,
    /\bpoin\b/i,
  ] },
  { intent: "redeem", patterns: [
    /\b(tukar|redeem|tukerin|pakai|pake|gunakan)\b.*\b(poin|point|loyalty)\b/i,
    /\b(poin|point)\b.*\b(tukar|redeem)\b/i,
    /^tukar\s*poin$/i,
  ] },
  { intent: "apply_referral", patterns: [
    /\b(pakai|pake|gunakan|use|apply|masukkan)\b.*\b(referral|kode|code)\b\s+[A-Za-z0-9]+/i,
    /\b(pakai|pake)\b.*\breferral\b/i,
  ] },
  { intent: "referral", patterns: [
    /\b(kode|code)\b.*\b(referral|referal|refferal|ref)\b/i,
    /\b(referral|referal|refferal)\b.*\b(saya|ku|gw|gua|gue|aku|code|kode)\b/i,
    /^(referral|kode referral|ref)$/i,
    /\breferral\b/i,
  ] },
  { intent: "rating", patterns: [
    /\b(beri|kasih|mau|ingin)\b.*\b(rating|review|bintang|rate|ulasan)\b/i,
    /\b(rating|review|rate)\b.*\b(pesanan|order)\b/i,
    /^(rating|review|rate)$/i,
    /\b(rating|review)\b/i,
  ] },
  { intent: "minta_cs", patterns: [
    /\b(mau|ingin|pengen|bisa)\b.*\b(ngomong|chat|bicara|connect|dihubungkan|tersambung)\b.*\b(cs|admin|agent|agen|manusia|orang|operator)\b/i,
    /\b(panggil|hubungkan|sambungkan)\b.*\b(cs|admin|agent|agen|operator)\b/i,
    /\b(nomor|kontak)\b.*\b(cs|admin|agent|agen|operator)\b/i,
    /^(cs|admin|agen|operator)$/i,
    /\btalk\s*to\s*(human|agent|cs)\b/i,
  ] },
  { intent: "bundle", patterns: [
    /\b(lihat|tampil|ada|cek)\b.*\b(bundle|bundling|paket|combo)\b/i,
    /\b(bundle|bundling|paket|combo)\b.*\b(apa|aja|saja|nya)\b/i,
    /^(bundle|bundling|paket|combo)$/i,
    /\b(paket|bundle)\b.*\b(produk|barang|hemat)\b/i,
  ] },
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

  const formatRule = `ATURAN GAYA & FORMAT:
- Ini chat WhatsApp, bukan email. Tulis seperti customer service profesional yang ramah: jelas, to the point, tapi tetap terasa ngobrol natural (bukan template kaku).
- Boleh pakai 2-4 kalimat kalau memang perlu menjelaskan sesuatu yang detail, tapi jangan bertele-tele. Kalau pertanyaannya simpel, jawab singkat saja.
- Kalau perlu menjelaskan beberapa poin, pisahkan jadi baris baru per poin (pakai "-"), JANGAN ditulis jadi satu paragraf padat yang susah dibaca.
- Kalau pertanyaan customer ambigu atau kurang jelas maksudnya, JANGAN menebak — tanya balik dengan sopan untuk klarifikasi.
- Kalau customer ragu/menyangsikan jawabanmu, jangan ngulang klaim yang sama. Akui keraguannya, jelaskan ulang dengan cara berbeda atau arahkan ke admin untuk kepastian.
- DILARANG: heading (#), code block, bullet bertingkat, bold berlebihan, escaped quotes (\\"), karakter aneh.
- Boleh pakai *bold* WhatsApp untuk istilah/angka penting (harga, nama produk, nomor), jangan dipakai di semua kata.
- Bahasa Indonesia yang sopan dan hangat, tidak kaku, maksimal 1 emoji per jawaban.
- Jangan menyapa ("Halo!") kecuali customer menyapa duluan.
- "Menu" = fitur/layanan bot ini, BUKAN menu makanan, kecuali bisnis ini restoran.`;

  const antiHallucination = `ATURAN KEJUJURAN (SANGAT PENTING — WAJIB DIPATUHI):
- Kamu HANYA BOLEH menjawab berdasarkan data bisnis yang diberikan di bawah ini. JANGAN PERNAH mengarang, mengira-ngira, atau menambahkan informasi yang TIDAK ADA di data.
- Jika customer bertanya tentang produk, harga, stok, atau detail yang TIDAK ADA di data — jawab jujur: "Maaf, saya belum punya info lengkap soal itu. Silakan tanya langsung ke admin ya kak."
- JANGAN mengarang harga, fitur produk, ketersediaan stok, waktu pengiriman, atau informasi apapun yang tidak tertulis di data.
- JANGAN membuat klaim, janji, atau jaminan yang tidak ada di data bisnis.
- Jika tidak yakin, SELALU arahkan ke admin/CS manusia daripada menebak.
- JANGAN menjawab pertanyaan di luar topik bisnis ini (misalnya pertanyaan umum, trivia, coding, dll). Tolak sopan dan tawarkan bantuan seputar bisnis.`;

  let prompt;
  if (hasData) {
    prompt = `Kamu adalah asisten customer service untuk bisnis berikut. Tugasmu membantu customer berdasarkan DATA BISNIS yang tersedia.\n\n${antiHallucination}\n\n${formatRule}\n\nDATA BISNIS (sumber kebenaran — jawab HANYA berdasarkan ini):\n${context}${historyBlock}\nCustomer: ${question}`;
  } else {
    prompt = `Kamu adalah asisten customer service. Bisnis ini belum mengisi data produk/FAQ di sistem.\n\n${formatRule}\n\nATURAN KHUSUS (bisnis belum diatur):\n- Kamu TIDAK BOLEH mengarang informasi apapun tentang produk, harga, atau layanan.\n- Untuk SEMUA pertanyaan tentang produk, harga, ketersediaan, atau layanan, jawab: "Maaf kak, info produk belum tersedia di sistem. Silakan hubungi admin langsung ya."\n- Kamu hanya boleh membalas sapaan, ucapan terima kasih, dan mengarahkan customer ke admin.\n- JANGAN mengarang atau menebak apapun.${historyBlock}\nCustomer: ${question}`;
  }

  try {
    const answer = await callAIProvider(prompt);
    const cleaned = appendAgentContact(cleanResponse(answer), ownerId);
    if (senderId && cleaned) {
      addToHistory(senderId, "customer", question);
      addToHistory(senderId, "assistant", cleaned);
    }
    return cleaned ? cleaned + AI_BADGE : null;
  } catch (err) {
    console.error("AI Assistant Error:", err.message);
    return null;
  }
}
