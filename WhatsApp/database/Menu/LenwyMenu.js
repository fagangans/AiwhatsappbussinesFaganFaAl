/*  

  Made By Lenwy
  Base : Lenwy
  WhatsApp : wa.me/6283829814737
  Telegram : t.me/ilenwy
  Youtube : @Lenwy

  Channel : https://whatsapp.com/channel/0029VaGdzBSGZNCmoTgN2K0u

  Copy Code?, Recode?, Rename?, Reupload?, Reseller? Taruh Credit Ya :D

  Mohon Untuk Tidak Menghapus Watermark Di Dalam Kode Ini

*/

import fs from "fs";
import path from "path";
const ordersFile = path.join(
  process.cwd(),
  "WhatsApp",
  "database",
  "orders.json",
);

globalThis.getOrderStats = function () {
  let totalOrders = 0;
  let totalAmount = 0;

  if (fs.existsSync(ordersFile)) {
    const data = JSON.parse(fs.readFileSync(ordersFile));

    for (let user in data) {
      let order = data[user];
      if (order.status === "paid") {
        totalOrders++;
        totalAmount += Number(order.amount) || 0;
      }
    }
  }

  return { totalOrders, totalAmount };
};

((globalThis.lenwymenu = `☕ *Lenwy SCM*
*WhatsApp Bot To Solve Your Problems*

📑 *Information Bot*
*Creator : FaganFaAl*
*Contact : wa.me/089695368844*
*Instagram : *\n`),
  // List Menu =========================
  (globalThis.storelist = `🎁 *Order Statistics*
*Order : ${getOrderStats().totalOrders}*
*Transaksi : Rp${getOrderStats().totalAmount.toLocaleString("id-ID")}*

*Contoh : Order A2*

📦 *Daftar Produk :*`));

