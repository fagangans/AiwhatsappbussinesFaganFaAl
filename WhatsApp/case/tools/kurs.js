import axios from "axios";

// Metadata
export const info = {
  name: "Kurs Mata Uang",

  menu: ["Kurs"],
  case: ["kurs", "rate", "currency"],

  description: "Konversi mata uang (mis. .kurs 100 USD IDR)",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

// Handler — sumber: open.er-api.com (gratis, tanpa API key)
export default async function handler(leni) {
  const { args, LenwyText, LenwyWait } = leni;

  if (!args.length)
    return LenwyText(
      "💱 *Kurs Mata Uang*\n\n*Contoh:*\n.kurs USD\n.kurs 100 USD IDR\n.kurs 50 SGD",
    );

  // Pola: [jumlah?] FROM [TO?]   (TO default IDR)
  let amount = 1;
  let from, to;

  const nums = args.filter((a) => /^\d+(\.\d+)?$/.test(a));
  const codes = args
    .filter((a) => /^[a-zA-Z]{3}$/.test(a))
    .map((a) => a.toUpperCase());

  if (nums.length) amount = parseFloat(nums[0]);
  from = codes[0];
  to = codes[1] || "IDR";

  if (!from)
    return LenwyText("❌ Masukkan kode mata uang (3 huruf). Contoh: .kurs USD");

  LenwyWait();

  try {
    const { data } = await axios.get(
      `https://open.er-api.com/v6/latest/${from}`,
      { timeout: 15000 },
    );

    if (data?.result !== "success" || !data?.rates?.[to])
      return LenwyText("❌ Kode mata uang tidak valid.");

    const rate = data.rates[to];
    const result = amount * rate;

    await LenwyText(
      `💱 *Konversi Mata Uang*\n\n` +
        `${amount.toLocaleString("id-ID")} ${from} = *${result.toLocaleString(
          "id-ID",
          { maximumFractionDigits: 2 },
        )} ${to}*\n\n` +
        `📊 Kurs: 1 ${from} = ${rate.toLocaleString("id-ID")} ${to}\n` +
        `🕒 Update: ${data.time_last_update_utc || "-"}`,
    );
  } catch (err) {
    console.error("Kurs Error:", err?.message || err);
    LenwyText("❌ Gagal mengambil data kurs. Coba lagi nanti.");
  }
}
