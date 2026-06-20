# Setup VPS - WhatsApp Business CS Bot

## Persyaratan
- Node.js 18+ 
- npm atau yarn
- PM2 (process manager)

## Langkah Install

### 1. Clone & Install
```bash
git clone <repo-url> /opt/wa-business
cd /opt/wa-business
npm install
```

### 2. Konfigurasi Environment
```bash
cp .env.example .env
nano .env
```

Isi minimal:
```
DASHBOARD_PORT=3000
JWT_SECRET=ganti-dengan-random-string-panjang
```

Opsional (AI provider):
```
AI_PROVIDER=free
AI_API_KEY=
```

### 3. Install PM2
```bash
npm install -g pm2
```

### 4. Jalankan
```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### 5. Akses Dashboard
Buka browser: `http://IP-VPS:3000`

Login default: `admin` / `admin123`

## Perintah PM2
```bash
pm2 status          # Cek status
pm2 logs            # Lihat log
pm2 restart all     # Restart
pm2 stop all        # Stop
```

## Firewall
Pastikan port 3000 terbuka:
```bash
ufw allow 3000
```

## Reverse Proxy (Opsional)
Untuk domain dengan HTTPS, gunakan Nginx + Certbot:
```bash
apt install nginx certbot python3-certbot-nginx
```
