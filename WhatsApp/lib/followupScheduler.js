import { getDueFollowUps, markSent } from "./followups.js";

const CHECK_INTERVAL = 5 * 60 * 1000; // cek follow-up jatuh tempo setiap 5 menit

function buildMessage(f) {
  const greet = f.customerName ? `Halo ${f.customerName}! 👋` : "Halo! 👋";
  return (
    `${greet}\n\n` +
    `Kemarin kamu sempat tertarik dengan *${f.product}* tapi belum jadi pesan. ` +
    `Masih berminat? Tinggal ketik *.order* untuk lanjut pesan, kami siap bantu kapan saja! 😊`
  );
}

let started = false;

export function startFollowUpScheduler() {
  if (started) return;
  started = true;

  setInterval(async () => {
    const sock = globalThis.waSocket;
    if (!sock) return;

    for (const f of getDueFollowUps()) {
      try {
        await sock.sendMessage(f.chatId, { text: buildMessage(f) });
      } catch (err) {
        console.error("Follow-up gagal terkirim:", err?.message || err);
      }
      markSent(f.id);
    }
  }, CHECK_INTERVAL);
}
