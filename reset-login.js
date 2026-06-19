// Jalankan dengan: node reset-login.js
// Fungsi: Menghapus akun login dashboard agar otomatis dibuat ulang
// menjadi admin / admin123 saat npm start dijalankan lagi.
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
console.log("Jalankan 'npm start', lalu login dengan:");
console.log("  Username : admin");
console.log("  Password : admin123");
console.log("Setelah login, segera ganti password lewat menu Pengaturan.");
