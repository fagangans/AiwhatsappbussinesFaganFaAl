const API = "";

// XSS prevention: escape semua string dari server sebelum dimasukkan ke innerHTML
function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

let token = localStorage.getItem("token");
let currentPage = "dashboard";
let selectedBotId = localStorage.getItem("selectedBotId") || "";
let connectedBots = [];
let userRole = localStorage.getItem("userRole") || "";
let userId = localStorage.getItem("userId") || "";
let viewBotId = localStorage.getItem("viewBotId") || "";
let myBotAccess = [];
let activePoll = null;
let activePairingPoll = null;
let addBotMethod = "code";
let repairBotMethod = "code";

async function api(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  let url = `${API}${path}`;
  if (viewBotId && method === "GET") {
    url += (url.includes("?") ? "&" : "?") + `viewBotId=${encodeURIComponent(viewBotId)}`;
  }
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401) { logout(); throw new Error("Unauthorized"); }
  return res.json();
}

async function uploadImageFile(file) {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`${API}/api/products/upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
  if (res.status === 401) { logout(); throw new Error("Unauthorized"); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload gagal");
  return data.url;
}

async function handleImageUpload(event, previewId, urlInputId) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) return toast("File harus berupa gambar", "error");
  try {
    const url = await uploadImageFile(file);
    const urlInput = document.getElementById(urlInputId);
    const preview = document.getElementById(previewId);
    if (urlInput) urlInput.value = url;
    if (preview) { preview.src = url; preview.style.display = "block"; }
    toast("Foto berhasil diupload");
  } catch (e) {
    toast(e.message || "Upload foto gagal", "error");
  }
}

// ===== READ-ONLY VIEW MODE (client viewing a bot it was granted access to) =====
function applyViewMode() {
  document.body.classList.toggle("view-only", !!viewBotId);
  const banner = document.getElementById("viewBanner");
  if (!banner) return;
  if (viewBotId) {
    const access = myBotAccess.find(a => a.bot_id === viewBotId);
    document.getElementById("viewBannerBotName").textContent = access ? access.bot_name : viewBotId;
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }
}

async function loadMyBotAccess() {
  if (userRole === "admin") return;
  try { myBotAccess = await api("/api/my-bot-access"); } catch { myBotAccess = []; }
  const wrap = document.getElementById("viewSwitcherWrap");
  if (!wrap) return;
  if (!myBotAccess.length) { wrap.classList.add("hidden"); return; }
  wrap.classList.remove("hidden");
  const sel = document.getElementById("viewSwitcher");
  sel.innerHTML = `<option value="">Data Saya</option>` + myBotAccess.map(b => `<option value="${esc(b.bot_id)}" ${b.bot_id === viewBotId ? "selected" : ""}>${esc(b.bot_name)} (Read-Only)</option>`).join("");
  applyViewMode();
}

function onViewSwitch(val) {
  viewBotId = val;
  localStorage.setItem("viewBotId", viewBotId);
  applyViewMode();
  const sel = document.getElementById("viewSwitcher");
  if (sel) sel.value = viewBotId;
  toast(viewBotId ? "Mode lihat data bot diaktifkan (read-only)" : "Kembali ke data Anda sendiri");
  showPage(currentPage);
}

function toast(msg, type = "success") {
  const div = document.createElement("div");
  div.className = `toast ${type === "success" ? "bg-green-500" : type === "error" ? "bg-red-500" : "bg-blue-500"}`;
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

function formatCurrency(n) { return `Rp${Number(n || 0).toLocaleString("id-ID")}`; }
function formatDate(d) { return d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"; }

async function loadBots() {
  try {
    connectedBots = await api("/api/bots");
    const sel = document.getElementById("botSelector");
    if (!sel) return;
    sel.innerHTML = connectedBots.length === 0
      ? '<option value="">Tidak ada bot</option>'
      : connectedBots.map(b => `<option value="${esc(b.id)}" ${b.id === selectedBotId ? "selected" : ""}>${esc(b.name)} (${b.connected ? "Online" : "Offline"})</option>`).join("");
    if (connectedBots.length > 0 && !connectedBots.find(b => b.id === selectedBotId)) {
      selectedBotId = connectedBots[0].id;
      localStorage.setItem("selectedBotId", selectedBotId);
    }
    const badge = document.getElementById("botCount");
    const onlineCount = connectedBots.filter(b => b.connected).length;
    if (badge) badge.textContent = `${onlineCount}/${connectedBots.length} bot online`;
  } catch { /* not logged in yet */ }
}

function onBotSelect(val) {
  selectedBotId = val;
  localStorage.setItem("selectedBotId", val);
}

function showModal(html) {
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("modal").classList.remove("hidden");
  document.getElementById("modal").classList.add("flex");
}

function closeModal() {
  if (activePoll) { clearInterval(activePoll); activePoll = null; }
  if (activePairingPoll) { clearInterval(activePairingPoll); activePairingPoll = null; }
  document.getElementById("modal").classList.add("hidden");
  document.getElementById("modal").classList.remove("flex");
}

// Polling generik: cek QR/status koneksi bot tiap 3s sampai connected atau modal ditutup
function pollBotQr(botId, imgElId) {
  if (activePoll) clearInterval(activePoll);
  async function checkQr() {
    try {
      const res = await api(`/api/bots/${botId}/qr-code`);
      if (res.connected) {
        clearInterval(activePoll);
        activePoll = null;
        toast("Bot berhasil terhubung!", "success");
        closeModal();
        loadBots();
        return;
      }
      if (res.error) {
        clearInterval(activePoll);
        activePoll = null;
        toast("Gagal memulai koneksi: " + res.error, "error");
        return;
      }
      const img = document.getElementById(imgElId);
      if (res.qr && img) {
        img.src = res.qr;
        img.style.display = "block";
        const loader = document.getElementById(imgElId + "Loader");
        if (loader) loader.style.display = "none";
      }
    } catch (_) {}
  }
  checkQr();
  activePoll = setInterval(checkQr, 3000);
}

// Polling generik: cek pairing code/status koneksi bot tiap 3s. Backend bisa
// auto-retry minta kode baru kalau pairing gagal sementara (401 transient),
// jadi kode yang tampil di modal harus ikut update tanpa perlu klik ulang.
function pollPairingCode(botId, codeElId) {
  if (activePairingPoll) clearInterval(activePairingPoll);
  let lastCode = null;
  async function checkCode() {
    try {
      const res = await api(`/api/bots/${botId}/pairing-code`);
      if (res.connected) {
        clearInterval(activePairingPoll);
        activePairingPoll = null;
        toast("Bot berhasil terhubung!", "success");
        closeModal();
        loadBots();
        return;
      }
      if (res.error) {
        clearInterval(activePairingPoll);
        activePairingPoll = null;
        toast("Gagal memulai koneksi: " + res.error, "error");
        return;
      }
      const el = document.getElementById(codeElId);
      if (res.code && el && res.code !== lastCode) {
        lastCode = res.code;
        el.textContent = res.code;
      }
    } catch (_) {}
  }
  activePairingPoll = setInterval(checkCode, 3000);
}

document.getElementById("modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });

function statusBadge(status) {
  const map = {
    pending: "badge-yellow", confirmed: "badge-blue", processing: "badge-blue",
    shipped: "badge-blue", delivered: "badge-green", cancelled: "badge-red",
    open: "badge-yellow", in_progress: "badge-blue", resolved: "badge-green", closed: "badge-gray",
    paid: "badge-green", unpaid: "badge-red",
  };
  const label = {
    pending: "Pending", confirmed: "Dikonfirmasi", processing: "Diproses",
    shipped: "Dikirim", delivered: "Selesai", cancelled: "Dibatalkan",
    open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed",
    paid: "Lunas", unpaid: "Belum Bayar",
  };
  return `<span class="badge ${map[status] || "badge-gray"}">${label[status] || status}</span>`;
}

// ===== AUTH =====
async function login() {
  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;
  try {
    const data = await fetch(`${API}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }).then(r => r.json());
    if (data.error) {
      document.getElementById("loginError").textContent = data.error;
      document.getElementById("loginError").classList.remove("hidden");
      return;
    }
    token = data.token;
    localStorage.setItem("token", token);
    userRole = data.user.role || "client";
    userId = data.user.id || "";
    localStorage.setItem("userRole", userRole);
    localStorage.setItem("userId", userId);
    document.getElementById("userName").textContent = data.user.name;
    applyRole();
    showDashboard();
  } catch (e) {
    document.getElementById("loginError").textContent = "Koneksi gagal";
    document.getElementById("loginError").classList.remove("hidden");
  }
}

function logout() {
  token = null;
  userRole = "";
  userId = "";
  viewBotId = "";
  myBotAccess = [];
  localStorage.removeItem("token");
  localStorage.removeItem("userRole");
  localStorage.removeItem("userId");
  localStorage.removeItem("viewBotId");
  document.body.classList.remove("role-admin", "view-only");
  document.getElementById("loginPage").classList.remove("hidden");
  document.getElementById("mainApp").classList.add("hidden");
}

function applyRole() {
  if (userRole === "admin") {
    document.body.classList.add("role-admin");
  } else {
    document.body.classList.remove("role-admin");
  }
}

function showDashboard() {
  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById("mainApp").classList.remove("hidden");
  document.getElementById("currentDate").textContent = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  applyViewMode();
  loadBots();
  loadMyBotAccess();
  updateImportantBadge();
  setInterval(loadBots, 15000);
  setInterval(updateImportantBadge, 30000);
  const wsToken = localStorage.getItem("token") || "";
  const ws = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}?token=${encodeURIComponent(wsToken)}`);
  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === "important_message") {
        updateImportantBadge();
        toast(`Pesan penting baru dari ${data.data.customer_name || "customer"}`, "info");
      }
    } catch {}
  };
  showPage("dashboard");
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sidebarBackdrop").classList.toggle("open");
}

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarBackdrop").classList.remove("open");
}

// ===== PAGE ROUTER =====
async function showPage(page) {
  currentPage = page;
  closeSidebar();
  document.querySelectorAll(".sidebar-link").forEach(l => l.classList.remove("active"));
  document.querySelector(`[data-page="${page}"]`)?.classList.add("active");
  const titles = {
    dashboard: "Dashboard", products: "Produk", orders: "Order", customers: "Customer",
    tickets: "Tiket Support", faq: "FAQ", templates: "Template", broadcast: "Broadcast",
    agents: "Agents", vouchers: "Voucher", paymentmethods: "Pembayaran",
    loyalty: "Loyalty & Poin", referral: "Referral", bundles: "Paket Combo",
    botmanager: "Kelola Bot", important: "Pesan Penting", analytics: "Analytics",
    clients: "Kelola Client", settings: "Pengaturan Bisnis",
    automation: "Automation Rules", inbox: "Shared Inbox", handoffs: "Handoff CS",
  };
  document.getElementById("pageTitle").textContent = titles[page] || page;
  const descriptions = {
    dashboard: "Ringkasan performa bisnis dan statistik harian.",
    products: "Kelola katalog produk yang ditampilkan ke customer.",
    orders: "Lihat dan proses pesanan masuk dari customer.",
    customers: "Daftar customer yang pernah menghubungi bot.",
    tickets: "Kelola tiket support dan keluhan dari customer.",
    faq: "Atur pertanyaan umum yang sering ditanyakan customer.",
    templates: "Buat template pesan untuk balasan cepat.",
    broadcast: "Kirim pesan massal ke semua atau sebagian customer.",
    agents: "Kelola agen CS yang menangani chat customer.",
    vouchers: "Buat dan kelola kode voucher/diskon untuk pelanggan.",
    paymentmethods: "Atur metode pembayaran yang ditawarkan ke customer saat checkout.",
    loyalty: "Kelola sistem poin loyalitas — customer dapat poin setiap belanja, tukar jadi diskon.",
    referral: "Program referral — customer ajak teman, keduanya dapat reward.",
    bundles: "Buat paket combo produk dengan harga spesial untuk naikkan penjualan.",
    botmanager: "Tambah, hapus, atau atur bot WhatsApp yang terhubung.",
    important: "Pesan masuk yang terdeteksi penting atau mendesak.",
    analytics: "Grafik dan statistik performa bot secara detail.",
    clients: "Kelola akun client yang menggunakan layanan ini.",
    settings: "Atur profil bisnis, jam operasional, dan fitur bot.",
    automation: "Buat aturan otomatis: keyword trigger, auto-reply, tag otomatis, notifikasi agent.",
    inbox: "Shared inbox — lihat semua chat masuk, klaim, dan balas dari dashboard.",
    handoffs: "Riwayat handoff dari AI ke CS manusia.",
  };
  const descText = descriptions[page] || "";
  document.getElementById("pageDesc").innerHTML = descText ? `<i class="fas fa-circle-info"></i> ${descText}` : "";
  const content = document.getElementById("pageContent");
  content.innerHTML = '<div class="text-center py-12 text-gray-400"><i class="fas fa-spinner fa-spin text-3xl"></i></div>';
  try {
    switch (page) {
      case "dashboard": await renderDashboard(content); break;
      case "products": await renderProducts(content); break;
      case "orders": await renderOrders(content); break;
      case "customers": await renderCustomers(content); break;
      case "tickets": await renderTickets(content); break;
      case "faq": await renderFaq(content); break;
      case "templates": await renderTemplates(content); break;
      case "broadcast": await renderBroadcast(content); break;
      case "agents": await renderAgents(content); break;
      case "vouchers": await renderVouchers(content); break;
      case "paymentmethods": await renderPaymentMethods(content); break;
      case "loyalty": await renderLoyalty(content); break;
      case "referral": await renderReferral(content); break;
      case "bundles": await renderBundles(content); break;
      case "botmanager": await renderBotManager(content); break;
      case "important": await renderImportant(content); break;
      case "analytics": await renderAnalytics(content); break;
      case "clients": if (userRole === "admin") { await renderClients(content); } else { content.innerHTML = '<div class="text-red-500">Akses ditolak</div>'; } break;
      case "settings": await renderSettings(content); break;
      case "automation": await renderAutomation(content); break;
      case "inbox": await renderInbox(content); break;
      case "handoffs": await renderHandoffs(content); break;
    }
  } catch (e) { content.innerHTML = `<div class="text-red-500">Error: ${e.message}</div>`; }
}

// ===== DASHBOARD =====
async function renderDashboard(el) {
  const stats = await api("/api/dashboard");
  const profile = await api("/api/profile");
  document.getElementById("sidebarBizName").textContent = profile.name || "Business CS";
  el.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="card stat-card p-5">
        <div class="flex items-center justify-between">
          <div><p class="text-sm text-gray-500">Total Customer</p><p class="text-2xl font-bold text-gray-800">${stats.total_customers}</p><p class="text-xs text-green-500">+${stats.new_customers_today} hari ini</p></div>
          <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center"><i class="fas fa-users text-blue-500"></i></div>
        </div>
      </div>
      <div class="card stat-card p-5">
        <div class="flex items-center justify-between">
          <div><p class="text-sm text-gray-500">Order Pending</p><p class="text-2xl font-bold text-yellow-600">${stats.orders.pending}</p><p class="text-xs text-gray-400">dari ${stats.orders.total_orders} total</p></div>
          <div class="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center"><i class="fas fa-shopping-cart text-yellow-500"></i></div>
        </div>
      </div>
      <div class="card stat-card p-5">
        <div class="flex items-center justify-between">
          <div><p class="text-sm text-gray-500">Revenue Hari Ini</p><p class="text-2xl font-bold text-green-600">${formatCurrency(stats.revenue_today)}</p><p class="text-xs text-gray-400">Total: ${formatCurrency(stats.orders.total_revenue)}</p></div>
          <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center"><i class="fas fa-dollar-sign text-green-500"></i></div>
        </div>
      </div>
      <div class="card stat-card p-5">
        <div class="flex items-center justify-between">
          <div><p class="text-sm text-gray-500">Tiket Open</p><p class="text-2xl font-bold text-red-600">${stats.tickets.open_tickets}</p><p class="text-xs text-gray-400">In Progress: ${stats.tickets.in_progress}</p></div>
          <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center"><i class="fas fa-ticket-alt text-red-500"></i></div>
        </div>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <div class="card p-5">
        <h3 class="font-bold text-gray-800 mb-4"><i class="fas fa-chart-pie mr-2 text-blue-500"></i>Ringkasan Order</h3>
        <div class="space-y-3">
          <div class="flex justify-between items-center"><span class="text-sm text-gray-600">Pending</span><span class="font-bold text-yellow-600">${stats.orders.pending}</span></div>
          <div class="flex justify-between items-center"><span class="text-sm text-gray-600">Dikonfirmasi</span><span class="font-bold text-blue-600">${stats.orders.confirmed}</span></div>
          <div class="flex justify-between items-center"><span class="text-sm text-gray-600">Diproses</span><span class="font-bold text-blue-600">${stats.orders.processing}</span></div>
          <div class="flex justify-between items-center"><span class="text-sm text-gray-600">Dikirim</span><span class="font-bold text-indigo-600">${stats.orders.shipped}</span></div>
          <div class="flex justify-between items-center"><span class="text-sm text-gray-600">Selesai</span><span class="font-bold text-green-600">${stats.orders.delivered}</span></div>
          <div class="flex justify-between items-center"><span class="text-sm text-gray-600">Dibatalkan</span><span class="font-bold text-red-600">${stats.orders.cancelled}</span></div>
        </div>
      </div>
      <div class="card p-5">
        <h3 class="font-bold text-gray-800 mb-4"><i class="fas fa-info-circle mr-2 text-green-500"></i>Info Bisnis</h3>
        <div class="space-y-2 text-sm">
          <p><span class="text-gray-500">Nama:</span> <span class="font-medium">${profile.name || "Belum diatur"}</span></p>
          <p><span class="text-gray-500">Kategori:</span> <span class="font-medium">${profile.category || "-"}</span></p>
          <p><span class="text-gray-500">Telepon:</span> <span class="font-medium">${profile.phone || "-"}</span></p>
          <p><span class="text-gray-500">Email:</span> <span class="font-medium">${profile.email || "-"}</span></p>
          <p><span class="text-gray-500">Jam Operasional:</span> <span class="font-medium">${String(profile.open_hour).padStart(2,"0")}:00 - ${String(profile.close_hour).padStart(2,"0")}:00</span></p>
          <p><span class="text-gray-500">Pesan Hari Ini:</span> <span class="font-medium">${stats.messages_today}</span></p>
          <p><span class="text-gray-500">Kepuasan:</span> <span class="font-medium">${stats.satisfaction_avg}/5 ⭐</span></p>
        </div>
      </div>
    </div>
    <div id="lowStockAlert"></div>`;
  loadLowStockAlert();
}

