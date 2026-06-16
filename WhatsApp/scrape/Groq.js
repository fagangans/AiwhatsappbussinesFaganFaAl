// Wrapper sederhana untuk Groq API (api.groq.com — OpenAI-compatible).
// Tidak butuh npm package tambahan, cukup pakai axios yang sudah ada.

import axios from "axios";

// API key dibaca dari environment variable (set di file .env)
const API_KEY = process.env.GROQ_API_KEY || "";

const MODELS = {
  "groq-llama": "llama-3.3-70b-versatile",
  "groq-fast": "llama-3.1-8b-instant",
};

export function getAvailableModels() {
  return Object.keys(MODELS);
}

export function getModelLabel(key) {
  return MODELS[key] || key;
}

export async function askGroq(prompt, model = "groq-llama") {
  const modelId = MODELS[model] || MODELS["groq-llama"];

  const { data } = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 2048,
    },
    {
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );

  const text = data?.choices?.[0]?.message?.content;
  return text || null;
}
