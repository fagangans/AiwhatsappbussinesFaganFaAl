import axios from "axios";

// Metadata
export const info = {
  name: "Cuaca",

  menu: ["Cuaca"],
  case: ["cuaca", "weather"],

  description: "Info cuaca real-time sebuah kota",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

// Handler — sumber: wttr.in (gratis, tanpa API key)
export default async function handler(leni) {
  const { q, LenwyText, LenwyWait } = leni;

  if (!q) return LenwyText("☘️ *Contoh:* .cuaca Jakarta");

  LenwyWait();

  try {
    const { data } = await axios.get(
      `https://wttr.in/${encodeURIComponent(q.trim())}?format=j1&lang=id`,
      { timeout: 15000, headers: { "User-Agent": "curl/7.88" } },
    );

    const cur = data?.current_condition?.[0];
    if (!cur) return LenwyText("❌ Kota tidak ditemukan.");

    const area = data?.nearest_area?.[0];
    const place = area
      ? `${area.areaName?.[0]?.value || q}, ${area.country?.[0]?.value || ""}`.trim()
      : q.trim();

    const desc =
      cur.lang_id?.[0]?.value || cur.weatherDesc?.[0]?.value || "-";

    await LenwyText(
      `🌤️ *Cuaca ${place}*\n\n` +
        `📝 Kondisi: ${desc}\n` +
        `🌡️ Suhu: ${cur.temp_C}°C (terasa ${cur.FeelsLikeC}°C)\n` +
        `💧 Kelembapan: ${cur.humidity}%\n` +
        `🌬️ Angin: ${cur.windspeedKmph} km/jam\n` +
        `☔ Curah hujan: ${cur.precipMM} mm\n` +
        `👁️ Jarak pandang: ${cur.visibility} km`,
    );
  } catch (err) {
    console.error("Cuaca Error:", err?.message || err);
    LenwyText("❌ Gagal mengambil data cuaca. Coba lagi nanti.");
  }
}