async function loadLowStockAlert() {
  try {
    const lowStock = await api("/api/products/low-stock?threshold=5");
    const el = document.getElementById("lowStockAlert");
    if (!el || lowStock.length === 0) return;
    el.innerHTML = `<div class="card p-4 border-l-4 border-yellow-400 bg-yellow-50">
      <h4 class="font-bold text-yellow-800 mb-2"><i class="fas fa-exclamation-triangle mr-2"></i>Stok Menipis (${lowStock.length} produk)</h4>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        ${lowStock.map(p => `<div class="flex justify-between items-center p-2 bg-white rounded border">
          <span class="text-sm truncate">${p.name}</span>
          <span class="badge ${p.stock <= 0 ? 'badge-red' : 'badge-yellow'} shrink-0">${p.stock <= 0 ? 'Habis' : 'Sisa ' + p.stock}</span>
        </div>`).join("")}
      </div>
    </div>`;
  } catch(e) { /* ignore */ }
}

// ===== PRODUCTS =====
async function renderProducts(el) {
  const products = await api("/api/products");
  const categories = await api("/api/products/categories");
  el.innerHTML = `
    <div class="flex flex-wrap gap-3 mb-4 items-center justify-between">
      <div class="flex gap-2">
        <input type="text" id="productSearch" placeholder="Cari produk..." class="w-64" onkeyup="searchProductDebounce()">
        <select id="productCatFilter" onchange="filterProductsCat()" class="w-40"><option value="">Semua Kategori</option>${categories.map(c=>`<option>${c}</option>`).join("")}</select>
      </div>
      <button onclick="exportCSV('products')" class="btn btn-outline"><i class="fas fa-download mr-1"></i>Export CSV</button>
      <button onclick="showAddProduct()" class="btn btn-primary write-action"><i class="fas fa-plus mr-1"></i>Tambah Produk</button>
    </div>
    <div class="card overflow-x-auto">
      <table>
        <thead><tr><th>SKU</th><th>Nama</th><th>Kategori</th><th>Harga</th><th>Diskon</th><th>Stok</th><th>Aksi</th></tr></thead>
        <tbody id="productsTable">${products.map(p => `
          <tr>
            <td class="font-mono text-xs">${p.sku || "-"}</td>
            <td class="font-medium">${p.name}</td>
            <td>${p.category}</td>
            <td>${formatCurrency(p.price)}</td>
            <td>${p.discount_price > 0 ? formatCurrency(p.discount_price) : "-"}</td>
            <td><span class="${p.stock <= 0 ? "text-red-500 font-bold" : p.stock <= 5 ? "text-yellow-500 font-bold" : "text-green-600"}">${p.stock}</span></td>
            <td class="space-x-1">
              <button onclick="showVariants(${p.id},'${p.name.replace(/'/g, "\\'")}')" class="btn btn-warning text-xs py-1 px-2 write-action" title="Varian"><i class="fas fa-palette"></i></button>
              <button onclick="showGallery(${p.id},'${p.name.replace(/'/g, "\\'")}')" class="btn btn-outline text-xs py-1 px-2 write-action" title="Galeri Foto"><i class="fas fa-images"></i></button>
              <button onclick="editProduct(${p.id})" class="btn btn-outline text-xs py-1 px-2 write-action"><i class="fas fa-edit"></i></button>
              <button onclick="delProduct(${p.id},'${p.name}')" class="btn btn-danger text-xs py-1 px-2 write-action"><i class="fas fa-trash"></i></button>
            </td>
          </tr>`).join("")}</tbody>
      </table>
      ${products.length === 0 ? '<p class="text-center py-8 text-gray-400">Belum ada produk</p>' : ""}
    </div>`;
}

let searchProductTimer;
function searchProductDebounce() { clearTimeout(searchProductTimer); searchProductTimer = setTimeout(async () => {
  const q = document.getElementById("productSearch").value;
  const products = q ? await api(`/api/products?search=${encodeURIComponent(q)}`) : await api("/api/products");
  document.getElementById("productsTable").innerHTML = products.map(p => `<tr><td class="font-mono text-xs">${esc(p.sku)||"-"}</td><td class="font-medium">${esc(p.name)}</td><td>${esc(p.category)}</td><td>${formatCurrency(p.price)}</td><td>${p.discount_price>0?formatCurrency(p.discount_price):"-"}</td><td><span class="${p.stock<=0?"text-red-500 font-bold":p.stock<=5?"text-yellow-500 font-bold":"text-green-600"}">${p.stock}</span></td><td class="space-x-1"><button onclick="editProduct(${p.id})" class="btn btn-outline text-xs py-1 px-2 write-action"><i class="fas fa-edit"></i></button><button onclick="delProduct(${p.id},${JSON.stringify(String(p.name||''))})" class="btn btn-danger text-xs py-1 px-2 write-action"><i class="fas fa-trash"></i></button></td></tr>`).join("");
}, 300); }

async function filterProductsCat() {
  const cat = document.getElementById("productCatFilter").value;
  const products = cat ? await api(`/api/products?category=${encodeURIComponent(cat)}`) : await api("/api/products");
  document.getElementById("productsTable").innerHTML = products.map(p => `<tr><td class="font-mono text-xs">${esc(p.sku)||"-"}</td><td class="font-medium">${esc(p.name)}</td><td>${esc(p.category)}</td><td>${formatCurrency(p.price)}</td><td>${p.discount_price>0?formatCurrency(p.discount_price):"-"}</td><td><span class="${p.stock<=0?"text-red-500 font-bold":p.stock<=5?"text-yellow-500 font-bold":"text-green-600"}">${p.stock}</span></td><td class="space-x-1"><button onclick="editProduct(${p.id})" class="btn btn-outline text-xs py-1 px-2 write-action"><i class="fas fa-edit"></i></button><button onclick="delProduct(${p.id},${JSON.stringify(String(p.name||''))})" class="btn btn-danger text-xs py-1 px-2 write-action"><i class="fas fa-trash"></i></button></td></tr>`).join("");
}

async function showAddProduct() {
  const categories = await api("/api/products/categories").catch(() => []);
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-plus mr-2 text-blue-500"></i>Tambah Produk</h3>
    <div class="space-y-3">
      <div><label class="block text-sm font-medium mb-1">SKU</label><input id="pSku" placeholder="KP001"></div>
      <div><label class="block text-sm font-medium mb-1">Nama *</label><input id="pName" placeholder="Nama Produk"></div>
      <div><label class="block text-sm font-medium mb-1">Deskripsi</label><textarea id="pDesc" rows="2" placeholder="Deskripsi produk"></textarea></div>
      <div>
        <label class="block text-sm font-medium mb-1">Foto Produk</label>
        <input type="file" id="pImageFile" accept="image/*" onchange="handleImageUpload(event, 'pImagePreview', 'pImageUrl')">
        <input type="hidden" id="pImageUrl" value="">
        <img id="pImagePreview" class="mt-2 rounded-lg max-h-32 object-cover" style="display:none">
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label class="block text-sm font-medium mb-1">Harga *</label><input id="pPrice" type="number" placeholder="50000"></div>
        <div><label class="block text-sm font-medium mb-1">Harga Diskon</label><input id="pDiscount" type="number" placeholder="0"></div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label class="block text-sm font-medium mb-1">Stok</label><input id="pStock" type="number" placeholder="100"></div>
        <div>
          <label class="block text-sm font-medium mb-1">Kategori</label>
          <input id="pCategory" list="categoryList" placeholder="Umum" autocomplete="off">
          <datalist id="categoryList">${categories.map(c => `<option value="${c}">`).join("")}</datalist>
        </div>
      </div>
      <div class="flex gap-2 justify-end mt-4">
        <button onclick="closeModal()" class="btn btn-outline">Batal</button>
        <button onclick="saveProduct()" class="btn btn-primary">Simpan</button>
      </div>
    </div>`);
}

async function saveProduct() {
  const data = { sku: document.getElementById("pSku").value, name: document.getElementById("pName").value, description: document.getElementById("pDesc").value, price: parseFloat(document.getElementById("pPrice").value) || 0, discount_price: parseFloat(document.getElementById("pDiscount").value) || 0, stock: parseInt(document.getElementById("pStock").value) || 0, category: document.getElementById("pCategory").value || "Umum", image_url: document.getElementById("pImageUrl").value || "" };
  if (!data.name || !data.price) return toast("Nama dan harga wajib diisi", "error");
  try { await api("/api/products", { method: "POST", body: data }); closeModal(); toast("Produk berhasil ditambahkan"); showPage("products"); } catch(e) { toast(e.message, "error"); }
}

async function editProduct(id) {
  const [p, categories] = await Promise.all([api(`/api/products/${id}`), api("/api/products/categories").catch(() => [])]);
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-edit mr-2 text-blue-500"></i>Edit Produk</h3>
    <div class="space-y-3">
      <div><label class="block text-sm font-medium mb-1">SKU</label><input id="pSku" value="${p.sku||""}"></div>
      <div><label class="block text-sm font-medium mb-1">Nama *</label><input id="pName" value="${p.name}"></div>
      <div><label class="block text-sm font-medium mb-1">Deskripsi</label><textarea id="pDesc" rows="2">${p.description||""}</textarea></div>
      <div>
        <label class="block text-sm font-medium mb-1">Foto Produk</label>
        <input type="file" id="pImageFile" accept="image/*" onchange="handleImageUpload(event, 'pImagePreview', 'pImageUrl')">
        <input type="hidden" id="pImageUrl" value="${p.image_url||""}">
        <img id="pImagePreview" class="mt-2 rounded-lg max-h-32 object-cover" style="${p.image_url ? "" : "display:none"}" src="${p.image_url||""}">
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label class="block text-sm font-medium mb-1">Harga *</label><input id="pPrice" type="number" value="${p.price}"></div>
        <div><label class="block text-sm font-medium mb-1">Harga Diskon</label><input id="pDiscount" type="number" value="${p.discount_price||0}"></div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label class="block text-sm font-medium mb-1">Stok</label><input id="pStock" type="number" value="${p.stock}"></div>
        <div>
          <label class="block text-sm font-medium mb-1">Kategori</label>
          <input id="pCategory" list="categoryList" value="${p.category}" autocomplete="off">
          <datalist id="categoryList">${categories.map(c => `<option value="${c}">`).join("")}</datalist>
        </div>
      </div>
      <div class="flex gap-2 justify-end mt-4">
        <button onclick="closeModal()" class="btn btn-outline">Batal</button>
        <button onclick="updateProd(${id})" class="btn btn-primary">Simpan</button>
      </div>
    </div>`);
}

async function updateProd(id) {
  const data = { sku: document.getElementById("pSku").value, name: document.getElementById("pName").value, description: document.getElementById("pDesc").value, price: parseFloat(document.getElementById("pPrice").value), discount_price: parseFloat(document.getElementById("pDiscount").value) || 0, stock: parseInt(document.getElementById("pStock").value) || 0, category: document.getElementById("pCategory").value || "Umum", image_url: document.getElementById("pImageUrl").value || "" };
  await api(`/api/products/${id}`, { method: "PUT", body: data }); closeModal(); toast("Produk diperbarui"); showPage("products");
}

async function delProduct(id, name) { if (!confirm(`Hapus produk "${name}"?`)) return; await api(`/api/products/${id}`, { method: "DELETE" }); toast("Produk dihapus"); showPage("products"); }

// ===== ORDERS =====
async function renderOrders(el) {
  const orders = await api("/api/orders");
  const stats = await api("/api/orders/stats");
  el.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <div class="card p-3 text-center"><p class="text-xs text-gray-500">Pending</p><p class="text-xl font-bold text-yellow-600">${stats.pending}</p></div>
      <div class="card p-3 text-center"><p class="text-xs text-gray-500">Proses</p><p class="text-xl font-bold text-blue-600">${stats.processing}</p></div>
      <div class="card p-3 text-center"><p class="text-xs text-gray-500">Selesai</p><p class="text-xl font-bold text-green-600">${stats.delivered}</p></div>
      <div class="card p-3 text-center"><p class="text-xs text-gray-500">Revenue</p><p class="text-xl font-bold text-green-700">${formatCurrency(stats.total_revenue)}</p></div>
    </div>
    <div class="flex gap-2 mb-4 items-center justify-between">
      <select id="orderFilter" onchange="filterOrders()" class="w-48"><option value="">Semua Status</option><option value="pending">Pending</option><option value="confirmed">Dikonfirmasi</option><option value="processing">Diproses</option><option value="shipped">Dikirim</option><option value="delivered">Selesai</option><option value="cancelled">Dibatalkan</option></select>
      <button onclick="exportCSV('orders')" class="btn btn-outline"><i class="fas fa-download mr-1"></i>Export CSV</button>
    </div>
    <div class="card overflow-x-auto">
      <table>
        <thead><tr><th>No. Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Bayar</th><th>Tanggal</th><th>Aksi</th></tr></thead>
        <tbody id="ordersTable">${orders.map(o => `<tr>
          <td class="font-mono text-xs font-medium">${o.order_number}</td>
          <td>${o.customer_name}</td>
          <td class="font-medium">${formatCurrency(o.total)}</td>
          <td>${statusBadge(o.status)}</td>
          <td>${statusBadge(o.payment_status)}</td>
          <td class="text-xs text-gray-500">${formatDate(o.created_at)}</td>
          <td class="space-x-1">
            <button onclick="viewOrder('${o.order_number}')" class="btn btn-outline text-xs py-1 px-2"><i class="fas fa-eye"></i></button>
            <button onclick="changeOrderStatus('${o.order_number}','${o.status}')" class="btn btn-primary text-xs py-1 px-2 write-action"><i class="fas fa-edit"></i></button>
            ${o.payment_status !== "paid" ? `<button onclick="confirmPay('${o.order_number}')" class="btn btn-success text-xs py-1 px-2 write-action" title="Konfirmasi bayar"><i class="fas fa-check"></i></button>` : ""}
          </td>
        </tr>`).join("")}</tbody>
      </table>
      ${orders.length === 0 ? '<p class="text-center py-8 text-gray-400">Belum ada order</p>' : ""}
    </div>`;
}

async function filterOrders() { const s = document.getElementById("orderFilter").value; const orders = await api(`/api/orders${s?"?status="+s:""}`); document.getElementById("ordersTable").innerHTML = orders.map(o => `<tr><td class="font-mono text-xs font-medium">${esc(o.order_number)}</td><td>${esc(o.customer_name)}</td><td class="font-medium">${formatCurrency(o.total)}</td><td>${statusBadge(o.status)}</td><td>${statusBadge(o.payment_status)}</td><td class="text-xs text-gray-500">${formatDate(o.created_at)}</td><td class="space-x-1"><button onclick="viewOrder(${JSON.stringify(String(o.order_number||''))})" class="btn btn-outline text-xs py-1 px-2"><i class="fas fa-eye"></i></button><button onclick="changeOrderStatus(${JSON.stringify(String(o.order_number||''))},${JSON.stringify(String(o.status||''))})" class="btn btn-primary text-xs py-1 px-2 write-action"><i class="fas fa-edit"></i></button>${o.payment_status!=="paid"?`<button onclick="confirmPay(${JSON.stringify(String(o.order_number||''))})" class="btn btn-success text-xs py-1 px-2 write-action"><i class="fas fa-check"></i></button>`:""}</td></tr>`).join(""); }

async function viewOrder(num) {
  const o = await api(`/api/orders/${num}`);
  const items = JSON.parse(o.items || "[]");
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-receipt mr-2 text-blue-500"></i>Detail Order</h3>
    <div class="space-y-2 text-sm">
      <p><b>No. Order:</b> ${o.order_number}</p>
      <p><b>Customer:</b> ${o.customer_name}</p>
      <p><b>Status:</b> ${statusBadge(o.status)}</p>
      <p><b>Pembayaran:</b> ${statusBadge(o.payment_status)}</p>
      <p><b>Tanggal:</b> ${formatDate(o.created_at)}</p>
      ${o.notes ? `<p><b>Catatan:</b> ${o.notes}</p>` : ""}
      ${o.tracking_number ? `<p><b>Resi:</b> ${o.tracking_number}</p>` : ""}
      <hr class="my-3">
      <table class="text-sm"><thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead><tbody>${items.map(i=>`<tr><td>${i.name}${i.variant_name ? ` <span class="badge badge-blue">${i.variant_name}</span>` : ""}</td><td>${i.qty}</td><td>${formatCurrency(i.price)}</td><td>${formatCurrency(i.price*i.qty)}</td></tr>`).join("")}</tbody></table>
      <p class="text-right font-bold text-lg mt-2">Total: ${formatCurrency(o.total)}</p>
    </div>
    <div class="flex justify-end mt-4"><button onclick="closeModal()" class="btn btn-outline">Tutup</button></div>`);
}

