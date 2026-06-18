const API = "";
let token = localStorage.getItem("token");
let currentPage = "dashboard";

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401) { logout(); throw new Error("Unauthorized"); }
  return res.json();
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

function showModal(html) {
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("modal").classList.remove("hidden");
  document.getElementById("modal").classList.add("flex");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  document.getElementById("modal").classList.remove("flex");
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
    document.getElementById("userName").textContent = data.user.name;
    showDashboard();
  } catch (e) {
    document.getElementById("loginError").textContent = "Koneksi gagal";
    document.getElementById("loginError").classList.remove("hidden");
  }
}

function logout() {
  token = null;
  localStorage.removeItem("token");
  document.getElementById("loginPage").classList.remove("hidden");
  document.getElementById("mainApp").classList.add("hidden");
}

function showDashboard() {
  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById("mainApp").classList.remove("hidden");
  document.getElementById("currentDate").textContent = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  showPage("dashboard");
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

// ===== PAGE ROUTER =====
async function showPage(page) {
  currentPage = page;
  document.querySelectorAll(".sidebar-link").forEach(l => l.classList.remove("active"));
  document.querySelector(`[data-page="${page}"]`)?.classList.add("active");
  const titles = {
    dashboard: "Dashboard", products: "Produk", orders: "Order", customers: "Customer",
    tickets: "Tiket Support", faq: "FAQ", templates: "Template", broadcast: "Broadcast",
    agents: "Agents", analytics: "Analytics", settings: "Pengaturan Bisnis",
  };
  document.getElementById("pageTitle").textContent = titles[page] || page;
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
      case "analytics": await renderAnalytics(content); break;
      case "settings": await renderSettings(content); break;
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
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
    </div>`;
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
      <button onclick="showAddProduct()" class="btn btn-primary"><i class="fas fa-plus mr-1"></i>Tambah Produk</button>
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
              <button onclick="editProduct(${p.id})" class="btn btn-outline text-xs py-1 px-2"><i class="fas fa-edit"></i></button>
              <button onclick="delProduct(${p.id},'${p.name}')" class="btn btn-danger text-xs py-1 px-2"><i class="fas fa-trash"></i></button>
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
  document.getElementById("productsTable").innerHTML = products.map(p => `<tr><td class="font-mono text-xs">${p.sku||"-"}</td><td class="font-medium">${p.name}</td><td>${p.category}</td><td>${formatCurrency(p.price)}</td><td>${p.discount_price>0?formatCurrency(p.discount_price):"-"}</td><td><span class="${p.stock<=0?"text-red-500 font-bold":p.stock<=5?"text-yellow-500 font-bold":"text-green-600"}">${p.stock}</span></td><td class="space-x-1"><button onclick="editProduct(${p.id})" class="btn btn-outline text-xs py-1 px-2"><i class="fas fa-edit"></i></button><button onclick="delProduct(${p.id},'${p.name}')" class="btn btn-danger text-xs py-1 px-2"><i class="fas fa-trash"></i></button></td></tr>`).join("");
}, 300); }

async function filterProductsCat() {
  const cat = document.getElementById("productCatFilter").value;
  const products = cat ? await api(`/api/products?category=${encodeURIComponent(cat)}`) : await api("/api/products");
  document.getElementById("productsTable").innerHTML = products.map(p => `<tr><td class="font-mono text-xs">${p.sku||"-"}</td><td class="font-medium">${p.name}</td><td>${p.category}</td><td>${formatCurrency(p.price)}</td><td>${p.discount_price>0?formatCurrency(p.discount_price):"-"}</td><td><span class="${p.stock<=0?"text-red-500 font-bold":p.stock<=5?"text-yellow-500 font-bold":"text-green-600"}">${p.stock}</span></td><td class="space-x-1"><button onclick="editProduct(${p.id})" class="btn btn-outline text-xs py-1 px-2"><i class="fas fa-edit"></i></button><button onclick="delProduct(${p.id},'${p.name}')" class="btn btn-danger text-xs py-1 px-2"><i class="fas fa-trash"></i></button></td></tr>`).join("");
}

function showAddProduct() {
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-plus mr-2 text-blue-500"></i>Tambah Produk</h3>
    <div class="space-y-3">
      <div><label class="block text-sm font-medium mb-1">SKU</label><input id="pSku" placeholder="KP001"></div>
      <div><label class="block text-sm font-medium mb-1">Nama *</label><input id="pName" placeholder="Nama Produk"></div>
      <div><label class="block text-sm font-medium mb-1">Deskripsi</label><textarea id="pDesc" rows="2" placeholder="Deskripsi produk"></textarea></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="block text-sm font-medium mb-1">Harga *</label><input id="pPrice" type="number" placeholder="50000"></div>
        <div><label class="block text-sm font-medium mb-1">Harga Diskon</label><input id="pDiscount" type="number" placeholder="0"></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="block text-sm font-medium mb-1">Stok</label><input id="pStock" type="number" placeholder="100"></div>
        <div><label class="block text-sm font-medium mb-1">Kategori</label><input id="pCategory" placeholder="Umum"></div>
      </div>
      <div class="flex gap-2 justify-end mt-4">
        <button onclick="closeModal()" class="btn btn-outline">Batal</button>
        <button onclick="saveProduct()" class="btn btn-primary">Simpan</button>
      </div>
    </div>`);
}

