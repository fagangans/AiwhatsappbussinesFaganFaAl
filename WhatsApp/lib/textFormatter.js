// Post-processor untuk merapikan jawaban dari Ai4Chat scraper.
// Tujuan: bersihkan simbol/karakter asing, dan pecah teks panjang jadi paragraf
// pendek (2-3 kalimat) supaya tertata rapi saat dibaca di WhatsApp.

function cleanArtifacts(text) {
  let t = text;

  // Hilangkan tanda kutip pembungkus yang kadang dikirim API (mis. "..." di awal & akhir)
  t = t.replace(/^["'`“”‘’]+/, "")
       .replace(/["'`“”‘’]+$/, "");

  // Normalisasi escape sequence yang kadang ikut sebagai literal
  t = t.replace(/\\n/g, "\n").replace(/\\t/g, " ").replace(/\\r/g, "");

  // Hapus karakter kontrol (selain newline 0x0A & tab 0x09)
  t = t.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "");

  // Hilangkan markdown header/horizontal-rule yang aneh di WA
  t = t.replace(/^#{1,6}\s*/gm, "");
  t = t.replace(/^-{3,}$/gm, "");
  t = t.replace(/^\*{3,}$/gm, "");

  // Konversi **bold** markdown → *bold* WhatsApp
  t = t.replace(/\*\*(.+?)\*\*/g, "*$1*");

  // Hilangkan bullet markdown campur (•, ●) jadi konsisten "- "
  t = t.replace(/^\s*[•●▪‣◦]\s+/gm, "- ");

  // Rapikan whitespace
  t = t.replace(/[ \t]+/g, " "); // spasi/tab beruntun jadi satu spasi
  t = t.replace(/ ?\n ?/g, "\n"); // bersihkan spasi di sekitar newline
  t = t.replace(/\n{3,}/g, "\n\n"); // maksimal 1 baris kosong

  return t.trim();
}

// Pecah blok teks jadi paragraf 2-3 kalimat, dipisah baris kosong.
function paragraphize(text) {
  // Kalau sudah ada paragraf jelas (ada \n\n), hormati struktur penulis aslinya.
  if (/\n\s*\n/.test(text)) return text;

  // Kalau berisi list (baris diawali "- " atau "1. "), jangan diutak-atik.
  if (/^\s*(-|\d+\.)\s+/m.test(text)) return text;

  // Pisah berdasar akhir kalimat (. ! ?) yang diikuti spasi + huruf kapital/kutip
  const sentences = text
    .replace(/([.!?])\s+(?=[A-Z"“'(])/g, "$1\n")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 2) return text.trim();

  // Kelompokkan 2-3 kalimat per paragraf
  const paragraphs = [];
  for (let i = 0; i < sentences.length; ) {
    // 3 kalimat per paragraf bila tersisa ≥4, jika tidak ambil 2
    const chunk = sentences.length - i >= 4 ? 3 : 2;
    paragraphs.push(sentences.slice(i, i + chunk).join(" "));
    i += chunk;
  }

  return paragraphs.join("\n\n");
}

export function formatAi4ChatAnswer(text) {
  if (!text || typeof text !== "string") return text;
  return paragraphize(cleanArtifacts(text));
}