function changeOrderStatus(num, current) {
  const statuses = ["pending","confirmed","processing","shipped","delivered","cancelled"];
  showModal(`
    <h3 class="text-lg font-bold mb-4">Update Status Order</h3>
    <p class="text-sm text-gray-500 mb-3">${num}</p>
    <select id="newOrderStatus" class="mb-3">${statuses.map(s=>`<option value="${s}" ${s===current?"selected":""}>${s}</option>`).join("")}</select>
    <label class="flex items-center gap-2 text-sm mb-3"><input type="checkbox" id="notifyCustomer" checked> Notifikasi customer via WhatsApp</label>
    <div class="flex gap-2 justify-end"><button onclick="closeModal()" class="btn btn-outline">Batal</button><button onclick="doUpdateOrder('${num}')" class="btn btn-primary">Update</button></div>`);
}

async function doUpdateOrder(num) { const status = document.getElementById("newOrderStatus").value; const notify = document.getElementById("notifyCustomer").checked; await api(`/api/orders/${num}/status`, { method: "PUT", body: { status, notify, botId: selectedBotId } }); closeModal(); toast("Status order diperbarui"); showPage("orders"); }

async function confirmPay(num) { if (!confirm(`Konfirmasi pembayaran order ${num}?`)) return; await api(`/api/orders/${num}/confirm-payment`, { method: "PUT", body: { botId: selectedBotId } }); toast("Pembayaran dikonfirmasi"); showPage("orders"); }

// ===== CUSTOMERS =====
async function renderCustomers(el) {
  const customers = await api("/api/customers");
  const count = await api("/api/customers/count");
  el.innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <input type="text" id="custSearch" placeholder="Cari customer..." class="w-64" onkeyup="searchCustDebounce()">
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-500">Total: ${count.count}</span>
        <button onclick="exportCSV('customers')" class="btn btn-outline"><i class="fas fa-download mr-1"></i>Export CSV</button>
      </div>
    </div>
    <div class="card overflow-x-auto">
      <table>
        <thead><tr><th>Nama</th><th>Telepon</th><th>Lead</th><th>Poin</th><th>Order</th><th>Total Belanja</th><th>Rating</th><th>Terakhir</th><th>Aksi</th></tr></thead>
        <tbody id="custTable">${customers.map(c => {
          const tags = JSON.parse(c.tags || "[]");
          const tierBadge = c.lead_tier === "hot" ? "badge-red" : c.lead_tier === "warm" ? "badge-yellow" : "badge-gray";
          return `<tr>
            <td class="font-medium">${c.name || "Tanpa Nama"} ${c.is_blocked ? '<span class="badge badge-red">Blokir</span>' : ""}</td>
            <td class="font-mono text-xs">${c.phone}</td>
            <td><span class="badge ${tierBadge}">${(c.lead_tier||'cold').toUpperCase()}</span></td>
            <td class="text-yellow-600 font-medium">${c.loyalty_points || 0}</td>
            <td>${c.total_orders}</td>
            <td>${formatCurrency(c.total_spent)}</td>
            <td>${c.satisfaction_avg ? c.satisfaction_avg.toFixed(1)+"⭐" : "-"}</td>
            <td class="text-xs text-gray-500">${formatDate(c.last_contact)}</td>
            <td><button onclick="viewCustomerDetail(${c.id})" class="btn btn-outline text-xs py-1 px-2"><i class="fas fa-eye"></i></button></td>
          </tr>`; }).join("")}</tbody>
      </table>
      ${customers.length === 0 ? '<p class="text-center py-8 text-gray-400">Belum ada customer</p>' : ""}
    </div>`;
}

let custSearchTimer;
function searchCustDebounce() { clearTimeout(custSearchTimer); custSearchTimer = setTimeout(async () => { const q = document.getElementById("custSearch").value; const customers = q ? await api(`/api/customers?search=${encodeURIComponent(q)}`) : await api("/api/customers"); document.getElementById("custTable").innerHTML = customers.map(c => { const tags = JSON.parse(c.tags||"[]"); return `<tr><td class="font-medium">${c.name ? esc(c.name) : "Tanpa Nama"}</td><td class="font-mono text-xs">${esc(c.phone)}</td><td>${tags.map(t=>`<span class="badge badge-blue">${esc(t)}</span>`).join(" ")}</td><td>${c.total_orders}</td><td>${formatCurrency(c.total_spent)}</td><td>${c.satisfaction_avg?c.satisfaction_avg.toFixed(1)+"⭐":"-"}</td><td class="text-xs text-gray-500">${formatDate(c.last_contact)}</td><td><button onclick="viewCustomer(${c.id},${JSON.stringify(String(c.jid||''))})" class="btn btn-outline text-xs py-1 px-2"><i class="fas fa-eye"></i></button></td></tr>`; }).join(""); }, 300); }

async function viewCustomer(id, jid) {
  const c = await api(`/api/customers/${jid}`);
  const orders = await api(`/api/customers/${id}/orders`);
  const tags = JSON.parse(c.tags || "[]");
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-user mr-2 text-blue-500"></i>${c.name || "Customer"}</h3>
    <div class="space-y-2 text-sm">
      <p><b>Telepon:</b> ${c.phone}</p><p><b>Email:</b> ${c.email||"-"}</p><p><b>Alamat:</b> ${c.address||"-"}</p>
      <p><b>Tags:</b> ${tags.length?tags.join(", "):"-"}</p><p><b>Notes:</b> ${c.notes||"-"}</p>
      <hr class="my-2">
      <p><b>Total Order:</b> ${c.total_orders} | <b>Belanja:</b> ${formatCurrency(c.total_spent)}</p>
      <p><b>Pertama:</b> ${formatDate(c.first_contact)} | <b>Terakhir:</b> ${formatDate(c.last_contact)}</p>
      ${orders.length > 0 ? `<h4 class="font-bold mt-3">Order Terakhir:</h4><ul class="list-disc pl-4">${orders.slice(0,5).map(o=>`<li>${o.order_number} - ${formatCurrency(o.total)} (${o.status})</li>`).join("")}</ul>` : ""}
    </div>
    <div class="flex gap-2 justify-end mt-4">
      <button onclick="sendMsgToCustomer('${c.jid}')" class="btn btn-success text-xs write-action"><i class="fas fa-paper-plane mr-1"></i>Kirim Pesan</button>
      <button onclick="closeModal()" class="btn btn-outline">Tutup</button>
    </div>`);
}

function sendMsgToCustomer(jid) {
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-paper-plane mr-2 text-green-500"></i>Kirim Pesan</h3>
    <p class="text-sm text-gray-500 mb-3">Ke: ${jid.split("@")[0]}</p>
    <textarea id="msgContent" rows="4" placeholder="Tulis pesan..."></textarea>
    <div class="flex gap-2 justify-end mt-4"><button onclick="closeModal()" class="btn btn-outline">Batal</button><button onclick="doSendMsg('${jid}')" class="btn btn-success">Kirim</button></div>`);
}

async function doSendMsg(jid) { const msg = document.getElementById("msgContent").value; if (!msg) return; try { await api("/api/send-message", { method: "POST", body: { jid, message: msg, botId: selectedBotId } }); closeModal(); toast("Pesan terkirim"); } catch(e) { toast("Gagal kirim: "+e.message, "error"); } }

// ===== TICKETS =====
async function renderTickets(el) {
  const tickets = await api("/api/tickets");
  const stats = await api("/api/tickets/stats");
  el.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <div class="card p-3 text-center"><p class="text-xs text-gray-500">Open</p><p class="text-xl font-bold text-yellow-600">${stats.open_tickets}</p></div>
      <div class="card p-3 text-center"><p class="text-xs text-gray-500">In Progress</p><p class="text-xl font-bold text-blue-600">${stats.in_progress}</p></div>
      <div class="card p-3 text-center"><p class="text-xs text-gray-500">Resolved</p><p class="text-xl font-bold text-green-600">${stats.resolved}</p></div>
      <div class="card p-3 text-center"><p class="text-xs text-gray-500">Total</p><p class="text-xl font-bold text-gray-700">${stats.total}</p></div>
    </div>
    <div class="flex gap-2 mb-4"><select id="ticketFilter" onchange="filterTickets()" class="w-48"><option value="">Semua Status</option><option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></div>
    <div class="card overflow-x-auto">
      <table>
        <thead><tr><th>No. Tiket</th><th>Customer</th><th>Subjek</th><th>Prioritas</th><th>Status</th><th>Tanggal</th><th>Aksi</th></tr></thead>
        <tbody id="ticketsTable">${tickets.map(t => `<tr>
          <td class="font-mono text-xs">${t.ticket_number}</td>
          <td>${t.customer_name}</td>
          <td class="font-medium">${t.subject}</td>
          <td><span class="badge ${t.priority==="urgent"?"badge-red":t.priority==="high"?"badge-yellow":"badge-gray"}">${t.priority}</span></td>
          <td>${statusBadge(t.status)}</td>
          <td class="text-xs text-gray-500">${formatDate(t.created_at)}</td>
          <td><button onclick="updateTicket('${t.ticket_number}','${t.status}')" class="btn btn-primary text-xs py-1 px-2 write-action"><i class="fas fa-edit"></i></button></td>
        </tr>`).join("")}</tbody>
      </table>
      ${tickets.length === 0 ? '<p class="text-center py-8 text-gray-400">Tidak ada tiket</p>' : ""}
    </div>`;
}

async function filterTickets() { const s = document.getElementById("ticketFilter").value; const tickets = await api(`/api/tickets${s?"?status="+s:""}`); document.getElementById("ticketsTable").innerHTML = tickets.map(t=>`<tr><td class="font-mono text-xs">${esc(t.ticket_number)}</td><td>${esc(t.customer_name)}</td><td class="font-medium">${esc(t.subject)}</td><td><span class="badge ${t.priority==="urgent"?"badge-red":t.priority==="high"?"badge-yellow":"badge-gray"}">${esc(t.priority)}</span></td><td>${statusBadge(t.status)}</td><td class="text-xs text-gray-500">${formatDate(t.created_at)}</td><td><button onclick="updateTicket(${JSON.stringify(String(t.ticket_number||''))},${JSON.stringify(String(t.status||''))})" class="btn btn-primary text-xs py-1 px-2 write-action"><i class="fas fa-edit"></i></button></td></tr>`).join(""); }

function updateTicket(num, current) {
  showModal(`
    <h3 class="text-lg font-bold mb-4">Update Tiket ${num}</h3>
    <select id="newTicketStatus" class="mb-3"><option value="open" ${current==="open"?"selected":""}>Open</option><option value="in_progress" ${current==="in_progress"?"selected":""}>In Progress</option><option value="resolved" ${current==="resolved"?"selected":""}>Resolved</option><option value="closed" ${current==="closed"?"selected":""}>Closed</option></select>
    <textarea id="ticketResolution" rows="3" placeholder="Resolusi (opsional)..." class="mb-3"></textarea>
    <label class="flex items-center gap-2 text-sm mb-3"><input type="checkbox" id="notifyTicket" checked> Notifikasi customer</label>
    <div class="flex gap-2 justify-end"><button onclick="closeModal()" class="btn btn-outline">Batal</button><button onclick="doUpdateTicket('${num}')" class="btn btn-primary">Update</button></div>`);
}

async function doUpdateTicket(num) { await api(`/api/tickets/${num}/status`, { method: "PUT", body: { status: document.getElementById("newTicketStatus").value, resolution: document.getElementById("ticketResolution").value, notify: document.getElementById("notifyTicket").checked, botId: selectedBotId } }); closeModal(); toast("Tiket diperbarui"); showPage("tickets"); }

// ===== FAQ =====
async function renderFaq(el) {
  const faqs = await api("/api/faq");
  el.innerHTML = `
    <div class="flex justify-end mb-4"><button onclick="showAddFaq()" class="btn btn-primary write-action"><i class="fas fa-plus mr-1"></i>Tambah FAQ</button></div>
    <div class="space-y-3" id="faqList">${faqs.map(f => `
      <div class="card p-4">
        <div class="flex justify-between items-start">
          <div><p class="font-bold text-gray-800">${f.question}</p><p class="text-sm text-gray-600 mt-1">${f.answer}</p><p class="text-xs text-gray-400 mt-2">Kategori: ${f.category} | Dilihat: ${f.hit_count}x</p></div>
          <button onclick="delFaq(${f.id})" class="btn btn-danger text-xs py-1 px-2 write-action"><i class="fas fa-trash"></i></button>
        </div>
      </div>`).join("")}
      ${faqs.length === 0 ? '<div class="text-center py-8 text-gray-400">Belum ada FAQ</div>' : ""}
    </div>`;
}

function showAddFaq() {
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-plus mr-2"></i>Tambah FAQ</h3>
    <div class="space-y-3">
      <div><label class="block text-sm font-medium mb-1">Pertanyaan *</label><input id="faqQ"></div>
      <div><label class="block text-sm font-medium mb-1">Jawaban *</label><textarea id="faqA" rows="3"></textarea></div>
      <div><label class="block text-sm font-medium mb-1">Keywords (pisahkan koma)</label><input id="faqK" placeholder="pesan,order,beli"></div>
      <div><label class="block text-sm font-medium mb-1">Kategori</label><input id="faqC" value="Umum"></div>
      <div class="flex gap-2 justify-end"><button onclick="closeModal()" class="btn btn-outline">Batal</button><button onclick="saveFaq()" class="btn btn-primary">Simpan</button></div>
    </div>`);
}

async function saveFaq() { const q = document.getElementById("faqQ").value, a = document.getElementById("faqA").value; if (!q||!a) return toast("Pertanyaan dan jawaban wajib","error"); const k = document.getElementById("faqK").value.split(",").map(s=>s.trim()).filter(Boolean); await api("/api/faq", { method: "POST", body: { question: q, answer: a, keywords: k, category: document.getElementById("faqC").value } }); closeModal(); toast("FAQ ditambahkan"); showPage("faq"); }

async function delFaq(id) { if (!confirm("Hapus FAQ ini?")) return; await api(`/api/faq/${id}`, { method: "DELETE" }); toast("FAQ dihapus"); showPage("faq"); }

// ===== TEMPLATES =====
async function renderTemplates(el) {
  const templates = await api("/api/templates");
  el.innerHTML = `
    <div class="flex justify-end mb-4"><button onclick="showAddTemplate()" class="btn btn-primary write-action"><i class="fas fa-plus mr-1"></i>Tambah Template</button></div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">${templates.map(t => `
      <div class="card p-4">
        <div class="flex justify-between items-start mb-2">
          <div><h4 class="font-bold">${t.name}</h4><span class="badge badge-blue">${t.category}</span></div>
          <button onclick="delTpl('${t.name}')" class="btn btn-danger text-xs py-1 px-2 write-action"><i class="fas fa-trash"></i></button>
        </div>
        <p class="text-sm text-gray-600 bg-gray-50 p-2 rounded">${t.content}</p>
      </div>`).join("")}
      ${templates.length === 0 ? '<div class="text-center py-8 text-gray-400 col-span-2">Belum ada template</div>' : ""}
    </div>`;
}

function showAddTemplate() {
  showModal(`
    <h3 class="text-lg font-bold mb-4">Tambah Template</h3>
    <div class="space-y-3">
      <div><label class="block text-sm font-medium mb-1">Nama *</label><input id="tplName"></div>
      <div><label class="block text-sm font-medium mb-1">Isi *</label><textarea id="tplContent" rows="4" placeholder="Variable: {nama}, {order}, {tanggal}"></textarea></div>
      <div><label class="block text-sm font-medium mb-1">Kategori</label><input id="tplCat" value="Umum"></div>
      <div class="flex gap-2 justify-end"><button onclick="closeModal()" class="btn btn-outline">Batal</button><button onclick="saveTpl()" class="btn btn-primary">Simpan</button></div>
    </div>`);
}

async function saveTpl() { const n = document.getElementById("tplName").value, c = document.getElementById("tplContent").value; if (!n||!c) return toast("Nama dan isi wajib","error"); try { await api("/api/templates", { method: "POST", body: { name: n, content: c, category: document.getElementById("tplCat").value } }); closeModal(); toast("Template ditambahkan"); showPage("templates"); } catch(e) { toast(e.message,"error"); } }

async function delTpl(name) { if (!confirm(`Hapus template "${name}"?`)) return; await api(`/api/templates/${name}`, { method: "DELETE" }); toast("Template dihapus"); showPage("templates"); }

// ===== BROADCAST =====
async function renderBroadcast(el) {
  const broadcasts = await api("/api/broadcasts");
  el.innerHTML = `
    <div class="flex justify-end mb-4"><button onclick="showNewBroadcast()" class="btn btn-primary write-action"><i class="fas fa-bullhorn mr-1"></i>Buat Broadcast</button></div>
    <div class="card overflow-x-auto">
      <table>
        <thead><tr><th>Judul</th><th>Target</th><th>Terkirim</th><th>Delivered</th><th>Dibaca</th><th>Open Rate</th><th>Status</th><th>Tanggal</th></tr></thead>
        <tbody>${broadcasts.map(b => { const tags = JSON.parse(b.target_tags||"[]"); const openRate = b.sent_count > 0 ? ((b.read_count || 0) / b.sent_count * 100).toFixed(1) : "0.0"; const delivRate = b.sent_count > 0 ? (((b.delivered_count || 0) + (b.read_count || 0)) / b.sent_count * 100).toFixed(1) : "0.0"; return `<tr>
          <td class="font-medium">${b.title}</td>
          <td>${tags.length?tags.join(", "):"Semua"}</td>
          <td>${b.sent_count}</td>
          <td>${b.delivered_count || 0}</td>
          <td>${b.read_count || 0}</td>
          <td><span class="font-medium ${openRate > 30 ? 'text-green-500' : openRate > 10 ? 'text-yellow-500' : 'text-gray-400'}">${openRate}%</span></td>
          <td>${statusBadge(b.status === "sent" ? "delivered" : b.status)}</td>
          <td class="text-xs text-gray-500">${formatDate(b.sent_at || b.created_at)}</td>
        </tr>`; }).join("")}</tbody>
      </table>
      ${broadcasts.length === 0 ? '<p class="text-center py-8 text-gray-400">Belum ada broadcast</p>' : ""}
    </div>`;
}

