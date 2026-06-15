// Metadata
export const info = {
  name: "Kalkulator",

  menu: ["Calc"],
  case: ["calc", "kalkulator", "hitung"],

  description: "Kalkulator (mis. .calc 15% of 200000)",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

// Handler
export default async function handler(leni) {
  const { q, LenwyText } = leni;

  if (!q)
    return LenwyText(
      "🧮 *Kalkulator*\n\n*Contoh:*\n.calc (5+3)*2\n.calc 15% of 200000\n.calc 1000 x 12",
    );

  let raw = q.trim().toLowerCase();

  // Bahasa natural: "X% of Y" / "X persen dari Y" → (X/100*Y)
  raw = raw.replace(
    /(\d+(?:\.\d+)?)\s*(?:%|persen)\s*(?:of|dari)\s*(\d+(?:\.\d+)?)/g,
    "($1/100*$2)",
  );
  // Sisa persen: "X%" → (X/100)
  raw = raw.replace(/(\d+(?:\.\d+)?)\s*(?:%|persen)/g, "($1/100)");
  // Simbol umum
  raw = raw.replace(/[x×]/g, "*").replace(/÷/g, "/");

  // Hanya izinkan karakter aman untuk mencegah eksekusi kode berbahaya
  const safe = raw.replace(/[^0-9+\-*/().\s]/g, "");
  if (!safe.trim()) return LenwyText("❌ Ekspresi tidak valid.");

  let result;
  try {
    result = Function(`"use strict"; return (${safe});`)();
  } catch {
    return LenwyText("❌ Gagal menghitung. Cek format ekspresinya.");
  }

  if (typeof result !== "number" || Number.isNaN(result) || !Number.isFinite(result))
    return LenwyText("❌ Hasil tidak valid.");

  await LenwyText(
    `🧮 *Kalkulator*\n\n\`${q.trim()}\`\n= *${result.toLocaleString("id-ID")}*`,
  );
}