async function saveProduct() {
  const data = { sku: document.getElementById("pSku").value, name: document.getElementById("pName").value, description: document.getElementById("pDesc").value, price: parseFloat(document.getElementById("pPrice").value) || 0, discount_price: parseFloat(document.getElementById("pDiscount").value) || 0, stock: parseInt(document.getElementById("pStock").value) || 0, category: document.getElementById("pCategory").value || "Umum", image_url: "" };
  if (!data.name || !data.price) return toast("Nama dan harga wajib diisi", "error");
  try { await api("/api/products", { method: "POST", body: data }); closeModal(); toast("Produk berhasil ditambahkan"); showPage("products"); } catch(e) { toast(e.message, "error"); }
}

async function editProduct(id) {
  const p = await api(`/api/products/${id}`);
  showModal(`
    <h3 class="text-lg font-bold mb-4"><i class="fas fa-edit mr-2 text-blue-500"></i>Edit Produk</h3>
    <div class="space-y-3">
      <div><label class="block text-sm font-medium mb-1">SKU</label><input id="pSku" value="${p.sku||""}"></div>
      <div><label class="block text-sm font-medium mb-1">Nama *</label><input id="pName" value="${p.name}"></div>
      <div><label class="block text-sm font-medium mb-1">Deskripsi</label><textarea id="pDesc" rows="2">${p.description||""}</textarea></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="block text-sm font-medium mb-1">Harga *</label><input id="pPrice" type="number" value="${p.price}"></div>
        <div><label class="block text-sm font-medium mb-1">Harga Diskon</label><input id="pDiscount" type="number" value="${p.discount_price||0}"></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="block text-sm font-medium mb-1">Stok</label><input id="pStock" type="number" value="${p.stock}"></div>
        <div><label class="block text-sm font-medium mb-1">Kategori</label><input id="pCategory" value="${p.category}"></div>
      </div>
      <div class="flex gap-2 justify-end mt-4">
        <button onclick="closeModal()" class="btn btn-outline">Batal</button>
        <button onclick="updateProd(${id})" class="btn btn-primary">Simpan</button>
      </div>
    </div>`);
}