function showNewBroadcast() {
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-bullhorn mr-2 text-blue-500"></i>Buat Broadcast</h3>
    <div class="space-y-3">
      <div><label class="block text-sm font-medium mb-1">Judul *</label><input id="bcTitle"></div>
      <div><label class="block text-sm font-medium mb-1">Pesan *</label><textarea id="bcMsg" rows="4"></textarea></div>
      <div><label class="block text-sm font-medium mb-1">Target Tags (kosong = semua)</label><input id="bcTags" placeholder="VIP, Loyal"></div>
      <div><label class="block text-sm font-medium mb-1">Atau pilih segmen</label><select id="bcSegment" onchange="previewSegmentCount()"><option value="">-- Tanpa segmen (pakai tags) --</option><option value="new_30d">Customer baru (30 hari)</option><option value="inactive_30d">Customer tidak aktif (30 hari)</option><option value="repeat_buyers">Repeat buyer (2+ order)</option><option value="high_spenders">High spender (500rb+)</option><option value="hot_leads">Hot leads</option><option value="warm_leads">Warm leads</option><option value="cold_leads">Cold leads</option><option value="low_satisfaction">Rating rendah (&lt;3)</option></select><span id="segmentCount" class="text-xs text-gray-500 mt-1"></span></div>
      <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="bcSendNow" checked onchange="document.getElementById('bcScheduleWrap').classList.toggle('hidden',this.checked)"> Kirim sekarang</label>
      <div id="bcScheduleWrap" class="hidden"><label class="block text-sm font-medium mb-1">Jadwalkan untuk</label><input id="bcScheduleAt" type="datetime-local"></div>
      <div class="flex gap-2 justify-end"><button onclick="closeModal()" class="btn btn-outline">Batal</button><button onclick="doBroadcast()" class="btn btn-primary">Kirim</button></div>
    </div>`);
}

async function previewSegmentCount() {
  const seg = document.getElementById("bcSegment").value;
  const el = document.getElementById("segmentCount");
  if (!seg) { el.textContent = ""; return; }
  try { const r = await api(`/api/segments/${seg}/count`); el.textContent = `${r.count} customer di segmen ini`; } catch { el.textContent = ""; }
}

async function doBroadcast() {
  const t = document.getElementById("bcTitle").value, m = document.getElementById("bcMsg").value;
  if (!t||!m) return toast("Judul dan pesan wajib","error");
  const segment = document.getElementById("bcSegment").value;
  const tags = document.getElementById("bcTags").value.split(",").map(s=>s.trim()).filter(Boolean);
  const sendNow = document.getElementById("bcSendNow").checked;
  if (segment) {
    if (!sendNow) return toast("Broadcast segmen hanya bisa kirim langsung (belum support jadwal)", "error");
    await api("/api/broadcasts/segment", { method: "POST", body: { title: t, message: m, segment, botId: selectedBotId } });
    closeModal(); toast("Broadcast segmen dikirim"); showPage("broadcast"); return;
  }
  if (!sendNow) {
    const schedAt = document.getElementById("bcScheduleAt").value;
    if (!schedAt) return toast("Pilih waktu jadwal","error");
    await api("/api/broadcasts/schedule", { method: "POST", body: { title: t, message: m, target_tags: tags, scheduled_at: new Date(schedAt).toISOString(), botId: selectedBotId } });
    closeModal(); toast("Broadcast dijadwalkan"); showPage("broadcast"); return;
  }
  await api("/api/broadcasts", { method: "POST", body: { title: t, message: m, target_tags: tags, send_now: true, botId: selectedBotId } });
  closeModal(); toast("Broadcast dikirim"); showPage("broadcast");
}

// ===== AGENTS =====
async function renderAgents(el) {
  const agents = await api("/api/agents");
  el.innerHTML = `
    <div class="flex justify-end mb-4"><button onclick="showAddAgent()" class="btn btn-primary write-action"><i class="fas fa-plus mr-1"></i>Tambah Agent</button></div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${agents.map(a => `
      <div class="card p-5">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-full ${a.is_online ? "bg-green-100" : "bg-gray-100"} flex items-center justify-center">
            <i class="fas fa-headset ${a.is_online ? "text-green-500" : "text-gray-400"}"></i>
          </div>
          <div>
            <h4 class="font-bold">${a.name}</h4>
            <span class="text-xs ${a.is_online ? "text-green-500" : "text-gray-400"}">${a.is_online ? "🟢 Online" : "🔴 Offline"}</span>
          </div>
        </div>
        <div class="text-sm text-gray-600 space-y-1">
          <p>📱 ${a.jid.split("@")[0]}</p>
          <p>Role: ${a.role}</p>
          <p>Chat Aktif: ${a.active_chats} | Total: ${a.total_handled}</p>
          <p>Rating: ${a.rating_avg ? a.rating_avg.toFixed(1)+"⭐" : "-"}</p>
        </div>
        <div class="flex gap-2 mt-3">
          <button onclick="toggleAgent('${a.jid}',${a.is_online?0:1})" class="btn ${a.is_online?"btn-warning":"btn-success"} text-xs flex-1 write-action">${a.is_online?"Set Offline":"Set Online"}</button>
        </div>
      </div>`).join("")}
      ${agents.length === 0 ? '<div class="text-center py-8 text-gray-400 col-span-3">Belum ada agent</div>' : ""}
    </div>`;
}

function showAddAgent() {
  showModal(`
    <h3 class="text-lg font-bold mb-4">Tambah Agent</h3>
    <div class="space-y-3">
      <div><label class="block text-sm font-medium mb-1">Nomor WhatsApp *</label><input id="agentJid" placeholder="628123456789"></div>
      <div><label class="block text-sm font-medium mb-1">Nama *</label><input id="agentName"></div>
      <div><label class="block text-sm font-medium mb-1">Role</label><select id="agentRole"><option>agent</option><option>supervisor</option><option>admin</option></select></div>
      <div class="flex gap-2 justify-end"><button onclick="closeModal()" class="btn btn-outline">Batal</button><button onclick="saveAgent()" class="btn btn-primary">Simpan</button></div>
    </div>`);
}

async function saveAgent() { const jid = document.getElementById("agentJid").value.replace(/[^0-9]/g,"")+"@s.whatsapp.net", n = document.getElementById("agentName").value; if (!n) return toast("Nama wajib","error"); await api("/api/agents", { method: "POST", body: { jid, name: n, role: document.getElementById("agentRole").value } }); closeModal(); toast("Agent ditambahkan"); showPage("agents"); }

async function toggleAgent(jid, online) { await api(`/api/agents/${encodeURIComponent(jid)}/status`, { method: "PUT", body: { is_online: online } }); showPage("agents"); }

// ===== ANALYTICS =====
async function renderAnalytics(el) {
  const analytics = await api("/api/analytics?days=14");
  const stats = await api("/api/dashboard");
  el.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="card p-5"><h3 class="text-sm text-gray-500 mb-2">Total Revenue</h3><p class="text-3xl font-bold text-green-600">${formatCurrency(stats.orders.total_revenue)}</p></div>
      <div class="card p-5"><h3 class="text-sm text-gray-500 mb-2">Total Customer</h3><p class="text-3xl font-bold text-blue-600">${stats.total_customers}</p></div>
      <div class="card p-5"><h3 class="text-sm text-gray-500 mb-2">Kepuasan</h3><p class="text-3xl font-bold text-yellow-600">${stats.satisfaction_avg} ⭐</p></div>
    </div>
    <div class="card p-5">
      <h3 class="font-bold text-gray-800 mb-4">Data 14 Hari Terakhir</h3>
      <div class="overflow-x-auto">
        <table>
          <thead><tr><th>Tanggal</th><th>Pesan In</th><th>Pesan Out</th><th>Customer Baru</th><th>Order</th><th>Revenue</th><th>Tiket Baru</th><th>Tiket Selesai</th></tr></thead>
          <tbody>${analytics.map(a => `<tr>
            <td class="font-mono text-xs">${a.date}</td>
            <td>${a.messages_in}</td><td>${a.messages_out}</td><td>${a.new_customers}</td>
            <td>${a.orders_count}</td><td>${formatCurrency(a.revenue)}</td>
            <td>${a.tickets_opened}</td><td>${a.tickets_resolved}</td>
          </tr>`).join("")}</tbody>
        </table>
        ${analytics.length === 0 ? '<p class="text-center py-4 text-gray-400">Belum ada data</p>' : ""}
      </div>
    </div>`;
}

// ===== SETTINGS =====
// ===== IMPORTANT MESSAGES =====
async function renderImportant(el) {
  const stats = await api("/api/important/stats");
  const botFilter = selectedBotId ? `?botId=${selectedBotId}` : "";
  const messages = await api(`/api/important${botFilter}`);
  const categoryLabels = { keluhan: "Keluhan", refund: "Refund", pembayaran: "Pembayaran", urgent: "Urgent", pertanyaan_produk: "Produk", pengiriman: "Pengiriman", kerjasama: "Kerjasama", umum: "Umum" };
  const priorityBadge = (p) => p === "urgent" ? "badge-red" : p === "high" ? "badge-yellow" : "badge-blue";

  el.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="card p-4 stat-card"><div class="text-2xl font-bold text-red-500">${stats.unread || 0}</div><div class="text-sm text-gray-500">Belum Dibaca</div></div>
      <div class="card p-4 stat-card"><div class="text-2xl font-bold text-orange-500">${stats.urgent || 0}</div><div class="text-sm text-gray-500">Urgent</div></div>
      <div class="card p-4 stat-card"><div class="text-2xl font-bold text-yellow-500">${stats.high || 0}</div><div class="text-sm text-gray-500">Prioritas Tinggi</div></div>
      <div class="card p-4 stat-card"><div class="text-2xl font-bold text-blue-500">${stats.total || 0}</div><div class="text-sm text-gray-500">Total Pesan</div></div>
    </div>
    <div class="card">
      <div class="flex justify-between items-center p-4 border-b">
        <h3 class="font-bold">Pesan Penting dari Customer</h3>
        <div class="flex gap-2">
          <button onclick="markAllRead()" class="btn btn-outline text-sm write-action"><i class="fas fa-check-double mr-1"></i>Tandai Semua Dibaca</button>
          <button onclick="exportImportant()" class="btn btn-primary text-sm"><i class="fas fa-download mr-1"></i>Export CSV</button>
        </div>
      </div>
      ${messages.length === 0 ? '<div class="p-8 text-center text-gray-400">Belum ada pesan penting terdeteksi</div>' : `
      <table>
        <thead><tr><th>Waktu</th><th>Bot</th><th>Customer</th><th>Pesan</th><th>Kategori</th><th>Prioritas</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>${messages.map(m => `
          <tr class="${m.is_read ? "" : "bg-yellow-50"}">
            <td class="text-xs">${formatDate(m.created_at)}</td>
            <td class="text-xs">${m.bot_id || "-"}</td>
            <td><div class="font-medium">${m.customer_name || "Unknown"}</div><div class="text-xs text-gray-400">${(m.customer_jid || "").split("@")[0]}</div></td>
            <td class="max-w-xs"><div class="truncate" title="${m.message.replace(/"/g, '&quot;')}">${m.message}</div>${m.notes ? `<div class="text-xs text-blue-500 mt-1"><i class="fas fa-sticky-note mr-1"></i>${m.notes}</div>` : ""}</td>
            <td><span class="badge badge-blue">${categoryLabels[m.category] || m.category}</span></td>
            <td><span class="badge ${priorityBadge(m.priority)}">${m.priority}</span></td>
            <td>${m.is_read ? '<span class="text-green-500 text-xs"><i class="fas fa-check"></i> Dibaca</span>' : '<span class="text-red-500 text-xs"><i class="fas fa-circle"></i> Baru</span>'}</td>
            <td class="flex gap-1">
              ${m.is_read ? "" : `<button onclick="markRead(${m.id})" class="btn btn-outline text-xs write-action" title="Tandai dibaca"><i class="fas fa-check"></i></button>`}
              <button onclick="addNote(${m.id}, '${m.notes.replace(/'/g, "\\'")}')" class="btn btn-outline text-xs write-action" title="Catatan"><i class="fas fa-sticky-note"></i></button>
              <button onclick="replyImportant('${m.customer_jid}')" class="btn btn-outline text-xs write-action" title="Balas"><i class="fas fa-reply"></i></button>
              <button onclick="deleteImportant(${m.id})" class="btn btn-danger text-xs write-action" title="Hapus"><i class="fas fa-trash"></i></button>
            </td>
          </tr>`).join("")}
        </tbody>
      </table>`}
    </div>`;
  updateImportantBadge();
}

async function updateImportantBadge() {
  try {
    const stats = await api("/api/important/stats");
    const badge = document.getElementById("importantBadge");
    if (!badge) return;
    if (stats.unread > 0) { badge.textContent = stats.unread; badge.classList.remove("hidden"); }
    else { badge.classList.add("hidden"); }
  } catch { /* not logged in */ }
}

async function markRead(id) { await api(`/api/important/${id}/read`, { method: "PUT" }); showPage("important"); }
async function markAllRead() { await api("/api/important/read-all", { method: "PUT", body: { botId: selectedBotId || null } }); toast("Semua ditandai dibaca"); showPage("important"); }

function addNote(id, existing) {
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-sticky-note mr-2 text-yellow-500"></i>Tambah Catatan</h3>
    <textarea id="importantNote" rows="3" class="mb-3">${existing || ""}</textarea>
    <div class="flex gap-2"><button onclick="saveNote(${id})" class="btn btn-primary">Simpan</button><button onclick="closeModal()" class="btn btn-outline">Batal</button></div>
  `);
}

async function saveNote(id) { await api(`/api/important/${id}/notes`, { method: "PUT", body: { notes: document.getElementById("importantNote").value } }); closeModal(); toast("Catatan disimpan"); showPage("important"); }

function replyImportant(jid) {
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-reply mr-2 text-blue-500"></i>Balas Pesan</h3>
    <p class="text-sm text-gray-500 mb-3">Ke: ${jid.split("@")[0]}</p>
    <textarea id="msgContent" rows="4" placeholder="Ketik balasan..."></textarea>
    <button onclick="doSendMsg('${jid}')" class="btn btn-primary w-full mt-3">Kirim via ${selectedBotId || "Bot"}</button>
  `);
}

async function deleteImportant(id) { if (!confirm("Hapus pesan penting ini?")) return; await api(`/api/important/${id}`, { method: "DELETE" }); toast("Pesan dihapus"); showPage("important"); }

function exportImportant() {
  api(`/api/important${selectedBotId ? "?botId=" + selectedBotId : ""}`).then(messages => {
    const header = "Waktu,Bot,Customer,Nomor,Pesan,Kategori,Prioritas,Status,Catatan";
    const rows = messages.map(m => {
      const esc = (s) => '"' + (s || "").replace(/"/g, '""') + '"';
      return [formatDate(m.created_at), m.bot_id, esc(m.customer_name), (m.customer_jid || "").split("@")[0], esc(m.message), m.category, m.priority, m.is_read ? "Dibaca" : "Baru", esc(m.notes)].join(",");
    });
    const csv = "﻿" + header + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `pesan-penting-${new Date().toISOString().split("T")[0]}.csv`; a.click();
    toast("CSV didownload");
  });
}

async function renderSettings(el) {
  const p = await api("/api/profile");
  const isAdmin = userRole === "admin";
  let owners = [];
  if (isAdmin) { try { owners = await api("/api/bot-owners"); } catch {} }
  el.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="card p-6">
        <h3 class="text-lg font-bold mb-4"><i class="fas fa-store mr-2 text-blue-500"></i>Profil Bisnis</h3>
        <div class="space-y-3">
          <div><label class="block text-sm font-medium mb-1">Nama Bisnis</label><input id="sName" value="${p.name||""}"></div>
          <div><label class="block text-sm font-medium mb-1">Deskripsi</label><textarea id="sDesc" rows="2">${p.description||""}</textarea></div>
          <div><label class="block text-sm font-medium mb-1">Kategori</label><input id="sCat" value="${p.category||""}"></div>
          <div><label class="block text-sm font-medium mb-1">Alamat</label><textarea id="sAddr" rows="2">${p.address||""}</textarea></div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label class="block text-sm font-medium mb-1">Email</label><input id="sEmail" value="${p.email||""}"></div>
            <div><label class="block text-sm font-medium mb-1">Telepon</label><input id="sPhone" value="${p.phone||""}"></div>
          </div>
          <div><label class="block text-sm font-medium mb-1">Website</label><input id="sWeb" value="${p.website||""}"></div>
          <button onclick="saveProfile()" class="btn btn-primary w-full mt-2">Simpan Profil</button>
        </div>
      </div>
      <div class="space-y-6">
        <div class="card p-6">
          <h3 class="text-lg font-bold mb-4"><i class="fas fa-clock mr-2 text-green-500"></i>Jam Operasional</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label class="block text-sm font-medium mb-1">Jam Buka</label><input id="sOpen" type="number" min="0" max="23" value="${p.open_hour}"></div>
            <div><label class="block text-sm font-medium mb-1">Jam Tutup</label><input id="sClose" type="number" min="0" max="24" value="${p.close_hour}"></div>
          </div>
          <button onclick="saveHours()" class="btn btn-primary w-full mt-3">Simpan Jam</button>
        </div>
        <div class="card p-6">
          <h3 class="text-lg font-bold mb-4"><i class="fas fa-comment mr-2 text-purple-500"></i>Pesan Otomatis</h3>
          <div class="space-y-3">
            <div><label class="block text-sm font-medium mb-1">Welcome Message</label><textarea id="sWelcome" rows="3">${p.welcome_message||""}</textarea><p class="text-xs text-gray-400 mt-1">Variable: {nama}, {greeting}, {bisnis}</p></div>
            <div>
              <label class="block text-sm font-medium mb-1">Foto Sambutan (opsional)</label>
              <input type="file" id="sWelcomeImageFile" accept="image/*" onchange="handleImageUpload(event, 'sWelcomeImagePreview', 'sWelcomeImageUrl')">
              <input type="hidden" id="sWelcomeImageUrl" value="${p.welcome_image_url||""}">
              <img id="sWelcomeImagePreview" class="mt-2 rounded-lg max-h-32 object-cover" style="${p.welcome_image_url ? "" : "display:none"}" src="${p.welcome_image_url||""}">
              <p class="text-xs text-gray-400 mt-1">Kalau diisi, foto ini dikirim bareng pesan sambutan pertama ke customer baru</p>
            </div>
            <div><label class="block text-sm font-medium mb-1">Away Message</label><textarea id="sAway" rows="3">${p.away_message||""}</textarea></div>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="sAutoReply" ${p.auto_reply_enabled?"checked":""}> Auto Reply</label>
              <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="sAI" ${p.ai_enabled?"checked":""}> AI CS</label>
            </div>
            <button onclick="saveMessages()" class="btn btn-primary w-full">Simpan Pesan</button>
          </div>
        </div>
        ${isAdmin ? `
        <div class="card p-6">
          <h3 class="text-lg font-bold mb-4"><i class="fas fa-user-shield mr-2 text-orange-500"></i>Owner Bot</h3>
          <p class="text-xs text-gray-500 mb-3">Nomor di sini bisa pakai perintah teknis bot (restart, kelola fitur, dll). Tambahkan hanya nomor yang benar-benar dipercaya.</p>
          <div class="flex gap-2 mb-3"><input id="ownerNumber" placeholder="62812xxxxxxx" class="flex-1"><button onclick="addBotOwner()" class="btn btn-primary">Tambah</button></div>
          <div class="space-y-2">${owners.length ? owners.map(o => `
            <div class="flex justify-between items-center bg-gray-50 px-3 py-2 rounded text-sm">
              <span>${o.replace("@s.whatsapp.net", "")}</span>
              <button onclick="removeBotOwner('${o}')" class="text-red-500 text-xs"><i class="fas fa-trash"></i></button>
            </div>`).join("") : '<p class="text-xs text-gray-400">Belum ada owner bot</p>'}</div>
        </div>` : ""}
        <div class="card p-6">
          <h3 class="text-lg font-bold mb-4"><i class="fas fa-lock mr-2 text-red-500"></i>Ganti Password</h3>
          <div class="space-y-3">
            <div><label class="block text-sm font-medium mb-1">Password Saat Ini</label><input id="pwCurrent" type="password"></div>
            <div><label class="block text-sm font-medium mb-1">Password Baru</label><input id="pwNew" type="password"></div>
            <div><label class="block text-sm font-medium mb-1">Konfirmasi Password Baru</label><input id="pwConfirm" type="password"></div>
            <button onclick="changePassword()" class="btn btn-primary w-full">Simpan Password</button>
          </div>
        </div>
      </div>
    </div>`;
}

