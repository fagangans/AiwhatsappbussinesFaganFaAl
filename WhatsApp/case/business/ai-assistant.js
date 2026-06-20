import axios from "axios";
import { getProfile, getAllProducts, getAllFaq } from "../../database/business/db.js";
import Ai4Chat from "../../scrape/Ai4Chat.js";

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

export async function askBusinessAssistant(question, ownerId = 1) {
  const { hasData, context } = buildKnowledgeContext(ownerId);

  const prompt = hasData
    ? `Kamu adalah asisten customer service untuk bisnis berikut. HANYA jawab pertanyaan yang berkaitan dengan bisnis ini berdasarkan informasi di bawah. Jika pertanyaan customer TIDAK berkaitan dengan bisnis ini, tolak dengan sopan dan arahkan kembali ke topik bisnis ini saja.\n\nInformasi Bisnis:\n${context}\n\nPertanyaan Customer: ${question}\n\nJawab singkat, ramah, dan dalam Bahasa Indonesia.`
    : `Kamu adalah asisten customer service yang ramah dan membantu. Jawab pertanyaan berikut dengan singkat dan jelas dalam Bahasa Indonesia.\n\nPertanyaan: ${question}`;

  try {
    const answer = await callAIProvider(prompt);
    return answer || null;
  } catch (err) {
    console.error("AI Assistant Error:", err.message);
    return null;
  }
}
