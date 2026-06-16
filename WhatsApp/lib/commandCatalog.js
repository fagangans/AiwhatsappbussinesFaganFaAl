// Bangun teks "katalog command" dari Map commands (cmd -> {execute, info, category})
// yang sudah dimuat oleh lenwy.js, supaya AI tahu semua fitur bot dan bisa
// merekomendasikan command yang tepat saat user menunjukkan niat (eksplisit/implisit).

export function getCommandCatalogText(commandsMap) {
  if (!commandsMap || !commandsMap.size) return "";

  const seen = new Set();
  const byCategory = new Map();

  for (const entry of commandsMap.values()) {
    const info = entry?.info;
    if (!info || info.hidden) continue;
    if (seen.has(info)) continue;
    seen.add(info);

    const list = byCategory.get(entry.category) || [];
    list.push(info);
    byCategory.set(entry.category, list);
  }

  let text =
    "\n\nDaftar Fitur/Command Bot Yang Tersedia (semua pakai prefix '.' di depan, mis. .sticker):\n";

  for (const [category, infos] of byCategory) {
    text += `\n[${category.toUpperCase()}]\n`;
    for (const info of infos) {
      const mainCmd = info.case?.[0];
      if (!mainCmd) continue;
      const ownerTag = info.owner ? " (khusus Owner)" : "";
      text += `- .${mainCmd}${ownerTag} — ${info.description || info.name}\n`;
    }
  }

  return text;
}