async function changePassword() {
  const currentPassword = document.getElementById("pwCurrent").value;
  const newPassword = document.getElementById("pwNew").value;
  const confirmPassword = document.getElementById("pwConfirm").value;
  if (!currentPassword || !newPassword || !confirmPassword) {
    return toast("Semua kolom password harus diisi", "error");
  }
  if (newPassword !== confirmPassword) {
    return toast("Konfirmasi password tidak cocok", "error");
  }
  if (newPassword.length < 6) {
    return toast("Password baru minimal 6 karakter", "error");
  }
  const result = await api("/api/me/password", { method: "PUT", body: { currentPassword, newPassword } });
  if (result.error) {
    return toast(result.error, "error");
  }
  toast("Password berhasil diubah");
  document.getElementById("pwCurrent").value = "";
  document.getElementById("pwNew").value = "";
  document.getElementById("pwConfirm").value = "";
}

async function saveProfile() {
  await api("/api/profile", { method: "PUT", body: { name: document.getElementById("sName").value, description: document.getElementById("sDesc").value, category: document.getElementById("sCat").value, address: document.getElementById("sAddr").value, email: document.getElementById("sEmail").value, phone: document.getElementById("sPhone").value, website: document.getElementById("sWeb").value } });
  toast("Profil disimpan"); document.getElementById("sidebarBizName").textContent = document.getElementById("sName").value || "Business CS";
}

async function saveHours() {
  await api("/api/profile", { method: "PUT", body: { open_hour: parseInt(document.getElementById("sOpen").value), close_hour: parseInt(document.getElementById("sClose").value) } });
  toast("Jam operasional disimpan");
}

async function saveMessages() {
  await api("/api/profile", { method: "PUT", body: { welcome_message: document.getElementById("sWelcome").value, welcome_image_url: document.getElementById("sWelcomeImageUrl").value || "", away_message: document.getElementById("sAway").value, auto_reply_enabled: document.getElementById("sAutoReply").checked ? 1 : 0, ai_enabled: document.getElementById("sAI").checked ? 1 : 0 } });
  toast("Pesan otomatis disimpan");
}

async function addBotOwner() {
  const number = document.getElementById("ownerNumber").value.trim();
  if (!number) return toast("Nomor wajib diisi", "error");
  try {
    await api("/api/bot-owners", { method: "POST", body: { number } });
    toast("Owner bot ditambahkan");
    showPage("settings");
  } catch (e) { toast(e.message, "error"); }
}

async function removeBotOwner(jid) {
  if (!confirm("Hapus owner bot ini?")) return;
  await api(`/api/bot-owners/${encodeURIComponent(jid)}`, { method: "DELETE" });
  toast("Owner bot dihapus");
  showPage("settings");
}

// ===== BOT MANAGER =====
async function renderBotManager(el) {
  const bots = await api("/api/bots");
  el.innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <p class="text-sm text-gray-500">Total: ${bots.length} bot terdaftar</p>
      <button onclick="showAddBot()" class="btn btn-primary"><i class="fas fa-plus mr-1"></i>Tambah Bot</button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${bots.map(b => `
        <div class="card p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-full ${b.connected ? "bg-green-100" : "bg-gray-100"} flex items-center justify-center">
              <i class="fas fa-robot ${b.connected ? "text-green-500" : "text-gray-400"}"></i>
            </div>
            <div>
              <h4 class="font-bold">${b.name}</h4>
              <span class="text-xs ${b.connected ? "text-green-500" : "text-gray-400"}">${b.connected ? "🟢 Online" : "🔴 Offline"}</span>
            </div>
          </div>
          <div class="text-sm text-gray-600 space-y-1">
            <p>📱 ${b.phone || "-"}</p>
            <p>ID: <span class="font-mono text-xs">${b.id}</span></p>
            <p>Dibuat: ${formatDate(b.created_at)}</p>
          </div>
          <div class="mt-3 space-y-2">
            ${!b.connected ? `<button onclick="requestPairingAgain('${b.id}','${b.name}')" class="btn btn-primary text-xs w-full"><i class="fas fa-qrcode mr-1"></i>Minta Kode Pairing Lagi</button>` : ""}
            ${userRole === "admin" ? `<button onclick="manageBotAccess('${b.id}','${b.name}')" class="btn btn-outline text-xs w-full"><i class="fas fa-share-alt mr-1"></i>Kelola Akses Client</button>` : ""}
            <button onclick="deleteBot('${b.id}','${b.name}')" class="btn btn-danger text-xs w-full"><i class="fas fa-trash mr-1"></i>Hapus Bot</button>
          </div>
        </div>`).join("")}
      ${bots.length === 0 ? '<div class="text-center py-8 text-gray-400 col-span-3">Belum ada bot. Klik "Tambah Bot" untuk memulai.</div>' : ""}
    </div>`;
}

function showAddBot() {
  addBotMethod = "qr";
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-robot mr-2 text-green-500"></i>Tambah Bot WhatsApp</h3>
    <div class="space-y-3">
      <div class="flex gap-2">
        <button id="addTabCode" onclick="switchAddMethod('code')" class="btn btn-outline text-xs flex-1"><i class="fas fa-keyboard mr-1"></i>Kode Pairing</button>
        <button id="addTabQr" onclick="switchAddMethod('qr')" class="btn btn-primary text-xs flex-1"><i class="fas fa-qrcode mr-1"></i>Scan QR Code</button>
      </div>
      <div><label class="block text-sm font-medium mb-1">Nama Bot *</label><input id="botName" placeholder="Bot Toko Saya"></div>
      <div id="addPhoneField" class="hidden"><label class="block text-sm font-medium mb-1">Nomor WhatsApp * (awali 62)</label><input id="botPhone" placeholder="628123456789"></div>
      <p class="text-xs text-gray-400" id="addMethodHint">Klik Mulai untuk menampilkan QR Code, lalu scan lewat WhatsApp &gt; Perangkat Tertaut &gt; Tautkan Perangkat.</p>
      <div id="pairingResult" class="hidden">
        <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p class="text-sm text-green-800 mb-2">Pairing Code:</p>
          <p class="text-3xl font-bold text-green-700 tracking-widest" id="pairingCode"></p>
          <p class="text-xs text-green-600 mt-2">Masukkan code ini di WhatsApp kamu</p>
        </div>
      </div>
      <div id="qrResult" class="hidden text-center">
        <div id="addBotQrImgLoader" class="mx-auto flex flex-col items-center justify-center border rounded-lg bg-gray-50" style="width:220px;height:220px">
          <i class="fas fa-spinner fa-spin text-2xl text-gray-400 mb-2"></i>
          <p class="text-xs text-gray-400">Memuat QR Code...</p>
        </div>
        <img id="addBotQrImg" class="mx-auto border rounded-lg" style="width:220px;height:220px;object-fit:contain;display:none" />
        <p class="text-xs text-gray-500 mt-2">Buka WhatsApp &gt; Perangkat Tertaut &gt; Tautkan Perangkat &gt; arahkan kamera ke QR ini. QR akan otomatis refresh sampai berhasil di-scan.</p>
      </div>
      <div id="pairingError" class="hidden">
        <div class="bg-red-50 border border-red-200 rounded-lg p-3">
          <p class="text-sm text-red-700" id="pairingErrorMsg"></p>
        </div>
      </div>
      <div class="flex gap-2 justify-end">
        <button onclick="closeModal()" class="btn btn-outline">Tutup</button>
        <button onclick="startPairing()" id="btnStartPairing" class="btn btn-primary"><i class="fas fa-link mr-1"></i>Mulai Pairing</button>
      </div>
    </div>`);
}

function switchAddMethod(m) {
  addBotMethod = m;
  document.getElementById("addTabCode").className = `btn text-xs flex-1 ${m === "code" ? "btn-primary" : "btn-outline"}`;
  document.getElementById("addTabQr").className = `btn text-xs flex-1 ${m === "qr" ? "btn-primary" : "btn-outline"}`;
  document.getElementById("addPhoneField").classList.toggle("hidden", m === "qr");
  document.getElementById("addMethodHint").textContent = m === "qr"
    ? "Klik Mulai untuk menampilkan QR Code, lalu scan lewat WhatsApp > Perangkat Tertaut > Tautkan Perangkat."
    : "Masukkan nomor WhatsApp yang ingin dijadikan bot. Setelah klik Mulai, pairing code akan muncul. Masukkan code tersebut di WhatsApp > Perangkat Tertaut > Tautkan Perangkat.";
  document.getElementById("pairingResult").classList.add("hidden");
  document.getElementById("qrResult").classList.add("hidden");
  document.getElementById("pairingError").classList.add("hidden");
}

async function startPairing() {
  const name = document.getElementById("botName").value.trim();
  if (!name) return toast("Nama bot wajib diisi", "error");

  const btn = document.getElementById("btnStartPairing");
  document.getElementById("pairingResult").classList.add("hidden");
  document.getElementById("qrResult").classList.add("hidden");
  document.getElementById("pairingError").classList.add("hidden");

  if (addBotMethod === "qr") {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Memulai...';
    try {
      const res = await api("/api/bots/add", { method: "POST", body: { name, method: "qr" } });
      if (res.error) {
        document.getElementById("pairingError").classList.remove("hidden");
        document.getElementById("pairingErrorMsg").textContent = res.error;
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-link mr-1"></i>Mulai Pairing';
        return;
      }
      document.getElementById("qrResult").classList.remove("hidden");
      btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Menunggu Scan...';
      pollBotQr(res.botId, "addBotQrImg");
    } catch (e) {
      document.getElementById("pairingError").classList.remove("hidden");
      document.getElementById("pairingErrorMsg").textContent = e.message || "Gagal memulai pairing";
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-link mr-1"></i>Mulai Pairing';
    }
    return;
  }

  const phone = document.getElementById("botPhone").value.replace(/[^0-9]/g, "");
  if (!phone) return toast("Nomor wajib diisi", "error");
  if (!phone.startsWith("62")) return toast("Nomor harus diawali 62", "error");

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Menunggu...';

  try {
    const res = await api("/api/bots/add", { method: "POST", body: { name, phone, method: "code" } });
    if (res.error) {
      document.getElementById("pairingError").classList.remove("hidden");
      document.getElementById("pairingErrorMsg").textContent = res.error;
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-link mr-1"></i>Mulai Pairing';
      return;
    }
    document.getElementById("pairingResult").classList.remove("hidden");
    document.getElementById("pairingCode").textContent = res.pairingCode;
    btn.innerHTML = '<i class="fas fa-check mr-1"></i>Code Diterima';
    toast("Pairing code berhasil dibuat! Masukkan di WhatsApp.", "success");
    pollPairingCode(res.botId, "pairingCode");
    loadBots();
  } catch (e) {
    document.getElementById("pairingError").classList.remove("hidden");
    document.getElementById("pairingErrorMsg").textContent = e.message || "Gagal memulai pairing";
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-link mr-1"></i>Mulai Pairing';
  }
}

function requestPairingAgain(id, name) {
  repairBotMethod = "qr";
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-qrcode mr-2 text-green-500"></i>Hubungkan Ulang: ${name}</h3>
    <div class="space-y-3">
      <div class="flex gap-2">
        <button id="repairTabCode" onclick="switchRepairMethod('${id}','code')" class="btn btn-outline text-xs flex-1"><i class="fas fa-keyboard mr-1"></i>Kode Pairing</button>
        <button id="repairTabQr" onclick="switchRepairMethod('${id}','qr')" class="btn btn-primary text-xs flex-1"><i class="fas fa-qrcode mr-1"></i>Scan QR Code</button>
      </div>
      <p class="text-xs text-gray-400" id="repairMethodHint">Klik tombol di bawah untuk menampilkan QR Code, lalu scan lewat WhatsApp &gt; Perangkat Tertaut &gt; Tautkan Perangkat.</p>
      <div id="repairResult" class="hidden">
        <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p class="text-sm text-green-800 mb-2">Pairing Code:</p>
          <p class="text-3xl font-bold text-green-700 tracking-widest" id="repairCode"></p>
          <p class="text-xs text-green-600 mt-2">Masukkan code ini di WhatsApp kamu</p>
        </div>
      </div>
      <div id="repairQrResult" class="hidden text-center">
        <div id="repairBotQrImgLoader" class="mx-auto flex flex-col items-center justify-center border rounded-lg bg-gray-50" style="width:220px;height:220px">
          <i class="fas fa-spinner fa-spin text-2xl text-gray-400 mb-2"></i>
          <p class="text-xs text-gray-400">Memuat QR Code...</p>
        </div>
        <img id="repairBotQrImg" class="mx-auto border rounded-lg" style="width:220px;height:220px;object-fit:contain;display:none" />
        <p class="text-xs text-gray-500 mt-2">Buka WhatsApp &gt; Perangkat Tertaut &gt; Tautkan Perangkat &gt; arahkan kamera ke QR ini. QR akan otomatis refresh sampai berhasil di-scan.</p>
      </div>
      <div id="repairError" class="hidden">
        <div class="bg-red-50 border border-red-200 rounded-lg p-3">
          <p class="text-sm text-red-700" id="repairErrorMsg"></p>
        </div>
      </div>
      <div class="flex gap-2 justify-end">
        <button onclick="closeModal()" class="btn btn-outline">Tutup</button>
        <button onclick="startRepair('${id}')" id="btnStartRepair" class="btn btn-primary"><i class="fas fa-qrcode mr-1"></i>Tampilkan QR Code</button>
      </div>
    </div>`);
}

function switchRepairMethod(id, m) {
  repairBotMethod = m;
  document.getElementById("repairTabCode").className = `btn text-xs flex-1 ${m === "code" ? "btn-primary" : "btn-outline"}`;
  document.getElementById("repairTabQr").className = `btn text-xs flex-1 ${m === "qr" ? "btn-primary" : "btn-outline"}`;
  document.getElementById("repairMethodHint").textContent = m === "qr"
    ? "Klik tombol di bawah untuk menampilkan QR Code, lalu scan lewat WhatsApp > Perangkat Tertaut > Tautkan Perangkat."
    : "Bot belum/tidak terhubung. Klik tombol di bawah untuk minta kode pairing baru, lalu masukkan di WhatsApp > Perangkat Tertaut > Tautkan Perangkat sebelum kode kedaluwarsa.";
  document.getElementById("repairResult").classList.add("hidden");
  document.getElementById("repairQrResult").classList.add("hidden");
  document.getElementById("repairError").classList.add("hidden");
  document.getElementById("btnStartRepair").innerHTML = m === "qr"
    ? '<i class="fas fa-qrcode mr-1"></i>Tampilkan QR Code'
    : '<i class="fas fa-link mr-1"></i>Minta Kode Pairing';
}

async function startRepair(id) {
  const btn = document.getElementById("btnStartRepair");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Menunggu...';
  document.getElementById("repairResult").classList.add("hidden");
  document.getElementById("repairQrResult").classList.add("hidden");
  document.getElementById("repairError").classList.add("hidden");

  if (repairBotMethod === "qr") {
    try {
      const res = await api(`/api/bots/${id}/request-qr`, { method: "POST" });
      if (res.error) {
        document.getElementById("repairError").classList.remove("hidden");
        document.getElementById("repairErrorMsg").textContent = res.error;
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-qrcode mr-1"></i>Tampilkan QR Code';
        return;
      }
      document.getElementById("repairQrResult").classList.remove("hidden");
      btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Menunggu Scan...';
      pollBotQr(id, "repairBotQrImg");
    } catch (e) {
      document.getElementById("repairError").classList.remove("hidden");
      document.getElementById("repairErrorMsg").textContent = e.message || "Gagal menampilkan QR";
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-qrcode mr-1"></i>Tampilkan QR Code';
    }
    return;
  }

  try {
    const res = await api(`/api/bots/${id}/pairing-code`, { method: "POST" });
    if (res.error) {
      document.getElementById("repairError").classList.remove("hidden");
      document.getElementById("repairErrorMsg").textContent = res.error;
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-link mr-1"></i>Minta Kode Pairing';
      return;
    }
    document.getElementById("repairResult").classList.remove("hidden");
    document.getElementById("repairCode").textContent = res.pairingCode;
    btn.innerHTML = '<i class="fas fa-check mr-1"></i>Code Diterima';
    toast("Pairing code baru berhasil dibuat! Masukkan di WhatsApp.", "success");
    pollPairingCode(id, "repairCode");
    loadBots();
  } catch (e) {
    document.getElementById("repairError").classList.remove("hidden");
    document.getElementById("repairErrorMsg").textContent = e.message || "Gagal minta kode pairing";
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-link mr-1"></i>Minta Kode Pairing';
  }
}

async function deleteBot(id, name) {
  if (!confirm(`Hapus bot "${name}"? Bot akan di-logout dan dihapus.`)) return;
  try {
    await api(`/api/bots/${id}`, { method: "DELETE" });
    toast("Bot dihapus");
    loadBots();
    showPage("botmanager");
  } catch (e) { toast("Gagal menghapus: " + e.message, "error"); }
}

// ===== BOT ACCESS SHARING (ADMIN ONLY) =====
async function manageBotAccess(botId, botName) {
  const [access, clients] = await Promise.all([
    api(`/api/bots/${botId}/access`),
    api("/api/clients"),
  ]);
  const clientList = clients.filter(c => c.role !== "admin");
  const grantedIds = new Set(access.map(a => a.client_user_id));
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-share-alt mr-2 text-purple-500"></i>Kelola Akses: ${botName}</h3>
    <p class="text-xs text-gray-500 mb-3">Client yang dicentang bisa melihat data bot ini (read-only), tanpa bisa mengubah apapun.</p>
    <div class="space-y-2 max-h-72 overflow-y-auto" id="accessList">
      ${clientList.length === 0 ? '<p class="text-sm text-gray-400">Belum ada akun client. Buat dulu di menu Kelola Client.</p>' : clientList.map(c => `
        <label class="flex items-center gap-2 text-sm border rounded-lg p-2">
          <input type="checkbox" ${grantedIds.has(c.id) ? "checked" : ""} onchange="toggleBotAccess('${botId}', ${c.id}, this.checked)">
          <span class="font-medium">${c.name}</span><span class="text-gray-400">(${c.username})</span>
        </label>`).join("")}
    </div>
    <div class="flex justify-end mt-4"><button onclick="closeModal()" class="btn btn-outline">Tutup</button></div>`);
}

