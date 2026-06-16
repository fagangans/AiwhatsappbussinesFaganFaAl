import { listOrders, getOrder, updateOrderStatus } from "../../lib/orders.js";

export const info = {
  name: "Kelola Pesanan",

  menu: ["Listpesanan", "Detailpesanan", "Updatepesanan"],
  case: ["listpesanan", "detailpesanan", "updatepesanan"],

  description: "Kelola pesanan masuk dari pelanggan (khusus Owner)",
  hidden: false,

  owner: true,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

export default async function handler(leni) {
  const { command, q, LenwyText } = leni;

  switch (command) {
    case "listpesanan": {
      const orders = listOrders();
      if (!orders.length) return LenwyText("📭 Belum ada pesanan masuk.");
      const recent = orders.slice(-15).reverse();
      const text = recent
        .map(
          (o) =>
            `#${o.id} - ${o.product} x${o.qty} - ${o.status}\n  ${o.customerName} (wa.me/${o.customerId.split("@")[0]})`,
        )
        .join("\n\n");
      return LenwyText(`📋 *PESANAN TERBARU*\n\n${text}\n\nKetik *.detailpesanan <id>* untuk detail lengkap.`);
    }

    case "detailpesanan": {
      if (!q) return LenwyText("☘️ *Contoh:* .detailpesanan 1001");
      const order = getOrder(q);
      if (!order) return LenwyText("⚠️ Pesanan tidak ditemukan.");
      return LenwyText(
        `📦 *DETAIL PESANAN #${order.id}*\n\n` +
          `Status: *${order.status}*\n` +
          `Produk: ${order.product} x${order.qty}\n` +
          `Total: Rp${order.total.toLocaleString("id-ID")}\n` +
          `Nama: ${order.customerName}\n` +
          `Alamat: ${order.customerAddress}\n` +
          `Kontak: wa.me/${order.customerId.split("@")[0]}\n` +
          `Waktu: ${new Date(order.createdAt).toLocaleString("id-ID")}`,
      );
    }

    case "updatepesanan": {
      const parts = q.split("|").map((v) => v.trim());
      if (parts.length < 2) {
        return LenwyText("☘️ *Contoh:* .updatepesanan 1001|Sedang Diproses");
      }
      const [id, status] = parts;
      const updated = updateOrderStatus(id, status);
      return LenwyText(
        updated
          ? `✅ Status pesanan #${updated.id} diubah jadi *${updated.status}*.`
          : "⚠️ Pesanan tidak ditemukan.",
      );
    }
  }
}