async function updateProd(id) {
  const data = { sku: document.getElementById("pSku").value, name: document.getElementById("pName").value, description: document.getElementById("pDesc").value, price: parseFloat(document.getElementById("pPrice").value), discount_price: parseFloat(document.getElementById("pDiscount").value) || 0, stock: parseInt(document.getElementById("pStock").value) || 0, category: document.getElementById("pCategory").value || "Umum" };
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
    <div class="flex gap-2 mb-4">
      <select id="orderFilter" onchange="filterOrders()" class="w-48"><option value="">Semua Status</option><option value="pending">Pending</option><option value="confirmed">Dikonfirmasi</option><option value="processing">Diproses</option><option value="shipped">Dikirim</option><option value="delivered">Selesai</option><option value="cancelled">Dibatalkan</option></select>
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
            <button onclick="changeOrderStatus('${o.order_number}','${o.status}')" class="btn btn-primary text-xs py-1 px-2"><i class="fas fa-edit"></i></button>
            ${o.payment_status !== "paid" ? `<button onclick="confirmPay('${o.order_number}')" class="btn btn-success text-xs py-1 px-2" title="Konfirmasi bayar"><i class="fas fa-check"></i></button>` : ""}
          </td>
        </tr>`).join("")}</tbody>
      </table>
      ${orders.length === 0 ? '<p class="text-center py-8 text-gray-400">Belum ada order</p>' : ""}
    </div>`;
}

async function filterOrders() { const s = document.getElementById("orderFilter").value; const orders = await api(`/api/orders${s?"?status="+s:""}`); document.getElementById("ordersTable").innerHTML = orders.map(o => `<tr><td class="font-mono text-xs font-medium">${o.order_number}</td><td>${o.customer_name}</td><td class="font-medium">${formatCurrency(o.total)}</td><td>${statusBadge(o.status)}</td><td>${statusBadge(o.payment_status)}</td><td class="text-xs text-gray-500">${formatDate(o.created_at)}</td><td class="space-x-1"><button onclick="viewOrder('${o.order_number}')" class="btn btn-outline text-xs py-1 px-2"><i class="fas fa-eye"></i></button><button onclick="changeOrderStatus('${o.order_number}','${o.status}')" class="btn btn-primary text-xs py-1 px-2"><i class="fas fa-edit"></i></button>${o.payment_status!=="paid"?`<button onclick="confirmPay('${o.order_number}')" class="btn btn-success text-xs py-1 px-2"><i class="fas fa-check"></i></button>`:""}</td></tr>`).join(""); }

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
      <table class="text-sm"><thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead><tbody>${items.map(i=>`<tr><td>${i.name}</td><td>${i.qty}</td><td>${formatCurrency(i.price)}</td><td>${formatCurrency(i.price*i.qty)}</td></tr>`).join("")}</tbody></table>
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

async function doUpdateOrder(num) { const status = document.getElementById("newOrderStatus").value; const notify = document.getElementById("notifyCustomer").checked; await api(`/api/orders/${num}/status`, { method: "PUT", body: { status, notify } }); closeModal(); toast("Status order diperbarui"); showPage("orders"); }

async function confirmPay(num) { if (!confirm(`Konfirmasi pembayaran order ${num}?`)) return; await api(`/api/orders/${num}/confirm-payment`, { method: "PUT" }); toast("Pembayaran dikonfirmasi"); showPage("orders"); }