async function toggleBotAccess(botId, clientUserId, granted) {
  try {
    if (granted) {
      await api(`/api/bots/${botId}/access`, { method: "POST", body: { clientUserId } });
      toast("Akses diberikan");
    } else {
      await api(`/api/bots/${botId}/access/${clientUserId}`, { method: "DELETE" });
      toast("Akses dicabut");
    }
  } catch (e) { toast(e.message, "error"); }
}

// ===== CLIENT MANAGEMENT (ADMIN ONLY) =====
async function renderClients(el) {
  const clients = await api("/api/clients");
  el.innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <p class="text-sm text-gray-500">Total: ${clients.length} akun client</p>
      <button onclick="showAddClient()" class="btn btn-primary"><i class="fas fa-plus mr-1"></i>Tambah Client</button>
    </div>
    <div class="card overflow-x-auto">
      <table>
        <thead><tr><th>ID</th><th>Username</th><th>Nama</th><th>Role</th><th>Dibuat</th><th>Aksi</th></tr></thead>
        <tbody>${clients.map(c => `
          <tr>
            <td class="font-mono text-xs">${c.id}</td>
            <td class="font-medium">${c.username}</td>
            <td>${c.name}</td>
            <td><span class="badge ${c.role === "admin" ? "badge-red" : "badge-blue"}">${c.role}</span></td>
            <td class="text-xs text-gray-500">${formatDate(c.created_at)}</td>
            <td class="space-x-1">
              ${c.role !== "admin" ? `
                <button onclick="editClient(${c.id},'${c.username}','${c.name}')" class="btn btn-outline text-xs py-1 px-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteClient(${c.id},'${c.username}')" class="btn btn-danger text-xs py-1 px-2"><i class="fas fa-trash"></i></button>
              ` : '<span class="text-xs text-gray-400">Master</span>'}
            </td>
          </tr>`).join("")}</tbody>
      </table>
      ${clients.length === 0 ? '<p class="text-center py-8 text-gray-400">Belum ada client</p>' : ""}
    </div>`;
}

function showAddClient() {
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-user-plus mr-2 text-purple-500"></i>Tambah Client</h3>
    <div class="space-y-3">
      <div><label class="block text-sm font-medium mb-1">Username *</label><input id="clientUser" placeholder="tokobaru"></div>
      <div><label class="block text-sm font-medium mb-1">Nama *</label><input id="clientName" placeholder="Toko Baru"></div>
      <div><label class="block text-sm font-medium mb-1">Password *</label><input id="clientPass" type="password" placeholder="Min 6 karakter"></div>
      <div class="flex gap-2 justify-end">
        <button onclick="closeModal()" class="btn btn-outline">Batal</button>
        <button onclick="saveClient()" class="btn btn-primary">Simpan</button>
      </div>
    </div>`);
}

async function saveClient() {
  const username = document.getElementById("clientUser").value.trim();
  const name = document.getElementById("clientName").value.trim();
  const password = document.getElementById("clientPass").value;
  if (!username || !name || !password) return toast("Semua kolom wajib diisi", "error");
  if (password.length < 6) return toast("Password minimal 6 karakter", "error");
  try {
    const res = await api("/api/clients", { method: "POST", body: { username, name, password } });
    if (res.error) return toast(res.error, "error");
    closeModal();
    toast("Client berhasil ditambahkan");
    showPage("clients");
  } catch (e) { toast(e.message, "error"); }
}

function editClient(id, username, name) {
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-edit mr-2 text-blue-500"></i>Edit Client</h3>
    <div class="space-y-3">
      <div><label class="block text-sm font-medium mb-1">Username</label><input id="clientUser" value="${username}" disabled class="bg-gray-100"></div>
      <div><label class="block text-sm font-medium mb-1">Nama *</label><input id="clientName" value="${name}"></div>
      <div><label class="block text-sm font-medium mb-1">Password Baru (kosongkan jika tidak ubah)</label><input id="clientPass" type="password"></div>
      <div class="flex gap-2 justify-end">
        <button onclick="closeModal()" class="btn btn-outline">Batal</button>
        <button onclick="updateClient(${id})" class="btn btn-primary">Simpan</button>
      </div>
    </div>`);
}

async function updateClient(id) {
  const name = document.getElementById("clientName").value.trim();
  const password = document.getElementById("clientPass").value;
  if (!name) return toast("Nama wajib diisi", "error");
  const body = { name };
  if (password) {
    if (password.length < 6) return toast("Password minimal 6 karakter", "error");
    body.password = password;
  }
  try {
    const res = await api(`/api/clients/${id}`, { method: "PUT", body });
    if (res.error) return toast(res.error, "error");
    closeModal();
    toast("Client diperbarui");
    showPage("clients");
  } catch (e) { toast(e.message, "error"); }
}

async function deleteClient(id, username) {
  if (!confirm(`Hapus client "${username}"? Semua data client ini akan terhapus.`)) return;
  try {
    await api(`/api/clients/${id}`, { method: "DELETE" });
    toast("Client dihapus");
    showPage("clients");
  } catch (e) { toast(e.message, "error"); }
}

// ===== VOUCHERS =====
async function renderVouchers(el) {
  const vouchers = await api("/api/vouchers");
  el.innerHTML = `
    <div class="flex justify-end mb-4"><button onclick="showAddVoucher()" class="btn btn-primary write-action"><i class="fas fa-plus mr-1"></i>Buat Voucher</button></div>
    <div class="card overflow-x-auto">
      <table>
        <thead><tr><th>Kode</th><th>Tipe</th><th>Nilai</th><th>Min. Order</th><th>Maks Diskon</th><th>Dipakai</th><th>Limit</th><th>Berlaku</th><th>Aksi</th></tr></thead>
        <tbody>${vouchers.map(v => `<tr>
          <td class="font-mono font-bold">${v.code}</td>
          <td>${v.discount_type === "percentage" ? "Persen (%)" : "Nominal (Rp)"}</td>
          <td>${v.discount_type === "percentage" ? v.discount_value + "%" : formatCurrency(v.discount_value)}</td>
          <td>${v.min_order > 0 ? formatCurrency(v.min_order) : "-"}</td>
          <td>${v.max_discount > 0 ? formatCurrency(v.max_discount) : "-"}</td>
          <td>${v.used_count}</td>
          <td>${v.usage_limit > 0 ? v.usage_limit : "∞"}</td>
          <td class="text-xs">${v.valid_until ? formatDate(v.valid_until) : "Tanpa batas"}</td>
          <td><button onclick="delVoucher(${v.id},'${v.code}')" class="btn btn-danger text-xs py-1 px-2 write-action"><i class="fas fa-trash"></i></button></td>
        </tr>`).join("")}</tbody>
      </table>
      ${vouchers.length === 0 ? '<p class="text-center py-8 text-gray-400">Belum ada voucher</p>' : ""}
    </div>`;
}

function showAddVoucher() {
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-tags mr-2 text-orange-500"></i>Buat Voucher</h3>
    <div class="space-y-3">
      <div><label class="block text-sm font-medium mb-1">Kode Voucher *</label><input id="vCode" placeholder="DISKON10" style="text-transform:uppercase"></div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label class="block text-sm font-medium mb-1">Tipe Diskon</label><select id="vType"><option value="percentage">Persen (%)</option><option value="fixed">Nominal (Rp)</option></select></div>
        <div><label class="block text-sm font-medium mb-1">Nilai Diskon *</label><input id="vValue" type="number" placeholder="10"></div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label class="block text-sm font-medium mb-1">Min. Order</label><input id="vMinOrder" type="number" placeholder="0"></div>
        <div><label class="block text-sm font-medium mb-1">Maks Diskon</label><input id="vMaxDiscount" type="number" placeholder="0 = tanpa batas"></div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label class="block text-sm font-medium mb-1">Limit Pemakaian</label><input id="vLimit" type="number" placeholder="0 = tanpa batas"></div>
        <div><label class="block text-sm font-medium mb-1">Berlaku Sampai</label><input id="vUntil" type="date"></div>
      </div>
      <div class="flex gap-2 justify-end mt-4">
        <button onclick="closeModal()" class="btn btn-outline">Batal</button>
        <button onclick="saveVoucher()" class="btn btn-primary">Simpan</button>
      </div>
    </div>`);
}

async function saveVoucher() {
  const code = document.getElementById("vCode").value.trim();
  const discount_value = parseFloat(document.getElementById("vValue").value) || 0;
  if (!code || !discount_value) return toast("Kode dan nilai diskon wajib", "error");
  const data = {
    code, discount_type: document.getElementById("vType").value, discount_value,
    min_order: parseFloat(document.getElementById("vMinOrder").value) || 0,
    max_discount: parseFloat(document.getElementById("vMaxDiscount").value) || 0,
    usage_limit: parseInt(document.getElementById("vLimit").value) || 0,
    valid_until: document.getElementById("vUntil").value || null,
  };
  try { await api("/api/vouchers", { method: "POST", body: data }); closeModal(); toast("Voucher berhasil dibuat"); showPage("vouchers"); } catch(e) { toast(e.message, "error"); }
}

async function delVoucher(id, code) {
  if (!confirm(`Hapus voucher "${code}"?`)) return;
  await api(`/api/vouchers/${id}`, { method: "DELETE" }); toast("Voucher dihapus"); showPage("vouchers");
}

// ===== PAYMENT METHODS =====
const PAYMENT_TYPE_LABEL = { bank_transfer: "Transfer Bank", ewallet: "E-Wallet", cod: "COD", other: "Lainnya" };
const PAYMENT_TYPE_ICON = { bank_transfer: "fa-building-columns", ewallet: "fa-wallet", cod: "fa-handshake", other: "fa-coins" };

async function renderPaymentMethods(el) {
  const methods = await api("/api/payment-methods");
  el.innerHTML = `
    <div class="flex justify-end mb-4"><button onclick="showAddPaymentMethod()" class="btn btn-primary write-action"><i class="fas fa-plus mr-1"></i>Tambah Metode</button></div>
    <div class="card overflow-x-auto">
      <table>
        <thead><tr><th>Tipe</th><th>Nama</th><th>No. Rekening/Akun</th><th>Atas Nama</th><th>Instruksi</th><th>Aksi</th></tr></thead>
        <tbody>${methods.map(m => `<tr>
          <td><i class="fas ${PAYMENT_TYPE_ICON[m.type] || "fa-coins"} mr-1"></i>${PAYMENT_TYPE_LABEL[m.type] || m.type}</td>
          <td class="font-medium">${m.name}</td>
          <td class="font-mono">${m.account_number || "-"}</td>
          <td>${m.account_name || "-"}</td>
          <td class="text-xs">${m.instructions || "-"}</td>
          <td><button onclick="delPaymentMethod(${m.id},'${m.name}')" class="btn btn-danger text-xs py-1 px-2 write-action"><i class="fas fa-trash"></i></button></td>
        </tr>`).join("")}</tbody>
      </table>
      ${methods.length === 0 ? '<p class="text-center py-8 text-gray-400">Belum ada metode pembayaran</p>' : ""}
    </div>`;
}

function showAddPaymentMethod() {
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-wallet mr-2 text-emerald-500"></i>Tambah Metode Pembayaran</h3>
    <div class="space-y-3">
      <div><label class="block text-sm font-medium mb-1">Nama Metode *</label><input id="pmName" placeholder="BCA, GoPay, dll"></div>
      <div><label class="block text-sm font-medium mb-1">Tipe</label><select id="pmType">
        <option value="bank_transfer">Transfer Bank</option>
        <option value="ewallet">E-Wallet</option>
        <option value="cod">COD</option>
        <option value="other">Lainnya</option>
      </select></div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label class="block text-sm font-medium mb-1">No. Rekening/Akun</label><input id="pmNumber" placeholder="1234567890"></div>
        <div><label class="block text-sm font-medium mb-1">Atas Nama</label><input id="pmAccountName" placeholder="Nama pemilik akun"></div>
      </div>
      <div><label class="block text-sm font-medium mb-1">Instruksi Tambahan</label><textarea id="pmInstructions" rows="2" placeholder="Konfirmasi setelah transfer ke admin ya"></textarea></div>
      <div class="flex gap-2 justify-end mt-4">
        <button onclick="closeModal()" class="btn btn-outline">Batal</button>
        <button onclick="savePaymentMethod()" class="btn btn-primary">Simpan</button>
      </div>
    </div>`);
}

async function savePaymentMethod() {
  const name = document.getElementById("pmName").value.trim();
  if (!name) return toast("Nama metode wajib diisi", "error");
  const data = {
    name,
    type: document.getElementById("pmType").value,
    account_number: document.getElementById("pmNumber").value.trim(),
    account_name: document.getElementById("pmAccountName").value.trim(),
    instructions: document.getElementById("pmInstructions").value.trim(),
  };
  try { await api("/api/payment-methods", { method: "POST", body: data }); closeModal(); toast("Metode pembayaran ditambahkan"); showPage("paymentmethods"); } catch(e) { toast(e.message, "error"); }
}

async function delPaymentMethod(id, name) {
  if (!confirm(`Hapus metode pembayaran "${name}"?`)) return;
  await api(`/api/payment-methods/${id}`, { method: "DELETE" }); toast("Metode pembayaran dihapus"); showPage("paymentmethods");
}

// ===== PRODUCT VARIANTS =====
async function showVariants(productId, productName) {
  const variants = await api(`/api/products/${productId}/variants`);
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-palette mr-2 text-yellow-500"></i>Varian: ${productName}</h3>
    <div id="variantList">
      ${variants.length > 0 ? `<table class="mb-4"><thead><tr><th>Nama Varian</th><th>SKU</th><th>+/- Harga</th><th>Stok</th><th>Aksi</th></tr></thead><tbody>${variants.map(v => `<tr>
        <td>${v.variant_name}</td>
        <td class="font-mono text-xs">${v.sku || "-"}</td>
        <td>${v.price_adjustment > 0 ? "+" + formatCurrency(v.price_adjustment) : v.price_adjustment < 0 ? formatCurrency(v.price_adjustment) : "-"}</td>
        <td>${v.stock}</td>
        <td><button onclick="delVariant(${v.id},${productId},'${productName.replace(/'/g, "\\'")}')" class="btn btn-danger text-xs py-1 px-2"><i class="fas fa-trash"></i></button></td>
      </tr>`).join("")}</tbody></table>` : '<p class="text-center py-4 text-gray-400 mb-4">Belum ada varian</p>'}
    </div>
    <hr class="my-3">
    <h4 class="text-sm font-bold mb-2">Tambah Varian</h4>
    <div class="space-y-2">
      <div class="grid grid-cols-2 gap-2">
        <input id="vrName" placeholder="Nama varian (misal: Merah - L)">
        <input id="vrSku" placeholder="SKU (opsional)">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <input id="vrPrice" type="number" placeholder="+/- harga (misal: 5000)">
        <input id="vrStock" type="number" placeholder="Stok">
      </div>
      <div class="flex gap-2 justify-end">
        <button onclick="closeModal()" class="btn btn-outline">Tutup</button>
        <button onclick="addVariantBtn(${productId},'${productName.replace(/'/g, "\\'")}')" class="btn btn-primary">Tambah</button>
      </div>
    </div>`);
}

