// Wrapper sederhana untuk Google Gemini API (generativelanguage.googleapis.com).
// Tidak butuh npm package tambahan, cukup pakai axios yang sudah ada.

import axios from "axios";

// API key dibaca dari environment variable (set di file .env)
const API_KEY = process.env.GEMINI_API_KEY || "";

const MODELS = {
  "gemini-flash": "gemini-2.5-flash",
  "gemini-pro": "gemini-2.5-pro",
};

export function getAvailableModels() {
  return Object.keys(MODELS);
}

export function getModelLabel(key) {
  return MODELS[key] || key;
}

export async function askGemini(prompt, model = "gemini-flash") {
  const modelId = MODELS[model] || MODELS["gemini-flash"];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${API_KEY}`;

  const { data } = await axios.post(
    url,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 2048,
      },
    },
    { timeout: 30000 },
  );

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || null;
}