// ===== CUSTOMERS =====
async function renderCustomers(el) {
  const customers = await api("/api/customers");
  const count = await api("/api/customers/count");
  el.innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <input type="text" id="custSearch" placeholder="Cari customer..." class="w-64" onkeyup="searchCustDebounce()">
      <span class="text-sm text-gray-500">Total: ${count.count}</span>
    </div>
    <div class="card overflow-x-auto">
      <table>
        <thead><tr><th>Nama</th><th>Telepon</th><th>Tags</th><th>Order</th><th>Total Belanja</th><th>Rating</th><th>Terakhir</th><th>Aksi</th></tr></thead>
        <tbody id="custTable">${customers.map(c => {
          const tags = JSON.parse(c.tags || "[]");
          return `<tr>
            <td class="font-medium">${c.name || "Tanpa Nama"} ${c.is_blocked ? '<span class="badge badge-red">Blokir</span>' : ""}</td>
            <td class="font-mono text-xs">${c.phone}</td>
            <td>${tags.map(t=>`<span class="badge badge-blue">${t}</span>`).join(" ")}</td>
            <td>${c.total_orders}</td>
            <td>${formatCurrency(c.total_spent)}</td>
            <td>${c.satisfaction_avg ? c.satisfaction_avg.toFixed(1)+"⭐" : "-"}</td>
            <td class="text-xs text-gray-500">${formatDate(c.last_contact)}</td>
            <td><button onclick="viewCustomer(${c.id},'${c.jid}')" class="btn btn-outline text-xs py-1 px-2"><i class="fas fa-eye"></i></button></td>
          </tr>`; }).join("")}</tbody>
      </table>
      ${customers.length === 0 ? '<p class="text-center py-8 text-gray-400">Belum ada customer</p>' : ""}
    </div>`;
}

let custSearchTimer;
function searchCustDebounce() { clearTimeout(custSearchTimer); custSearchTimer = setTimeout(async () => { const q = document.getElementById("custSearch").value; const customers = q ? await api(`/api/customers?search=${encodeURIComponent(q)}`) : await api("/api/customers"); document.getElementById("custTable").innerHTML = customers.map(c => { const tags = JSON.parse(c.tags||"[]"); return `<tr><td class="font-medium">${c.name||"Tanpa Nama"}</td><td class="font-mono text-xs">${c.phone}</td><td>${tags.map(t=>`<span class="badge badge-blue">${t}</span>`).join(" ")}</td><td>${c.total_orders}</td><td>${formatCurrency(c.total_spent)}</td><td>${c.satisfaction_avg?c.satisfaction_avg.toFixed(1)+"⭐":"-"}</td><td class="text-xs text-gray-500">${formatDate(c.last_contact)}</td><td><button onclick="viewCustomer(${c.id},'${c.jid}')" class="btn btn-outline text-xs py-1 px-2"><i class="fas fa-eye"></i></button></td></tr>`; }).join(""); }, 300); }

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
      <button onclick="sendMsgToCustomer('${c.jid}')" class="btn btn-success text-xs"><i class="fas fa-paper-plane mr-1"></i>Kirim Pesan</button>
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

async function doSendMsg(jid) { const msg = document.getElementById("msgContent").value; if (!msg) return; try { await api("/api/send-message", { method: "POST", body: { jid, message: msg } }); closeModal(); toast("Pesan terkirim"); } catch(e) { toast("Gagal kirim: "+e.message, "error"); } }

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
          <td><button onclick="updateTicket('${t.ticket_number}','${t.status}')" class="btn btn-primary text-xs py-1 px-2"><i class="fas fa-edit"></i></button></td>
        </tr>`).join("")}</tbody>
      </table>
      ${tickets.length === 0 ? '<p class="text-center py-8 text-gray-400">Tidak ada tiket</p>' : ""}
    </div>`;
}

async function filterTickets() { const s = document.getElementById("ticketFilter").value; const tickets = await api(`/api/tickets${s?"?status="+s:""}`); document.getElementById("ticketsTable").innerHTML = tickets.map(t=>`<tr><td class="font-mono text-xs">${t.ticket_number}</td><td>${t.customer_name}</td><td class="font-medium">${t.subject}</td><td><span class="badge ${t.priority==="urgent"?"badge-red":t.priority==="high"?"badge-yellow":"badge-gray"}">${t.priority}</span></td><td>${statusBadge(t.status)}</td><td class="text-xs text-gray-500">${formatDate(t.created_at)}</td><td><button onclick="updateTicket('${t.ticket_number}','${t.status}')" class="btn btn-primary text-xs py-1 px-2"><i class="fas fa-edit"></i></button></td></tr>`).join(""); }

function updateTicket(num, current) {
  showModal(`
    <h3 class="text-lg font-bold mb-4">Update Tiket ${num}</h3>
    <select id="newTicketStatus" class="mb-3"><option value="open" ${current==="open"?"selected":""}>Open</option><option value="in_progress" ${current==="in_progress"?"selected":""}>In Progress</option><option value="resolved" ${current==="resolved"?"selected":""}>Resolved</option><option value="closed" ${current==="closed"?"selected":""}>Closed</option></select>
    <textarea id="ticketResolution" rows="3" placeholder="Resolusi (opsional)..." class="mb-3"></textarea>
    <label class="flex items-center gap-2 text-sm mb-3"><input type="checkbox" id="notifyTicket" checked> Notifikasi customer</label>
    <div class="flex gap-2 justify-end"><button onclick="closeModal()" class="btn btn-outline">Batal</button><button onclick="doUpdateTicket('${num}')" class="btn btn-primary">Update</button></div>`);
}

async function doUpdateTicket(num) { await api(`/api/tickets/${num}/status`, { method: "PUT", body: { status: document.getElementById("newTicketStatus").value, resolution: document.getElementById("ticketResolution").value, notify: document.getElementById("notifyTicket").checked } }); closeModal(); toast("Tiket diperbarui"); showPage("tickets"); }

// ===== FAQ =====
async function renderFaq(el) {
  const faqs = await api("/api/faq");
  el.innerHTML = `
    <div class="flex justify-end mb-4"><button onclick="showAddFaq()" class="btn btn-primary"><i class="fas fa-plus mr-1"></i>Tambah FAQ</button></div>
    <div class="space-y-3" id="faqList">${faqs.map(f => `
      <div class="card p-4">
        <div class="flex justify-between items-start">
          <div><p class="font-bold text-gray-800">${f.question}</p><p class="text-sm text-gray-600 mt-1">${f.answer}</p><p class="text-xs text-gray-400 mt-2">Kategori: ${f.category} | Dilihat: ${f.hit_count}x</p></div>
          <button onclick="delFaq(${f.id})" class="btn btn-danger text-xs py-1 px-2"><i class="fas fa-trash"></i></button>
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
    <div class="flex justify-end mb-4"><button onclick="showAddTemplate()" class="btn btn-primary"><i class="fas fa-plus mr-1"></i>Tambah Template</button></div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">${templates.map(t => `
      <div class="card p-4">
        <div class="flex justify-between items-start mb-2">
          <div><h4 class="font-bold">${t.name}</h4><span class="badge badge-blue">${t.category}</span></div>
          <button onclick="delTpl('${t.name}')" class="btn btn-danger text-xs py-1 px-2"><i class="fas fa-trash"></i></button>
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
    <div class="flex justify-end mb-4"><button onclick="showNewBroadcast()" class="btn btn-primary"><i class="fas fa-bullhorn mr-1"></i>Buat Broadcast</button></div>
    <div class="card overflow-x-auto">
      <table>
        <thead><tr><th>Judul</th><th>Target</th><th>Terkirim</th><th>Status</th><th>Tanggal</th></tr></thead>
        <tbody>${broadcasts.map(b => { const tags = JSON.parse(b.target_tags||"[]"); return `<tr>
          <td class="font-medium">${b.title}</td>
          <td>${tags.length?tags.join(", "):"Semua"}</td>
          <td>${b.sent_count}</td>
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
      <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="bcSendNow" checked> Kirim sekarang</label>
      <div class="flex gap-2 justify-end"><button onclick="closeModal()" class="btn btn-outline">Batal</button><button onclick="doBroadcast()" class="btn btn-primary">Kirim</button></div>
    </div>`);
}

async function doBroadcast() { const t = document.getElementById("bcTitle").value, m = document.getElementById("bcMsg").value; if (!t||!m) return toast("Judul dan pesan wajib","error"); const tags = document.getElementById("bcTags").value.split(",").map(s=>s.trim()).filter(Boolean); await api("/api/broadcasts", { method: "POST", body: { title: t, message: m, target_tags: tags, send_now: document.getElementById("bcSendNow").checked } }); closeModal(); toast("Broadcast dikirim"); showPage("broadcast"); }

// ===== AGENTS =====
async function renderAgents(el) {
  const agents = await api("/api/agents");
  el.innerHTML = `
    <div class="flex justify-end mb-4"><button onclick="showAddAgent()" class="btn btn-primary"><i class="fas fa-plus mr-1"></i>Tambah Agent</button></div>
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
          <button onclick="toggleAgent('${a.jid}',${a.is_online?0:1})" class="btn ${a.is_online?"btn-warning":"btn-success"} text-xs flex-1">${a.is_online?"Set Offline":"Set Online"}</button>
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
async function renderSettings(el) {
  const p = await api("/api/profile");
  el.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="card p-6">
        <h3 class="text-lg font-bold mb-4"><i class="fas fa-store mr-2 text-blue-500"></i>Profil Bisnis</h3>
        <div class="space-y-3">
          <div><label class="block text-sm font-medium mb-1">Nama Bisnis</label><input id="sName" value="${p.name||""}"></div>
          <div><label class="block text-sm font-medium mb-1">Deskripsi</label><textarea id="sDesc" rows="2">${p.description||""}</textarea></div>
          <div><label class="block text-sm font-medium mb-1">Kategori</label><input id="sCat" value="${p.category||""}"></div>
          <div><label class="block text-sm font-medium mb-1">Alamat</label><textarea id="sAddr" rows="2">${p.address||""}</textarea></div>
          <div class="grid grid-cols-2 gap-3">
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
          <div class="grid grid-cols-2 gap-3">
            <div><label class="block text-sm font-medium mb-1">Jam Buka</label><input id="sOpen" type="number" min="0" max="23" value="${p.open_hour}"></div>
            <div><label class="block text-sm font-medium mb-1">Jam Tutup</label><input id="sClose" type="number" min="0" max="24" value="${p.close_hour}"></div>
          </div>
          <button onclick="saveHours()" class="btn btn-primary w-full mt-3">Simpan Jam</button>
        </div>
        <div class="card p-6">
          <h3 class="text-lg font-bold mb-4"><i class="fas fa-comment mr-2 text-purple-500"></i>Pesan Otomatis</h3>
          <div class="space-y-3">
            <div><label class="block text-sm font-medium mb-1">Welcome Message</label><textarea id="sWelcome" rows="3">${p.welcome_message||""}</textarea><p class="text-xs text-gray-400 mt-1">Variable: {nama}, {greeting}, {bisnis}</p></div>
            <div><label class="block text-sm font-medium mb-1">Away Message</label><textarea id="sAway" rows="3">${p.away_message||""}</textarea></div>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="sAutoReply" ${p.auto_reply_enabled?"checked":""}> Auto Reply</label>
              <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="sAI" ${p.ai_enabled?"checked":""}> AI CS</label>
            </div>
            <button onclick="saveMessages()" class="btn btn-primary w-full">Simpan Pesan</button>
          </div>
        </div>
      </div>
    </div>`;
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
  await api("/api/profile", { method: "PUT", body: { welcome_message: document.getElementById("sWelcome").value, away_message: document.getElementById("sAway").value, auto_reply_enabled: document.getElementById("sAutoReply").checked ? 1 : 0, ai_enabled: document.getElementById("sAI").checked ? 1 : 0 } });
  toast("Pesan otomatis disimpan");
}

// ===== INIT =====
document.getElementById("loginPassword").addEventListener("keydown", e => { if (e.key === "Enter") login(); });

if (token) {
  api("/api/me").then(u => { document.getElementById("userName").textContent = u.name || u.username; showDashboard(); }).catch(() => { token = null; localStorage.removeItem("token"); });
} else {
  document.getElementById("loginPage").classList.remove("hidden");
}