async function addVariantBtn(productId, productName) {
  const variant_name = document.getElementById("vrName").value.trim();
  if (!variant_name) return toast("Nama varian wajib diisi", "error");
  const data = { variant_name, sku: document.getElementById("vrSku").value || null, price_adjustment: parseFloat(document.getElementById("vrPrice").value) || 0, stock: parseInt(document.getElementById("vrStock").value) || 0 };
  try { await api(`/api/products/${productId}/variants`, { method: "POST", body: data }); toast("Varian ditambahkan"); showVariants(productId, productName); } catch(e) { toast(e.message, "error"); }
}

async function delVariant(variantId, productId, productName) {
  if (!confirm("Hapus varian ini?")) return;
  await api(`/api/variants/${variantId}`, { method: "DELETE" }); toast("Varian dihapus"); showVariants(productId, productName);
}

// ===== PRODUCT IMAGE GALLERY =====
async function showGallery(productId, productName) {
  const images = await api(`/api/products/${productId}/images`);
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-images mr-2 text-blue-500"></i>Galeri Foto: ${productName}</h3>
    <p class="text-xs text-gray-500 mb-3">Foto utama produk (di tab Edit Produk) tetap yang dikirim bot saat menampilkan banyak produk sekaligus. Foto galeri di sini dipakai sebagai foto tambahan saat customer menanyakan produk ini secara spesifik.</p>
    <div id="galleryList" class="grid grid-cols-3 gap-2 mb-4">
      ${images.length > 0 ? images.map(img => `
        <div class="relative">
          <img src="${img.image_url}" class="rounded-lg h-24 w-full object-cover">
          <button onclick="delGalleryImage(${img.id},${productId},'${productName.replace(/'/g, "\\'")}')" class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 text-xs"><i class="fas fa-trash"></i></button>
        </div>`).join("") : '<p class="text-center py-4 text-gray-400 col-span-3">Belum ada foto galeri</p>'}
    </div>
    <hr class="my-3">
    <h4 class="text-sm font-bold mb-2">Tambah Foto</h4>
    <div class="flex gap-2 items-center">
      <input type="file" id="galleryFile" accept="image/*" class="flex-1">
      <button onclick="addGalleryImage(${productId},'${productName.replace(/'/g, "\\'")}')" class="btn btn-primary">Tambah</button>
    </div>
    <div class="flex gap-2 justify-end mt-4">
      <button onclick="closeModal()" class="btn btn-outline">Tutup</button>
    </div>`);
}

async function addGalleryImage(productId, productName) {
  const file = document.getElementById("galleryFile").files[0];
  if (!file) return toast("Pilih foto dulu", "error");
  try {
    const url = await uploadImageFile(file);
    await api(`/api/products/${productId}/images`, { method: "POST", body: { image_url: url } });
    toast("Foto galeri ditambahkan");
    showGallery(productId, productName);
  } catch (e) {
    toast(e.message || "Gagal menambah foto", "error");
  }
}

async function delGalleryImage(imageId, productId, productName) {
  if (!confirm("Hapus foto ini dari galeri?")) return;
  await api(`/api/product-images/${imageId}`, { method: "DELETE" });
  toast("Foto dihapus");
  showGallery(productId, productName);
}

// ===== CSV EXPORT =====
async function exportCSV(type) {
  try {
    const res = await fetch(`/api/export/${type}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${type}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast("File CSV berhasil didownload");
  } catch(e) { toast("Gagal export: " + e.message, "error"); }
}

// ===== LOYALTY =====
async function renderLoyalty(el) {
  const settings = await api("/api/loyalty/settings");
  const customers = await api("/api/customers?limit=200");
  const topCustomers = customers.filter(c => (c.loyalty_points || 0) > 0).sort((a,b) => (b.loyalty_points||0) - (a.loyalty_points||0)).slice(0,20);
  el.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div class="card p-6">
        <h3 class="font-bold mb-4"><i class="fas fa-cog mr-2 text-blue-500"></i>Pengaturan Loyalty</h3>
        <div class="space-y-3">
          <div><label class="block text-sm text-gray-600 mb-1">Poin per Rp1 belanja</label><input id="loyPtsPerRp" type="number" step="0.001" value="${settings.points_per_rupiah || 0.01}"></div>
          <div><label class="block text-sm text-gray-600 mb-1">Min. poin untuk tukar</label><input id="loyMinRedeem" type="number" value="${settings.min_redeem || 100}"></div>
          <div><label class="block text-sm text-gray-600 mb-1">Nilai tukar per poin (Rp)</label><input id="loyRedeemVal" type="number" value="${settings.redeem_value || 1000}"></div>
          <div class="flex items-center gap-2"><input type="checkbox" id="loyActive" ${settings.is_active ? "checked" : ""}><label for="loyActive">Program aktif</label></div>
          <button onclick="saveLoyaltySettings()" class="btn btn-primary write-action">Simpan</button>
        </div>
      </div>
      <div class="card p-6">
        <h3 class="font-bold mb-4"><i class="fas fa-trophy mr-2 text-yellow-500"></i>Top Customer (Poin)</h3>
        ${topCustomers.length > 0 ? `<table><thead><tr><th>Customer</th><th>Poin</th></tr></thead><tbody>
          ${topCustomers.map(c => `<tr><td>${c.name || c.phone}</td><td class="font-bold text-yellow-600">${c.loyalty_points || 0}</td></tr>`).join("")}
        </tbody></table>` : '<p class="text-center text-gray-400 py-4">Belum ada customer dengan poin</p>'}
      </div>
    </div>
    <div class="card p-6">
      <h3 class="font-bold mb-4"><i class="fas fa-hand-holding-heart mr-2 text-green-500"></i>Tambah Poin Manual</h3>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select id="loyCustomer"><option value="">Pilih Customer</option>${customers.map(c => `<option value="${c.id}">${c.name || c.phone}</option>`).join("")}</select>
        <input id="loyPoints" type="number" placeholder="Jumlah poin">
        <div class="flex gap-2"><input id="loyReason" placeholder="Alasan"><button onclick="addManualPoints()" class="btn btn-success write-action">Tambah</button></div>
      </div>
    </div>`;
}

async function saveLoyaltySettings() {
  try {
    await api("/api/loyalty/settings", { method: "PUT", body: {
      points_per_rupiah: parseFloat(document.getElementById("loyPtsPerRp").value) || 0.01,
      min_redeem: parseInt(document.getElementById("loyMinRedeem").value) || 100,
      redeem_value: parseFloat(document.getElementById("loyRedeemVal").value) || 1000,
      is_active: document.getElementById("loyActive").checked ? 1 : 0,
    }});
    toast("Pengaturan loyalty disimpan");
  } catch(e) { toast(e.message, "error"); }
}

async function addManualPoints() {
  const customerId = document.getElementById("loyCustomer").value;
  const points = parseInt(document.getElementById("loyPoints").value);
  const reason = document.getElementById("loyReason").value || "Manual";
  if (!customerId || !points) return toast("Pilih customer dan jumlah poin", "error");
  try {
    await api("/api/loyalty/add", { method: "POST", body: { customerId: parseInt(customerId), points, reason } });
    toast("Poin ditambahkan"); showPage("loyalty");
  } catch(e) { toast(e.message, "error"); }
}

// ===== REFERRAL =====
async function renderReferral(el) {
  const referrals = await api("/api/referrals");
  el.innerHTML = `
    <div class="card p-6 mb-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold"><i class="fas fa-share-alt mr-2 text-pink-500"></i>Daftar Referral</h3>
        <span class="badge badge-blue">${referrals.length} referral</span>
      </div>
      ${referrals.length > 0 ? `
      <div class="overflow-x-auto"><table><thead><tr><th>Pengajak</th><th>Yang Diajak</th><th>Kode</th><th>Reward</th><th>Tanggal</th></tr></thead><tbody>
        ${referrals.map(r => `<tr>
          <td>${r.referrer_name || r.referrer_jid}</td>
          <td>${r.referred_name || r.referred_jid}</td>
          <td class="font-mono text-xs">${r.referral_code}</td>
          <td>${r.reward_given ? '<span class="badge badge-green">Sudah</span>' : '<span class="badge badge-yellow">Belum</span>'}</td>
          <td class="text-xs">${formatDate(r.created_at)}</td>
        </tr>`).join("")}
      </tbody></table></div>` : '<p class="text-center text-gray-400 py-8">Belum ada referral. Customer bisa minta kode referral via WhatsApp dengan ketik "kode referral".</p>'}
    </div>
    <div class="card p-4">
      <p class="text-sm text-gray-600"><i class="fas fa-info-circle mr-1 text-blue-400"></i> Customer otomatis dapat kode referral lewat WhatsApp. Saat teman yang diajak order pertama kali, pengajak dapat poin loyalty sebagai reward.</p>
    </div>`;
}

// ===== BUNDLES =====
async function renderBundles(el) {
  const bundles = await api("/api/bundles");
  el.innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <span class="badge badge-blue">${bundles.length} paket</span>
      <button onclick="showAddBundle()" class="btn btn-primary write-action"><i class="fas fa-plus mr-1"></i>Tambah Bundle</button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${bundles.map(b => `<div class="card p-4">
        <div class="flex justify-between items-start mb-2">
          <h4 class="font-bold">${b.name}</h4>
          <button onclick="delBundle(${b.id},'${(b.name||'').replace(/'/g,"\\'")}')" class="btn btn-danger text-xs py-1 px-2 write-action"><i class="fas fa-trash"></i></button>
        </div>
        <p class="text-sm text-gray-500 mb-2">${b.description || '-'}</p>
        <div class="flex justify-between items-center">
          <div>
            ${b.original_price ? `<span class="text-xs text-gray-400 line-through">${formatCurrency(b.original_price)}</span>` : ''}
            <span class="font-bold text-green-600">${formatCurrency(b.bundle_price)}</span>
          </div>
          <button onclick="viewBundle(${b.id})" class="btn btn-outline text-xs">Detail</button>
        </div>
      </div>`).join("") || '<div class="col-span-full text-center text-gray-400 py-8">Belum ada bundle. Buat paket combo produk untuk meningkatkan penjualan!</div>'}
    </div>`;
}

async function showAddBundle() {
  const products = await api("/api/products");
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-cubes mr-2 text-indigo-500"></i>Tambah Bundle</h3>
    <div class="space-y-3">
      <div><label class="block text-sm text-gray-600 mb-1">Nama Bundle</label><input id="bdlName" placeholder="Paket Hemat A"></div>
      <div><label class="block text-sm text-gray-600 mb-1">Deskripsi</label><input id="bdlDesc" placeholder="Deskripsi singkat"></div>
      <div><label class="block text-sm text-gray-600 mb-1">Harga Bundle (Rp)</label><input id="bdlPrice" type="number" placeholder="Harga spesial paket"></div>
      <div><label class="block text-sm text-gray-600 mb-1">Produk dalam bundle</label>
        <div id="bdlItems" class="space-y-2">
          <div class="flex gap-2"><select class="bdl-prod">${products.map(p => `<option value="${p.id}">${p.name} (${formatCurrency(p.price)})</option>`).join("")}</select><input type="number" class="bdl-qty w-20" value="1" min="1" placeholder="Qty"></div>
        </div>
        <button onclick="addBundleRow()" class="btn btn-outline text-xs mt-2"><i class="fas fa-plus mr-1"></i>Tambah produk</button>
      </div>
      <div class="flex gap-2 justify-end">
        <button onclick="closeModal()" class="btn btn-outline">Batal</button>
        <button onclick="saveBundle()" class="btn btn-primary">Simpan</button>
      </div>
    </div>`);
  window._bdlProducts = products;
}

function addBundleRow() {
  const prods = window._bdlProducts || [];
  const row = document.createElement("div");
  row.className = "flex gap-2";
  row.innerHTML = `<select class="bdl-prod">${prods.map(p => `<option value="${p.id}">${p.name} (${formatCurrency(p.price)})</option>`).join("")}</select><input type="number" class="bdl-qty w-20" value="1" min="1"><button onclick="this.parentElement.remove()" class="btn btn-danger text-xs py-1 px-2"><i class="fas fa-times"></i></button>`;
  document.getElementById("bdlItems").appendChild(row);
}

async function saveBundle() {
  const name = document.getElementById("bdlName").value.trim();
  const bundle_price = parseFloat(document.getElementById("bdlPrice").value);
  if (!name || !bundle_price) return toast("Nama dan harga wajib diisi", "error");
  const prods = document.querySelectorAll(".bdl-prod");
  const qtys = document.querySelectorAll(".bdl-qty");
  const items = [];
  prods.forEach((sel, i) => { items.push({ product_id: parseInt(sel.value), qty: parseInt(qtys[i]?.value) || 1 }); });
  try {
    await api("/api/bundles", { method: "POST", body: { name, description: document.getElementById("bdlDesc").value, bundle_price, items } });
    closeModal(); toast("Bundle ditambahkan"); showPage("bundles");
  } catch(e) { toast(e.message, "error"); }
}

async function viewBundle(id) {
  const b = await api(`/api/bundles/${id}`);
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-cubes mr-2 text-indigo-500"></i>${b.name}</h3>
    <p class="text-sm text-gray-500 mb-3">${b.description || ''}</p>
    <table class="mb-3"><thead><tr><th>Produk</th><th>Qty</th><th>Harga Satuan</th></tr></thead><tbody>
      ${(b.items||[]).map(i => `<tr><td>${i.product_name}</td><td>${i.qty}</td><td>${formatCurrency(i.product_price)}</td></tr>`).join("")}
    </tbody></table>
    <div class="flex justify-between items-center pt-2 border-t">
      <span class="text-sm text-gray-500">Harga normal: ${formatCurrency((b.items||[]).reduce((s,i) => s + i.product_price * i.qty, 0))}</span>
      <span class="font-bold text-green-600 text-lg">${formatCurrency(b.bundle_price)}</span>
    </div>
    <div class="flex justify-end mt-4"><button onclick="closeModal()" class="btn btn-outline">Tutup</button></div>`);
}

async function delBundle(id, name) {
  if (!confirm(`Hapus bundle "${name}"?`)) return;
  await api(`/api/bundles/${id}`, { method: "DELETE" }); toast("Bundle dihapus"); showPage("bundles");
}

// ===== CUSTOMER DETAIL ENHANCED =====
async function viewCustomerDetail(id) {
  const customers = await api("/api/customers");
  const customer = customers.find(c => c.id === id);
  if (!customer) return toast("Customer tidak ditemukan", "error");
  const [timeline, addresses, orders, tickets] = await Promise.all([
    api(`/api/customers/${id}/timeline`),
    api(`/api/customers/${id}/addresses`),
    api(`/api/customers/${id}/orders`),
    api(`/api/customers/${id}/tickets`),
  ]);
  const tierColors = { hot: "badge-red", warm: "badge-yellow", cold: "badge-blue" };
  showModal(`
    <h3 class="text-lg font-bold mb-2">${customer.name || customer.phone}</h3>
    <div class="flex gap-2 flex-wrap mb-4">
      <span class="badge ${tierColors[customer.lead_tier] || 'badge-gray'}">${(customer.lead_tier||'cold').toUpperCase()}</span>
      <span class="badge badge-blue">${customer.loyalty_points || 0} poin</span>
      <span class="badge badge-green">${customer.total_orders || 0} order</span>
      <span class="badge badge-yellow">${formatCurrency(customer.total_spent || 0)}</span>
      ${customer.referral_code ? `<span class="badge badge-gray">REF: ${customer.referral_code}</span>` : ''}
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
      <div><h4 class="text-sm font-bold mb-2">Alamat Tersimpan</h4>
        ${addresses.length > 0 ? addresses.map(a => `<div class="text-sm p-2 border rounded mb-1 ${a.is_default?'border-blue-400 bg-blue-50':''}"><b>${a.label}</b>${a.is_default?' (Default)':''}: ${a.address}</div>`).join("") : '<p class="text-xs text-gray-400">Belum ada alamat</p>'}
      </div>
      <div><h4 class="text-sm font-bold mb-2">Order Terakhir</h4>
        ${orders.slice(0,3).map(o => `<div class="text-sm p-2 border rounded mb-1">${o.order_number} — ${statusBadge(o.status)} ${formatCurrency(o.total)}</div>`).join("") || '<p class="text-xs text-gray-400">Belum ada order</p>'}
      </div>
    </div>
    <h4 class="text-sm font-bold mb-2">Timeline Aktivitas</h4>
    <div class="max-h-60 overflow-y-auto border rounded p-2">
      ${timeline.slice(0,20).map(t => {
        const icon = t.type === 'message' ? (t.direction === 'in' ? '<i class="fas fa-comment text-blue-400"></i>' : '<i class="fas fa-reply text-green-400"></i>') : t.type === 'order' ? '<i class="fas fa-shopping-cart text-purple-400"></i>' : t.type === 'ticket' ? '<i class="fas fa-ticket-alt text-orange-400"></i>' : '<i class="fas fa-star text-yellow-400"></i>';
        return `<div class="flex gap-2 py-1 border-b text-xs"><span class="shrink-0">${icon}</span><span class="flex-1 truncate">${t.detail || '-'}</span><span class="text-gray-400 shrink-0">${formatDate(t.ts)}</span></div>`;
      }).join("") || '<p class="text-center text-gray-400 py-2">Tidak ada aktivitas</p>'}
    </div>
    <div class="flex justify-end mt-4"><button onclick="closeModal()" class="btn btn-outline">Tutup</button></div>`);
}

