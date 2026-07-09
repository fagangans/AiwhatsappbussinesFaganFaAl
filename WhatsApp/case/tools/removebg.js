/*  

  Made By Lenwy
  Base : Lenwy
  WhatsApp : wa.me/6283829814737
  Telegram : t.me/ilenwy
  Youtube : @Lenwy

  Channel : https://whatsapp.com/channel/0029VaGdzBSGZNCmoTgN2K0u

  Copy Code?, Recode?, Rename?, Reupload?, Reseller? Taruh Credit Ya :D

  Mohon Untuk Tidak Menghapus Watermark Di Dalam Kode Ini

  NumpangNama: @SakanaaDesu
  KurangTau: https://whatsapp.com/channel/0029Vb7Q3tA0bIdwP0cpwA3J
  
*/

import FormData from "form-data";
import axios from "axios";

// Apikeys
const REMOVEBG_API_KEY = process.env.REMOVEBG_API_KEY || "";

export const info = {
  name: "Remove Background",
  menu: ["removebg"],
  case: ["removebg", "rmbg", "hapusbg", "mbg"],
  description: "Hapus Background HD Ultra Max",
  hidden: false,
  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,
  // Tambahin RateLimiter 😡
  allowPrivate: true,
};

export default async function handler(leni) {
  const {
    lenwy,
    msg,
    len,
    replyJid,
    LenwyText,
    LenwyWait,
    mediaType,
  } = leni;

  let imageMsg = null;
  let sourceLabel = "";

  if (msg.message?.imageMessage) {
    imageMsg = msg.message.imageMessage;
    sourceLabel = "direct";
  }

  const quotedMsg =
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!imageMsg && quotedMsg?.imageMessage) {
    imageMsg = quotedMsg.imageMessage;
    sourceLabel = "quoted";
  }

  if (!imageMsg) {
    return LenwyText(
      "⚠️ *Kirim atau reply foto yang ingin dihapus backgroundnya!*"
    );
  }

  if (!REMOVEBG_API_KEY) {
    return LenwyText(
      "⚠️ *Fitur removebg belum dikonfigurasi.* Set REMOVEBG_API_KEY di environment variable."
    );
  }

  await LenwyWait();

  try {
    const imageBuffer = await lenwy.downloadMediaMessage(imageMsg);

    const form = new FormData();
    form.append("image", imageBuffer, {
      filename: "photo.jpg",
      contentType: imageMsg.mimetype || "image/jpeg",
    });
    form.append("hd", "true");

    const response = await axios.post(
      "https://removbg-sakanaa.replit.app/api/remove-background",
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${REMOVEBG_API_KEY}`,
        },
        responseType: "arraybuffer",
        timeout: 60_000,
      }
    );

    const resultBuffer = Buffer.from(response.data);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `lenwy_rbg_${timestamp}.png`;

    await lenwy.sendMessage(
      replyJid,
      {
        document: resultBuffer,
        fileName,
        mimetype: "image/png",
        caption: "*Background Berhasil Dihapus!* ☕",
      },
      { quoted: len }
    );
  } catch (err) {
    console.error("[REMOVEBG] Error:", err);
    const errMsg = err?.response?.data
      ? Buffer.from(err.response.data).toString()
      : err.message;
    return LenwyText(`😎 *Gagal memproses gambar!*\n\nError: ${errMsg}`);
  }
}
