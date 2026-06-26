<div align="center">

# 🎁 WhatsApp Business CS Bot
### by Fagan

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-18%2B-brightgreen.svg)

**Bot WhatsApp Customer Service siap pakai untuk bisnis** — lengkap dengan dashboard CRM, manajemen order, tiket support, broadcast, FAQ otomatis, dan AI Assistant.

</div>

---

## 📚 Daftar Isi

* [Tentang](#-tentang)
* [Fitur Utama](#-fitur-utama)
* [Instalasi Cepat](#-instalasi-cepat)
* [Struktur Proyek](#-struktur-proyek)
* [Konfigurasi](#-konfigurasi)
* [Catatan Penting](#-catatan-penting)
* [Lisensi & Credits](#-lisensi--credits)

---

## 📑 Tentang

**WhatsApp Business CS Bot** adalah sistem customer service otomatis berbasis WhatsApp untuk bisnis kecil-menengah. Satu bot WhatsApp terhubung ke dashboard web yang memudahkan pemilik bisnis mengelola pelanggan, produk, order, tiket support, dan broadcast pesan — semuanya dari satu tempat, tanpa perlu coding.

Bot otomatis membalas chat pelanggan: menampilkan katalog produk, memproses pesanan, membuka tiket bantuan, menjawab FAQ, dan (opsional) menjawab pertanyaan bebas memakai AI Assistant.

---

## 🌟 Fitur Utama

| Fitur | Keterangan |
|---|---|
| 📊 **Dashboard Web** | Kelola semuanya lewat browser — tidak perlu sentuh kode |
| 👥 **CRM Pelanggan** | Riwayat chat, tag, catatan, dan status blokir per pelanggan |
| 🛒 **Manajemen Produk & Order** | Katalog produk dengan foto, proses order otomatis lewat chat |
| 🎫 **Tiket Support** | Pelanggan bisa buka tiket bantuan, prioritas otomatis terdeteksi |
| 📢 **Broadcast** | Kirim pesan massal ke pelanggan dengan rate-limit & jadwal aman |
| ❓ **FAQ Otomatis** | Bot menjawab pertanyaan umum tanpa perlu admin standby |
| 🤖 **AI Assistant** | Jawab pertanyaan bebas pelanggan dengan AI (opsional, bisa pakai provider gratis) |
| 📈 **Analytics** | Statistik chat, order, dan kepuasan pelanggan di dashboard |
| 🔁 **Multi-Bot** | Satu dashboard bisa mengelola beberapa nomor WhatsApp sekaligus |
| 🔒 **Rate Limiter & Circuit Breaker** | Mencegah pola kirim pesan yang berisiko diblokir WhatsApp |

---

## 🚀 Instalasi Cepat

```bash
# 1. Masuk ke folder proyek
cd nama-folder-bot

# 2. Install dependencies
npm install

# 3. Siapkan file konfigurasi
cp .env.example .env
nano .env   # isi DASHBOARD_PORT dan JWT_SECRET (wajib diganti!)

# 4. Jalankan
npm start
```

Lalu buka `http://localhost:3000` di browser, login dengan `admin` / `admin123`, lalu tambahkan bot WhatsApp lewat menu **Tambah Bot** (scan QR Code).

> Panduan lengkap deploy ke VPS (PM2, reverse proxy, firewall) ada di [`SETUP-VPS.md`](./SETUP-VPS.md).

---

## 📂 Struktur Proyek

```
├── 📁 dashboard          # Dashboard web (Express + REST API)
│   ├── 📁 public         # Frontend dashboard (HTML/JS)
│   └── 📄 server.js      # API: bot, produk, order, tiket, broadcast, dll
│
├── 📁 WhatsApp
│   ├── 📁 case/business  # Logika inti bot bisnis (CRM, order, AI assistant, dll)
│   ├── 📁 database        # Penyimpanan data (SQLite)
│   ├── 📄 index.js        # Koneksi ke WhatsApp (Baileys)
│   └── 📄 lenwy.js        # Routing & pemrosesan pesan masuk
│
├── 📄 LenwySet.js         # Entry point aplikasi
├── 📄 ecosystem.config.cjs # Konfigurasi PM2
└── 📄 .env.example        # Contoh konfigurasi environment
```

---

## ⚙️ Konfigurasi

File `.env` minimal yang harus diisi:

```env
DASHBOARD_PORT=3000
JWT_SECRET=ganti-dengan-string-acak-yang-panjang-dan-unik
```

AI Assistant (opsional):
```env
AI_PROVIDER=free   # free / gemini / openai
AI_API_KEY=        # isi jika pakai gemini/openai
```

> ⚠️ **Wajib ganti `JWT_SECRET`** sebelum dipakai produksi — jangan biarkan nilai default/placeholder.

---

## ⚠️ Catatan Penting

- Koneksi WhatsApp menggunakan **Baileys** (library tidak resmi/unofficial untuk protokol WhatsApp Web). Ini memungkinkan otomasi tanpa biaya API resmi, tapi membawa risiko bawaan: akun bisa dibatasi/disuspend oleh WhatsApp tanpa pemberitahuan. Gunakan dengan wajar — hindari spam dan volume pesan berlebihan.
- Disarankan login bot via **QR Code** (lebih stabil dibanding pairing code).
- Folder `sessions/` menyimpan kredensial login WhatsApp — jangan dibagikan atau di-commit ke repository publik.

---

## 💡 Rekomendasi: WhatsApp Cloud API (Resmi)

Untuk bisnis yang sudah berjalan stabil dan butuh keamanan jangka panjang, sangat direkomendasikan untuk migrasi ke **WhatsApp Cloud API** — API resmi dari Meta:

| | Baileys (bawaan bot ini) | WhatsApp Cloud API (Resmi) |
|---|---|---|
| **Biaya** | Gratis | 1000 percakapan/bulan gratis, lalu berbayar |
| **Risiko Banned** | Ada | Tidak ada |
| **Koneksi** | Bisa putus, perlu scan QR ulang | Stabil, otomatis |
| **Legalitas** | Tidak resmi | Resmi dan legal |
| **Centang Hijau** | Tidak bisa | Bisa diajukan |

> 📖 Panduan lengkap cara daftar dan setup WhatsApp Cloud API tersedia di file **`Panduan-Setup-WhatsApp-Business-CS-Bot.pdf`** yang disertakan bersama paket ini.

---

## 📄 Lisensi & Credits

Proyek ini didistribusikan oleh **Fagan**, dibangun di atas base **Lenwy SCM** oleh **Lenwy** (wa.me/6283829814737).

Dilisensikan di bawah **MIT License** — lihat [`LICENSE`](./LICENSE) untuk detail lengkap.