// ===== AUTOMATION RULES =====
async function renderAutomation(el) {
  const rules = await api("/api/automation/rules");
  const log = await api("/api/automation/log");
  el.innerHTML = `
    <div class="flex justify-end mb-4"><button onclick="showNewRule()" class="btn btn-primary write-action"><i class="fas fa-magic mr-1"></i>Buat Rule Baru</button></div>
    <div class="card overflow-x-auto mb-6">
      <h3 class="font-bold mb-3"><i class="fas fa-list-ol mr-2"></i>Daftar Rules</h3>
      <table>
        <thead><tr><th>Nama</th><th>Trigger</th><th>Action</th><th>Status</th><th>Eksekusi</th><th>Terakhir</th><th>Aksi</th></tr></thead>
        <tbody>${rules.map(r => `<tr>
          <td class="font-medium">${r.name}</td>
          <td><span class="badge badge-blue">${r.trigger_type}</span></td>
          <td><span class="badge badge-green">${r.action_type}</span></td>
          <td>${r.is_active ? '<span class="badge badge-green">Aktif</span>' : '<span class="badge badge-gray">Nonaktif</span>'}</td>
          <td>${r.execution_count || 0}x</td>
          <td class="text-xs text-gray-500">${r.last_executed_at ? formatDate(r.last_executed_at) : "-"}</td>
          <td class="flex gap-1">
            <button onclick="toggleRule(${r.id}, ${r.is_active ? 0 : 1})" class="btn btn-sm ${r.is_active ? 'btn-outline' : 'btn-primary'} write-action">${r.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
            <button onclick="deleteRule(${r.id})" class="btn btn-sm btn-danger write-action"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`).join("")}</tbody>
      </table>
      ${rules.length === 0 ? '<p class="text-center py-6 text-gray-400">Belum ada automation rule. Klik tombol di atas untuk membuat.</p>' : ""}
    </div>
    <div class="card">
      <h3 class="font-bold mb-3"><i class="fas fa-history mr-2"></i>Log Eksekusi (100 terakhir)</h3>
      <table>
        <thead><tr><th>Rule</th><th>Customer</th><th>Hasil</th><th>Waktu</th></tr></thead>
        <tbody>${log.slice(0, 50).map(l => `<tr>
          <td>${l.rule_name || '-'}</td>
          <td class="text-xs">${l.customer_jid || '-'}</td>
          <td>${l.result === 'success' ? '<span class="badge badge-green">OK</span>' : '<span class="badge badge-red">' + (l.result || 'error').slice(0, 50) + '</span>'}</td>
          <td class="text-xs text-gray-500">${formatDate(l.executed_at)}</td>
        </tr>`).join("")}</tbody>
      </table>
      ${log.length === 0 ? '<p class="text-center py-4 text-gray-400">Belum ada eksekusi rule</p>' : ""}
    </div>`;
}

function showNewRule() {
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-magic mr-2 text-violet-500"></i>Buat Automation Rule</h3>
    <div class="space-y-3">
      <div><label class="block text-sm font-medium mb-1">Nama Rule *</label><input id="ruleName" placeholder="Contoh: Auto-reply promo"></div>
      <div><label class="block text-sm font-medium mb-1">Trigger Type *</label>
        <select id="ruleTrigger" onchange="onTriggerChange()">
          <option value="keyword">Keyword (kata kunci di pesan)</option>
          <option value="regex">Regex (pola teks)</option>
          <option value="first_message">First Message (customer baru)</option>
        </select>
      </div>
      <div id="triggerConfigWrap">
        <label class="block text-sm font-medium mb-1">Keywords (pisah koma)</label>
        <input id="ruleKeywords" placeholder="promo, diskon, sale">
      </div>
      <div><label class="block text-sm font-medium mb-1">Action Type *</label>
        <select id="ruleAction" onchange="onActionChange()">
          <option value="send_message">Kirim Pesan Otomatis</option>
          <option value="add_tag">Tambah Tag ke Customer</option>
          <option value="notify_agent">Notifikasi ke Agent</option>
        </select>
      </div>
      <div id="actionConfigWrap">
        <label class="block text-sm font-medium mb-1">Pesan (gunakan {name} untuk nama customer)</label>
        <textarea id="ruleMessage" rows="3" placeholder="Halo {name}! Terima kasih sudah menghubungi kami..."></textarea>
      </div>
      <div class="flex gap-2 justify-end"><button onclick="closeModal()" class="btn btn-outline">Batal</button><button onclick="saveRule()" class="btn btn-primary">Simpan</button></div>
    </div>`);
}

function onTriggerChange() {
  const type = document.getElementById("ruleTrigger").value;
  const wrap = document.getElementById("triggerConfigWrap");
  if (type === "keyword") wrap.innerHTML = '<label class="block text-sm font-medium mb-1">Keywords (pisah koma)</label><input id="ruleKeywords" placeholder="promo, diskon, sale">';
  else if (type === "regex") wrap.innerHTML = '<label class="block text-sm font-medium mb-1">Regex Pattern</label><input id="ruleKeywords" placeholder="(promo|diskon).*\\d+">';
  else wrap.innerHTML = '<p class="text-sm text-gray-500">Tidak ada konfigurasi tambahan. Rule akan jalan saat customer pertama kali mengirim pesan.</p>';
}

function onActionChange() {
  const type = document.getElementById("ruleAction").value;
  const wrap = document.getElementById("actionConfigWrap");
  if (type === "send_message") wrap.innerHTML = '<label class="block text-sm font-medium mb-1">Pesan (gunakan {name} untuk nama customer)</label><textarea id="ruleMessage" rows="3" placeholder="Halo {name}! Terima kasih sudah menghubungi kami..."></textarea>';
  else if (type === "add_tag") wrap.innerHTML = '<label class="block text-sm font-medium mb-1">Nama Tag</label><input id="ruleMessage" placeholder="Contoh: promo_interest">';
  else if (type === "notify_agent") wrap.innerHTML = '<label class="block text-sm font-medium mb-1">Nomor Agent (62xxx)</label><input id="ruleMessage" placeholder="6281234567890">';
}

async function saveRule() {
  const name = document.getElementById("ruleName").value;
  const triggerType = document.getElementById("ruleTrigger").value;
  const actionType = document.getElementById("ruleAction").value;
  const msgEl = document.getElementById("ruleMessage");
  const kwEl = document.getElementById("ruleKeywords");
  if (!name) return toast("Nama rule wajib diisi", "error");
  let trigger_config = {};
  if (triggerType === "keyword" && kwEl) trigger_config = { keywords: kwEl.value };
  else if (triggerType === "regex" && kwEl) trigger_config = { pattern: kwEl.value };
  let action_config = {};
  if (actionType === "send_message" && msgEl) action_config = { message: msgEl.value };
  else if (actionType === "add_tag" && msgEl) action_config = { tag: msgEl.value };
  else if (actionType === "notify_agent" && msgEl) action_config = { agent_jid: msgEl.value };
  try {
    await api("/api/automation/rules", { method: "POST", body: { name, trigger_type: triggerType, trigger_config, action_type: actionType, action_config } });
    closeModal(); toast("Rule berhasil dibuat"); showPage("automation");
  } catch (e) { toast(e.message || "Gagal menyimpan", "error"); }
}

async function toggleRule(id, active) {
  await api(`/api/automation/rules/${id}`, { method: "PUT", body: { is_active: active } });
  toast(active ? "Rule diaktifkan" : "Rule dinonaktifkan"); showPage("automation");
}

async function deleteRule(id) {
  if (!confirm("Hapus rule ini?")) return;
  await api(`/api/automation/rules/${id}`, { method: "DELETE" });
  toast("Rule dihapus"); showPage("automation");
}

// ===== SHARED INBOX =====
async function renderInbox(el) {
  const stats = await api("/api/inbox/stats");
  const agents = await api("/api/agents");
  const statusFilter = "unassigned";
  const chats = await api(`/api/inbox?status=${statusFilter}`);
  const assignedChats = await api("/api/inbox?status=assigned");
  el.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="card text-center"><div class="text-2xl font-bold text-blue-500">${stats.total || 0}</div><div class="text-xs text-gray-500">Total Chat</div></div>
      <div class="card text-center"><div class="text-2xl font-bold text-red-500">${stats.unassigned || 0}</div><div class="text-xs text-gray-500">Belum Diklaim</div></div>
      <div class="card text-center"><div class="text-2xl font-bold text-yellow-500">${stats.assigned || 0}</div><div class="text-xs text-gray-500">Sedang Ditangani</div></div>
      <div class="card text-center"><div class="text-2xl font-bold text-green-500">${stats.resolved || 0}</div><div class="text-xs text-gray-500">Selesai</div></div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="card">
        <h3 class="font-bold mb-3"><i class="fas fa-inbox mr-2 text-red-400"></i>Belum Diklaim (${chats.length})</h3>
        <div class="space-y-2 max-h-96 overflow-y-auto">
          ${chats.length === 0 ? '<p class="text-center py-4 text-gray-400">Tidak ada chat yang menunggu</p>' : chats.map(c => `
            <div class="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
              <div>
                <div class="font-medium">${c.customer_name || c.customer_jid.split("@")[0]}</div>
                <div class="text-xs text-gray-500 truncate max-w-xs">${c.last_message || '-'}</div>
                <div class="text-xs text-gray-400">${formatDate(c.last_message_at)}</div>
              </div>
              <div class="flex gap-1">
                <button onclick="claimChat(${c.id})" class="btn btn-sm btn-primary write-action">Klaim</button>
                ${agents.length > 0 ? `<select onchange="assignChatTo(${c.id}, this.value)" class="text-xs border rounded p-1 write-action"><option value="">Assign ke...</option>${agents.map(a => `<option value="${a.jid}|${a.name}">${a.name}</option>`).join("")}</select>` : ""}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
      <div class="card">
        <h3 class="font-bold mb-3"><i class="fas fa-user-check mr-2 text-yellow-400"></i>Sedang Ditangani (${assignedChats.length})</h3>
        <div class="space-y-2 max-h-96 overflow-y-auto">
          ${assignedChats.length === 0 ? '<p class="text-center py-4 text-gray-400">Tidak ada chat yang sedang ditangani</p>' : assignedChats.map(c => `
            <div class="p-3 bg-gray-50 rounded-lg">
              <div class="flex items-center justify-between">
                <div>
                  <div class="font-medium">${c.customer_name || c.customer_jid.split("@")[0]}</div>
                  <div class="text-xs text-gray-500 truncate max-w-xs">${c.last_message || '-'}</div>
                  <div class="text-xs text-gray-400">${formatDate(c.last_message_at)}</div>
                </div>
                <div class="text-right">
                  <div class="text-xs font-medium text-blue-500">${c.agent_name || c.agent_jid}</div>
                  <div class="flex gap-1 mt-1">
                    <button onclick="showReplyModal(${c.id}, '${(c.customer_name || '').replace(/'/g, "\\'")}', '${c.customer_jid}')" class="btn btn-sm btn-primary write-action">Balas</button>
                    <button onclick="resolveInboxChat(${c.id})" class="btn btn-sm btn-outline write-action">Selesai</button>
                  </div>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>`;
  const badge = document.getElementById("inboxBadge");
  if (badge) { if (stats.unassigned > 0) { badge.textContent = stats.unassigned; badge.classList.remove("hidden"); } else { badge.classList.add("hidden"); } }
}

async function claimChat(id) {
  const me = await api("/api/me");
  await api(`/api/inbox/${id}/assign`, { method: "PUT", body: { agent_jid: me.username || me.name, agent_name: me.name } });
  toast("Chat diklaim"); showPage("inbox");
}

async function assignChatTo(id, val) {
  if (!val) return;
  const [jid, name] = val.split("|");
  await api(`/api/inbox/${id}/assign`, { method: "PUT", body: { agent_jid: jid, agent_name: name } });
  toast(`Chat di-assign ke ${name}`); showPage("inbox");
}

async function resolveInboxChat(id) {
  await api(`/api/inbox/${id}/resolve`, { method: "PUT" });
  toast("Chat selesai"); showPage("inbox");
}

function showReplyModal(id, name, jid) {
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-reply mr-2 text-blue-500"></i>Balas ke ${name || jid.split("@")[0]}</h3>
    <div class="space-y-3">
      <textarea id="inboxReplyMsg" rows="4" placeholder="Tulis balasan..."></textarea>
      <div class="flex gap-2 justify-end"><button onclick="closeModal()" class="btn btn-outline">Batal</button><button onclick="sendInboxReply(${id})" class="btn btn-primary">Kirim</button></div>
    </div>`);
}

async function sendInboxReply(id) {
  const msg = document.getElementById("inboxReplyMsg").value;
  if (!msg) return toast("Pesan tidak boleh kosong", "error");
  try {
    await api(`/api/inbox/${id}/reply`, { method: "POST", body: { message: msg, botId: selectedBotId } });
    closeModal(); toast("Pesan terkirim"); showPage("inbox");
  } catch (e) { toast(e.message || "Gagal mengirim", "error"); }
}

// ===== HANDOFFS =====
async function renderHandoffs(el) {
  const stats = await api("/api/handoffs/stats");
  const handoffs = await api("/api/handoffs");
  el.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="card text-center"><div class="text-2xl font-bold text-blue-500">${stats.total || 0}</div><div class="text-xs text-gray-500">Total Handoff</div></div>
      <div class="card text-center"><div class="text-2xl font-bold text-yellow-500">${stats.pending || 0}</div><div class="text-xs text-gray-500">Pending</div></div>
      <div class="card text-center"><div class="text-2xl font-bold text-orange-500">${stats.active || 0}</div><div class="text-xs text-gray-500">Aktif</div></div>
      <div class="card text-center"><div class="text-2xl font-bold text-green-500">${stats.resolved || 0}</div><div class="text-xs text-gray-500">Selesai</div></div>
    </div>
    <div class="card overflow-x-auto">
      <table>
        <thead><tr><th>Customer</th><th>Agent</th><th>Alasan</th><th>Status</th><th>Waktu</th><th>Aksi</th></tr></thead>
        <tbody>${handoffs.map(h => `<tr>
          <td><div class="font-medium">${h.customer_name || '-'}</div><div class="text-xs text-gray-400">${h.customer_jid}</div></td>
          <td>${h.agent_name || h.agent_jid || '-'}</td>
          <td class="text-xs max-w-xs truncate">${h.reason || '-'}</td>
          <td>${h.status === 'resolved' ? '<span class="badge badge-green">Selesai</span>' : h.status === 'active' ? '<span class="badge badge-yellow">Aktif</span>' : '<span class="badge badge-blue">Pending</span>'}</td>
          <td class="text-xs text-gray-500">${formatDate(h.created_at)}</td>
          <td class="flex gap-1">
            ${h.chat_summary ? `<button onclick="viewHandoffSummary(${h.id})" class="btn btn-sm btn-outline">Chat</button>` : ''}
            ${h.status !== 'resolved' ? `<button onclick="resolveHandoff(${h.id})" class="btn btn-sm btn-primary write-action">Selesai</button>` : ''}
          </td>
        </tr>`).join("")}</tbody>
      </table>
      ${handoffs.length === 0 ? '<p class="text-center py-8 text-gray-400">Belum ada handoff</p>' : ""}
    </div>`;
}

async function resolveHandoff(id) {
  await api(`/api/handoffs/${id}/status`, { method: "PUT", body: { status: "resolved" } });
  toast("Handoff selesai"); showPage("handoffs");
}

async function viewHandoffSummary(id) {
  const handoffs = await api("/api/handoffs");
  const h = handoffs.find(x => x.id === id);
  if (!h || !h.chat_summary) return toast("Tidak ada riwayat chat", "error");
  const lines = h.chat_summary.split("\n").map(l => {
    if (l.startsWith("Customer:")) return `<div class="p-2 bg-green-50 rounded mb-1"><span class="font-medium text-green-700">Customer:</span> ${l.replace("Customer: ", "")}</div>`;
    if (l.startsWith("AI:")) return `<div class="p-2 bg-blue-50 rounded mb-1"><span class="font-medium text-blue-700">AI:</span> ${l.replace("AI: ", "")}</div>`;
    return `<div class="p-2 bg-gray-50 rounded mb-1">${l}</div>`;
  }).join("");
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-comments mr-2 text-blue-500"></i>Riwayat Chat — ${h.customer_name || 'Customer'}</h3>
    <div class="max-h-96 overflow-y-auto space-y-1">${lines}</div>
    <div class="flex justify-end mt-4"><button onclick="closeModal()" class="btn btn-outline">Tutup</button></div>`);
}

// ===== INIT =====
document.getElementById("loginPassword").addEventListener("keydown", e => { if (e.key === "Enter") login(); });

if (token) {
  api("/api/me").then(u => {
    userRole = u.role || "client";
    userId = u.id || "";
    localStorage.setItem("userRole", userRole);
    localStorage.setItem("userId", userId);
    document.getElementById("userName").textContent = u.name || u.username;
    applyRole();
    showDashboard();
  }).catch(() => { token = null; localStorage.removeItem("token"); localStorage.removeItem("userRole"); localStorage.removeItem("userId"); });
} else {
  document.getElementById("loginPage").classList.remove("hidden");
}
