// Jalankan dengan: node reset-login.js
// Fungsi: Menghapus akun login dashboard agar otomatis dibuat ulang
// (dengan password acak baru, dicetak sekali ke console) saat npm start
// dijalankan lagi. Set ADMIN_PASSWORD di environment jika ingin password
// awal yang spesifik.
// Data bisnis (produk, order, customer, dll) TIDAK akan terhapus.

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "WhatsApp/database/business/business.db");

const db = new Database(dbPath);
db.prepare("DELETE FROM dashboard_users").run();
db.close();

console.log("✔ Akun login dashboard berhasil direset.");
console.log("Jalankan 'npm start' — password admin baru (acak, atau dari ADMIN_PASSWORD");
console.log("env var jika diset) akan dicetak sekali ke console saat aplikasi start.");
console.log("Setelah login, segera ganti password lewat menu Pengaturan.");
