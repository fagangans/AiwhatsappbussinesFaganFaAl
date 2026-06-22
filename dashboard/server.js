import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import QRCode from "qrcode";

import { bulkSend, getRateLimitStatus } from "../WhatsApp/case/business/rate-limiter.js";
import { getLatestQr, getConnectError } from "../WhatsApp/index.js";

import db, {
  getProfile, updateProfile,
  getAllCustomers, getCustomer, updateCustomer, searchCustomers, getCustomerCount,
  getAllProducts, getProduct, addProduct, updateProduct, deleteProduct, getProductCategories, searchProducts,
  getAllOrders, getOrder, getOrderById, updateOrderStatus, getOrderStats, createOrder,
  getAllTickets, getTicket, updateTicketStatus, getTicketStats, createTicket,
  getAllFaq, addFaq, deleteFaq, searchFaq,
  getAllTemplates, addTemplate, deleteTemplate,
  getAllAgents, addAgent, updateAgentStatus,
  getAllBroadcasts, createBroadcast, updateBroadcastStatus,
  addBroadcastMessage, updateBroadcastMessageStatus, refreshBroadcastCounts, getBroadcastMessages, getBroadcastIdByMessageId,
  getBroadcast,
  confirmPayment,
  getDashboardStats, getAnalytics,
  getDashboardUser, getDashboardUserById, createDashboardUser, dashboardUserExists, updateDashboardPassword,
  getAllDashboardUsers, deleteDashboardUser,
  getMessageLogs, getCustomerOrders, getCustomerTickets,
  getAllImportantMessages, markImportantRead, markAllImportantRead, updateImportantNotes, getImportantStats, deleteImportantMessage,
  addBot, getBot, getAllBots, updateBot, deleteBot,
  grantBotAccess, revokeBotAccess, getBotAccessForBot, getGrantedBotsForClient, hasBotAccess,
  addVariant, getVariants, updateVariant, deleteVariant,
  addProductImage, getProductImages, deleteProductImage,
  createVoucher, getAllVouchers, deleteVoucher, validateVoucher,
  getLowStockProducts,
  addPaymentMethod, getAllPaymentMethods, updatePaymentMethod, deletePaymentMethod,
  addLoyaltyPoints, redeemLoyaltyPoints, getLoyaltyHistory, getLoyaltySettings, updateLoyaltySettings,
  generateReferralCode, applyReferral, getReferralStats, getAllReferrals, markReferralRewarded,
  addCustomerAddress, getCustomerAddresses, deleteCustomerAddress, setDefaultAddress,
  createBundle, addBundleItem, getBundleWithItems, getAllBundles, deleteBundle, deleteBundleItem,
  updateLeadScore, getCustomersByLeadTier,
  getCustomerTimeline, getCustomersBySegment,
  createHandoff, getAllHandoffs, updateHandoffStatus, getHandoffStats,
  createAutomationRule, getAllAutomationRules, getActiveAutomationRules, updateAutomationRule, deleteAutomationRule, getAutomationLog,
  upsertChatAssignment, assignChat, unassignChat, resolveChat, getAllChatAssignments, getInboxStats,
} from "../WhatsApp/database/business/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "bisnis-wa-dashboard-secret-key-2024";

const upload = multer({
  dest: path.join(__dirname, "uploads"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    cb(null, allowed.includes(file.mimetype));
  },
});

function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token expired" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Hanya admin yang bisa mengakses" });
  next();
}

function getOwnerId(req) {
  if (req.user.role === "admin") {
    return req.query.ownerId ? parseInt(req.query.ownerId) : null;
  }
  return req.user.id;
}

function getWriteOwnerId(req) {
  return req.user.id;
}

// Resolves { ownerId, botId, readOnly } for GET endpoints.
// Admins keep today's behavior (optional ?ownerId=/?botId= filters, full access).
// Non-admins can pass ?viewBotId= to view a bot they've been granted read-only access to;
// this never affects write endpoints, which always use getWriteOwnerId(req).
function getViewContext(req) {
  const viewBotId = req.query.viewBotId || null;
  if (viewBotId && req.user.role !== "admin") {
    if (!hasBotAccess(viewBotId, req.user.id)) {
      return { ownerId: req.user.id, botId: null, readOnly: true };
    }
    const bot = getBot(viewBotId);
    if (!bot) return { ownerId: req.user.id, botId: null, readOnly: true };
    return { ownerId: bot.owner_id, botId: viewBotId, readOnly: true };
  }
  return { ownerId: getOwnerId(req), botId: req.query.botId || null, readOnly: req.user.role !== "admin" };
}

export default function startDashboard() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "public")));
  app.use("/uploads", express.static(path.join(__dirname, "uploads")));

  const waSockets = new Map();
  const pairingCodes = new Map();

  app.setWaSocket = (botId, botName, socket) => {
    waSockets.set(botId, { name: botName, socket });
  };

  app.removeWaSocket = (botId) => {
    waSockets.delete(botId);
  };

  function getSocket(botId) {
    if (!botId) {
      const first = waSockets.values().next().value;
      return first ? first.socket : null;
    }
    const entry = waSockets.get(botId);
    return entry ? entry.socket : null;
  }

  if (!dashboardUserExists()) {
    const hash = bcrypt.hashSync("admin123", 10);
    createDashboardUser("admin", hash, "Administrator", "admin");
    console.log("[Dashboard] Default user created: admin / admin123");
  }

  // ===== AUTH =====
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = getDashboardUser(username);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Username atau password salah" });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
  });

  app.get("/api/me", auth, (req, res) => {
    res.json(req.user);
  });

  app.put("/api/me/password", auth, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Password baru minimal 6 karakter" });
    }
    const user = getDashboardUser(req.user.username);
    if (!user || !bcrypt.compareSync(currentPassword || "", user.password)) {
      return res.status(400).json({ error: "Password saat ini salah" });
    }
    updateDashboardPassword(user.username, bcrypt.hashSync(newPassword, 10));
    res.json({ success: true });
  });

  // ===== CLIENT MANAGEMENT (admin only) =====
  app.get("/api/clients", auth, adminOnly, (req, res) => {
    res.json(getAllDashboardUsers());
  });

  app.post("/api/clients", auth, adminOnly, (req, res) => {
    const { username, password, name } = req.body;
    if (!username || !password || !name) return res.status(400).json({ error: "Username, password, dan nama wajib diisi" });
    if (password.length < 6) return res.status(400).json({ error: "Password minimal 6 karakter" });
    const existing = getDashboardUser(username);
    if (existing) return res.status(400).json({ error: "Username sudah dipakai" });
    const hash = bcrypt.hashSync(password, 10);
    const user = createDashboardUser(username, hash, name, "client");
    res.json({ success: true, user });
  });

  app.put("/api/clients/:id", auth, adminOnly, (req, res) => {
    const id = parseInt(req.params.id);
    if (id === 1) return res.status(400).json({ error: "Tidak bisa mengubah akun admin utama" });
    const user = getDashboardUserById(id);
    if (!user) return res.status(404).json({ error: "User tidak ditemukan" });
    if (req.body.password) {
      if (req.body.password.length < 6) return res.status(400).json({ error: "Password minimal 6 karakter" });
      updateDashboardPassword(user.username, bcrypt.hashSync(req.body.password, 10));
    }
    if (req.body.name) {
      db.prepare("UPDATE dashboard_users SET name = ? WHERE id = ?").run(req.body.name, id);
    }
    res.json({ success: true });
  });

  app.delete("/api/clients/:id", auth, adminOnly, (req, res) => {
    const id = parseInt(req.params.id);
    if (id === 1) return res.status(400).json({ error: "Tidak bisa menghapus akun admin utama" });
    deleteDashboardUser(id);
    res.json({ success: true });
  });

  // ===== BOTS =====
  app.get("/api/bots", auth, (req, res) => {
    const ownerId = getOwnerId(req);
    const dbBots = getAllBots(ownerId);
    res.json(dbBots.map(b => ({ ...b, connected: waSockets.has(b.id) })));
  });

  // Minta pairing code dari Baileys untuk { id, name, phone, owner_id }, dengan timeout 30s
  function requestPairingCode({ id, name, phone, owner_id }) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout menunggu pairing code")), 30000);
      app.connectBot({
        id,
        name,
        phone,
        owner_id,
        onPairingCode: (code) => {
          clearTimeout(timeout);
          resolve({ code });
        },
        onPairingError: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      }).catch(err => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  // Setelah bot connect via QR (tanpa nomor diisi manual), simpan nomor asli ke DB
  app.onBotConnected = (botId, phone) => {
    const bot = getBot(botId);
    if (bot && phone && !bot.phone) {
      updateBot(botId, { phone });
    }
  };

  // Hentikan percobaan koneksi yang sedang berjalan + hapus sesi auth lama,
  // supaya Baileys menganggap bot belum terdaftar dan mau pairing/QR dari awal
  function resetBotSession(botId) {
    app.stopBot?.(botId);
    waSockets.delete(botId);
    const sessionPath = path.resolve(__dirname, "../sessions", botId);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
  }

  app.post("/api/bots/add", auth, async (req, res) => {
    const { name, phone, method } = req.body;
    const useQr = method === "qr";
    if (!name) return res.status(400).json({ error: "Nama bot wajib diisi" });

    let cleanPhone = "";
    if (!useQr) {
      if (!phone) return res.status(400).json({ error: "Nomor telepon wajib diisi" });
      cleanPhone = phone.replace(/[^0-9]/g, "");
      if (cleanPhone.length < 10) return res.status(400).json({ error: "Nomor telepon tidak valid" });
    }

    if (!app.connectBot) {
      return res.status(503).json({ error: "Sistem bot belum siap, coba lagi nanti" });
    }

    const ownerId = getWriteOwnerId(req);
    const botId = `bot_${Date.now()}_${ownerId}`;
    addBot(botId, ownerId, name, cleanPhone);

    if (useQr) {
      app.connectBot({ id: botId, name, phone: cleanPhone, owner_id: ownerId, method: "qr" }).catch((err) => {
        console.error(`Gagal memulai koneksi QR untuk bot ${botId}:`, err.message || err);
      });
      return res.json({ success: true, botId, method: "qr" });
    }

    try {
      const result = await requestPairingCode({ id: botId, name, phone: cleanPhone, owner_id: ownerId });
      res.json({ success: true, botId, pairingCode: result.code });
    } catch (e) {
      app.stopBot?.(botId);
      waSockets.delete(botId);
      deleteBot(botId);
      res.status(500).json({ error: "Gagal menghubungkan bot: " + e.message });
    }
  });

  function checkBotOwnership(req, res, bot) {
    if (!bot) {
      res.status(404).json({ error: "Bot tidak ditemukan" });
      return false;
    }
    if (req.user.role !== "admin" && bot.owner_id !== req.user.id) {
      res.status(403).json({ error: "Tidak bisa mengelola bot milik orang lain" });
      return false;
    }
    return true;
  }

  // Minta ulang pairing code untuk bot yang sudah ada tapi belum/tidak terhubung
  // (misal kode pairing pertama kelewat waktu) — tanpa hapus bot & buat baru
  app.post("/api/bots/:id/pairing-code", auth, async (req, res) => {
    const bot = getBot(req.params.id);
    if (!checkBotOwnership(req, res, bot)) return;
    if (waSockets.has(bot.id)) {
      return res.status(400).json({ error: "Bot sudah terhubung, tidak perlu pairing ulang" });
    }
    if (!app.connectBot) {
      return res.status(503).json({ error: "Sistem bot belum siap, coba lagi nanti" });
    }

    resetBotSession(bot.id);

    try {
      const result = await requestPairingCode({ id: bot.id, name: bot.name, phone: bot.phone, owner_id: bot.owner_id });
      res.json({ success: true, pairingCode: result.code });
    } catch (e) {
      res.status(500).json({ error: "Gagal mendapatkan kode pairing: " + e.message });
    }
  });

  // Mulai ulang koneksi bot dalam mode QR Code (alternatif dari pairing code) —
  // hanya memulai, hasil QR-nya diambil lewat polling GET /api/bots/:id/qr-code
  app.post("/api/bots/:id/request-qr", auth, async (req, res) => {
    const bot = getBot(req.params.id);
    if (!checkBotOwnership(req, res, bot)) return;
    if (waSockets.has(bot.id)) {
      return res.status(400).json({ error: "Bot sudah terhubung, tidak perlu pairing ulang" });
    }
    if (!app.connectBot) {
      return res.status(503).json({ error: "Sistem bot belum siap, coba lagi nanti" });
    }

    resetBotSession(bot.id);
    app.connectBot({ id: bot.id, name: bot.name, phone: bot.phone, owner_id: bot.owner_id, method: "qr" }).catch((err) => {
      console.error(`Gagal memulai ulang koneksi QR untuk bot ${bot.id}:`, err.message || err);
    });
    res.json({ success: true });
  });

  // Polling: ambil QR code terbaru (base64 PNG) untuk bot yang sedang pairing,
  // atau status sudah terhubung. QR Baileys refresh otomatis tiap ~20-60 detik
  // sehingga frontend perlu polling endpoint ini berulang sampai connected.
  app.get("/api/bots/:id/qr-code", auth, async (req, res) => {
    const bot = getBot(req.params.id);
    if (!checkBotOwnership(req, res, bot)) return;

    if (waSockets.has(bot.id)) {
      return res.json({ connected: true, qr: null });
    }

    const qrRaw = getLatestQr(bot.id);
    if (!qrRaw) {
      const connectError = getConnectError(bot.id);
      if (connectError) return res.json({ connected: false, qr: null, error: connectError });
      return res.json({ connected: false, qr: null });
    }

    try {
      const qrImage = await QRCode.toDataURL(qrRaw, { width: 280, margin: 1 });
      res.json({ connected: false, qr: qrImage });
    } catch (e) {
      res.status(500).json({ error: "Gagal membuat gambar QR: " + e.message });
    }
  });

  app.delete("/api/bots/:id", auth, (req, res) => {
    const bot = getBot(req.params.id);
    if (!bot) return res.status(404).json({ error: "Bot tidak ditemukan" });
    if (req.user.role !== "admin" && bot.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Tidak bisa menghapus bot milik orang lain" });
    }
    const sock = getSocket(req.params.id);
    if (sock) {
      try { sock.logout(); } catch {}
    }
    app.stopBot?.(req.params.id);
    waSockets.delete(req.params.id);
    deleteBot(req.params.id);
    const sessionPath = path.resolve(__dirname, "../sessions", req.params.id);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
    res.json({ success: true });
  });

  // ===== BOT ACCESS (sharing bot read-only ke client) =====
  app.get("/api/bots/:id/access", auth, adminOnly, (req, res) => {
    res.json(getBotAccessForBot(req.params.id));
  });

  app.post("/api/bots/:id/access", auth, adminOnly, (req, res) => {
    const { clientUserId } = req.body;
    if (!clientUserId) return res.status(400).json({ error: "clientUserId wajib diisi" });
    const bot = getBot(req.params.id);
    if (!bot) return res.status(404).json({ error: "Bot tidak ditemukan" });
    const client = getDashboardUserById(parseInt(clientUserId));
    if (!client) return res.status(404).json({ error: "Client tidak ditemukan" });
    const access = grantBotAccess(req.params.id, parseInt(clientUserId), req.user.id);
    res.json({ success: true, access });
  });

  app.delete("/api/bots/:id/access/:clientId", auth, adminOnly, (req, res) => {
    revokeBotAccess(req.params.id, parseInt(req.params.clientId));
    res.json({ success: true });
  });

  app.get("/api/my-bot-access", auth, (req, res) => {
    res.json(getGrantedBotsForClient(req.user.id));
  });

  // ===== DASHBOARD =====
  app.get("/api/dashboard", auth, (req, res) => {
    const ctx = getViewContext(req);
    res.json(getDashboardStats(ctx.ownerId, ctx.botId));
  });

  app.get("/api/analytics", auth, (req, res) => {
    const days = parseInt(req.query.days) || 30;
    res.json(getAnalytics(days, getViewContext(req).ownerId));
  });

  // ===== BUSINESS PROFILE =====
  app.get("/api/profile", auth, (req, res) => {
    res.json(getProfile(getWriteOwnerId(req)));
  });

  app.put("/api/profile", auth, (req, res) => {
    updateProfile(req.body, getWriteOwnerId(req));
    res.json({ success: true, profile: getProfile(getWriteOwnerId(req)) });
  });

  // ===== BOT OWNERS (creator.json) =====
  const CREATOR_PATH = path.join(process.cwd(), "WhatsApp", "database", "creator.json");

  function readCreators() {
    try {
      return JSON.parse(fs.readFileSync(CREATOR_PATH, "utf8"));
    } catch {
      return [];
    }
  }

  function writeCreators(list) {
    fs.writeFileSync(CREATOR_PATH, JSON.stringify(list, null, 2));
  }

  function normalizeOwnerNumber(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    if (!digits) return null;
    return `${digits}@s.whatsapp.net`;
  }

  app.get("/api/bot-owners", auth, adminOnly, (req, res) => {
    res.json(readCreators());
  });

  app.post("/api/bot-owners", auth, adminOnly, (req, res) => {
    const jid = normalizeOwnerNumber(req.body.number);
    if (!jid) return res.status(400).json({ error: "Nomor tidak valid" });
    const list = readCreators();
    if (!list.includes(jid)) {
      list.push(jid);
      writeCreators(list);
    }
    res.json({ success: true, owners: list });
  });

  app.delete("/api/bot-owners/:jid", auth, adminOnly, (req, res) => {
    const list = readCreators().filter((j) => j !== req.params.jid);
    writeCreators(list);
    res.json({ success: true, owners: list });
  });

  // ===== PRODUCTS =====
  app.get("/api/products/low-stock", auth, (req, res) => {
    const threshold = parseInt(req.query.threshold) || 5;
    res.json(getLowStockProducts(threshold, getViewContext(req).ownerId));
  });

  app.get("/api/products", auth, (req, res) => {
    const ownerId = getViewContext(req).ownerId;
    const category = req.query.category || null;
    const search = req.query.search || null;
    if (search) return res.json(searchProducts(search, ownerId));
    res.json(getAllProducts(category, ownerId));
  });

  app.get("/api/products/categories", auth, (req, res) => {
    res.json(getProductCategories(getViewContext(req).ownerId));
  });

  app.get("/api/products/:id", auth, (req, res) => {
    const product = getProduct(parseInt(req.params.id));
    if (!product) return res.status(404).json({ error: "Not found" });
    if (req.user.role !== "admin" && product.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Tidak bisa melihat produk milik orang lain" });
    }
    res.json(product);
  });

  app.post("/api/products", auth, (req, res) => {
    try {
      req.body.owner_id = getWriteOwnerId(req);
      const result = addProduct(req.body);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/products/:id", auth, (req, res) => {
    const existing = getProduct(parseInt(req.params.id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (req.user.role !== "admin" && existing.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Tidak bisa mengubah produk milik orang lain" });
    }
    updateProduct(parseInt(req.params.id), req.body);
    res.json({ success: true });
  });

  app.delete("/api/products/:id", auth, (req, res) => {
    const existing = getProduct(parseInt(req.params.id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (req.user.role !== "admin" && existing.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Tidak bisa menghapus produk milik orang lain" });
    }
    deleteProduct(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.post("/api/products/upload", auth, upload.single("image"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file" });
    res.json({ url: `/uploads/${req.file.filename}` });
  });

  // ===== CUSTOMERS =====
  app.get("/api/customers", auth, (req, res) => {
    const ctx = getViewContext(req);
    const search = req.query.search || null;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    if (search) return res.json(searchCustomers(search, ctx.ownerId, ctx.botId));
    res.json(getAllCustomers(limit, offset, ctx.ownerId, ctx.botId));
  });

  app.get("/api/customers/count", auth, (req, res) => {
    const ctx = getViewContext(req);
    res.json({ count: getCustomerCount(ctx.ownerId, ctx.botId) });
  });

  app.get("/api/customers/:jid", auth, (req, res) => {
    const ctx = getViewContext(req);
    const customer = getCustomer(req.params.jid, ctx.ownerId, ctx.botId);
    if (!customer) return res.status(404).json({ error: "Not found" });
    res.json(customer);
  });

  app.put("/api/customers/:id", auth, (req, res) => {
    const existing = db.prepare("SELECT owner_id FROM customers WHERE id = ?").get(parseInt(req.params.id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (req.user.role !== "admin" && existing.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Tidak bisa mengubah customer milik orang lain" });
    }
    updateCustomer(parseInt(req.params.id), req.body);
    res.json({ success: true });
  });

  app.get("/api/customers/:id/orders", auth, (req, res) => {
    res.json(getCustomerOrders(parseInt(req.params.id)));
  });

  app.get("/api/customers/:id/tickets", auth, (req, res) => {
    res.json(getCustomerTickets(parseInt(req.params.id)));
  });

  app.get("/api/customers/:id/messages", auth, (req, res) => {
    res.json(getMessageLogs(parseInt(req.params.id), parseInt(req.query.limit) || 50));
  });

  // ===== ORDERS =====
  app.get("/api/orders", auth, (req, res) => {
    const ctx = getViewContext(req);
    const status = req.query.status || null;
    const limit = parseInt(req.query.limit) || 50;
    res.json(getAllOrders(status, limit, ctx.ownerId, ctx.botId));
  });

  app.get("/api/orders/stats", auth, (req, res) => {
    const ctx = getViewContext(req);
    res.json(getOrderStats(ctx.ownerId, ctx.botId));
  });

  app.get("/api/orders/:orderNumber", auth, (req, res) => {
    const order = getOrder(req.params.orderNumber, getViewContext(req).ownerId);
    if (!order) return res.status(404).json({ error: "Not found" });
    res.json(order);
  });

  app.put("/api/orders/:orderNumber/status", auth, (req, res) => {
    const existing = getOrder(req.params.orderNumber);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (req.user.role !== "admin" && existing.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Tidak bisa mengubah order milik orang lain" });
    }
    updateOrderStatus(req.params.orderNumber, req.body.status);
    const waSocket = getSocket(req.body.botId);
    if (waSocket && req.body.notify) {
      const order = getOrder(req.params.orderNumber);
      if (order) {
        const statusMap = { confirmed: "dikonfirmasi", processing: "sedang diproses", shipped: "sudah dikirim", delivered: "sudah diterima", cancelled: "dibatalkan" };
        const msg = `📦 *Update Pesanan*\n\nNo. Order: ${order.order_number}\nStatus: *${statusMap[req.body.status] || req.body.status}*${req.body.tracking ? `\nNo. Resi: ${req.body.tracking}` : ""}`;
        waSocket.sendMessage(order.customer_jid, { text: msg }).catch(() => {});
      }
    }
    res.json({ success: true });
  });

  app.put("/api/orders/:orderNumber/confirm-payment", auth, (req, res) => {
    const order = getOrder(req.params.orderNumber);
    if (!order) return res.status(404).json({ error: "Not found" });
    if (req.user.role !== "admin" && order.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Tidak bisa mengubah order milik orang lain" });
    }
    confirmPayment(order.id);
    updateOrderStatus(req.params.orderNumber, "confirmed");
    const waSocket = getSocket(req.body?.botId);
    if (waSocket) {
      waSocket.sendMessage(order.customer_jid, {
        text: `✅ *Pembayaran Dikonfirmasi!*\n\nNo. Order: ${order.order_number}\nPembayaran Anda telah dikonfirmasi. Pesanan sedang diproses.`,
      }).catch(() => {});
    }
    res.json({ success: true });
  });

  // ===== TICKETS =====
  app.get("/api/tickets", auth, (req, res) => {
    const ctx = getViewContext(req);
    const status = req.query.status || null;
    res.json(getAllTickets(status, 50, ctx.ownerId, ctx.botId));
  });

  app.get("/api/tickets/stats", auth, (req, res) => {
    const ctx = getViewContext(req);
    res.json(getTicketStats(ctx.ownerId, ctx.botId));
  });

  app.get("/api/tickets/:ticketNumber", auth, (req, res) => {
    const ticket = getTicket(req.params.ticketNumber, getViewContext(req).ownerId);
    if (!ticket) return res.status(404).json({ error: "Not found" });
    res.json(ticket);
  });

  app.put("/api/tickets/:ticketNumber/status", auth, (req, res) => {
    const existingTicket = getTicket(req.params.ticketNumber);
    if (!existingTicket) return res.status(404).json({ error: "Not found" });
    if (req.user.role !== "admin" && existingTicket.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Tidak bisa mengubah tiket milik orang lain" });
    }
    updateTicketStatus(req.params.ticketNumber, req.body.status, req.body.resolution || "");
    const waSocket = getSocket(req.body.botId);
    if (waSocket && req.body.notify) {
      const ticket = getTicket(req.params.ticketNumber);
      if (ticket) {
        const statusMap = { in_progress: "sedang ditangani", resolved: "terselesaikan", closed: "ditutup" };
        let msg = `🎫 *Update Tiket*\n\nNo. Tiket: ${ticket.ticket_number}\nStatus: *${statusMap[req.body.status] || req.body.status}*`;
        if (req.body.resolution) msg += `\nResolusi: ${req.body.resolution}`;
        waSocket.sendMessage(ticket.customer_jid, { text: msg }).catch(() => {});
      }
    }
    res.json({ success: true });
  });

  // ===== FAQ =====
  app.get("/api/faq", auth, (req, res) => {
    res.json(getAllFaq(getViewContext(req).ownerId));
  });

  app.post("/api/faq", auth, (req, res) => {
    addFaq(req.body.question, req.body.answer, req.body.keywords || [], req.body.category || "Umum", getWriteOwnerId(req));
    res.json({ success: true });
  });

  app.delete("/api/faq/:id", auth, (req, res) => {
    const existing = db.prepare("SELECT owner_id FROM faq WHERE id = ?").get(parseInt(req.params.id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (req.user.role !== "admin" && existing.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Tidak bisa menghapus FAQ milik orang lain" });
    }
    deleteFaq(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ===== TEMPLATES =====
  app.get("/api/templates", auth, (req, res) => {
    res.json(getAllTemplates(getViewContext(req).ownerId));
  });

  app.post("/api/templates", auth, (req, res) => {
    try {
      addTemplate(req.body.name, req.body.content, req.body.category || "Umum", [], getWriteOwnerId(req));
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/templates/:name", auth, (req, res) => {
    deleteTemplate(req.params.name, getOwnerId(req));
    res.json({ success: true });
  });

  // ===== AGENTS =====
  app.get("/api/agents", auth, (req, res) => {
    res.json(getAllAgents(getViewContext(req).ownerId));
  });

  app.post("/api/agents", auth, (req, res) => {
    const agent = addAgent(req.body.jid, req.body.name, req.body.role || "agent", getWriteOwnerId(req));
    res.json(agent);
  });

  app.put("/api/agents/:jid/status", auth, (req, res) => {
    updateAgentStatus(req.params.jid, req.body.is_online, getOwnerId(req));
    res.json({ success: true });
  });

  // ===== BROADCASTS =====
  app.get("/api/broadcasts", auth, (req, res) => {
    res.json(getAllBroadcasts(getViewContext(req).ownerId));
  });

  app.post("/api/broadcasts", auth, async (req, res) => {
    const ownerId = getWriteOwnerId(req);
    const bc = createBroadcast(req.body.title, req.body.message, req.body.target_tags || [], ownerId);
    const waSocket = getSocket(req.body.botId);
    if (req.body.send_now && waSocket) {
      const targetTags = req.body.target_tags || [];
      let customers;
      if (targetTags.length > 0) {
        customers = getAllCustomers(1000, 0, ownerId).filter(c => {
          const tags = JSON.parse(c.tags || "[]");
          return targetTags.some(t => tags.includes(t));
        });
      } else {
        customers = getAllCustomers(1000, 0, ownerId).filter(c => !c.is_blocked);
      }
      const result = await bulkSend(waSocket, customers, (c) => ({ text: `📢 *${req.body.title}*\n━━━━━━━━━━━━━━━━━━━━━\n\n${req.body.message}` }), {}, req.body.botId);
      for (const key of result.sentKeys || []) {
        addBroadcastMessage(bc.id, key.jid, key.messageId);
      }
      updateBroadcastStatus(bc.id, "sent", result.sent, result.failed);
    }
    res.json({ success: true, broadcast: bc });
  });

  app.get("/api/broadcasts/:id/stats", auth, (req, res) => {
    const bc = getBroadcast(parseInt(req.params.id));
    if (!bc) return res.status(404).json({ error: "Broadcast tidak ditemukan" });
    res.json({
      ...bc,
      open_rate: bc.sent_count > 0 ? ((bc.read_count / bc.sent_count) * 100).toFixed(1) : "0.0",
      delivery_rate: bc.sent_count > 0 ? ((bc.delivered_count / bc.sent_count) * 100).toFixed(1) : "0.0",
    });
  });

  app.get("/api/broadcasts/:id/messages", auth, (req, res) => {
    res.json(getBroadcastMessages(parseInt(req.params.id)));
  });

  // ===== SEND MESSAGE =====
  app.post("/api/send-message", auth, async (req, res) => {
    const waSocket = getSocket(req.body.botId);
    if (!waSocket) return res.status(503).json({ error: "WhatsApp not connected" });
    const { jid, message } = req.body;
    try {
      await waSocket.sendMessage(jid, { text: message });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ===== IMPORTANT MESSAGES =====
  app.get("/api/important", auth, (req, res) => {
    const ctx = getViewContext(req);
    const botId = ctx.botId || req.query.botId || null;
    const isRead = req.query.unread === "1" ? 0 : null;
    const limit = parseInt(req.query.limit) || 100;
    res.json(getAllImportantMessages(botId, isRead, limit, ctx.ownerId));
  });

  app.get("/api/important/stats", auth, (req, res) => {
    res.json(getImportantStats(getViewContext(req).ownerId));
  });

  app.put("/api/important/:id/read", auth, (req, res) => {
    const existing = db.prepare("SELECT owner_id FROM important_messages WHERE id = ?").get(parseInt(req.params.id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (req.user.role !== "admin" && existing.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Tidak bisa mengubah pesan milik orang lain" });
    }
    markImportantRead(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.put("/api/important/read-all", auth, (req, res) => {
    markAllImportantRead(req.body?.botId || null, getOwnerId(req));
    res.json({ success: true });
  });

  app.put("/api/important/:id/notes", auth, (req, res) => {
    const existing = db.prepare("SELECT owner_id FROM important_messages WHERE id = ?").get(parseInt(req.params.id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (req.user.role !== "admin" && existing.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Tidak bisa mengubah pesan milik orang lain" });
    }
    updateImportantNotes(parseInt(req.params.id), req.body.notes || "");
    res.json({ success: true });
  });

  app.delete("/api/important/:id", auth, (req, res) => {
    const existing = db.prepare("SELECT owner_id FROM important_messages WHERE id = ?").get(parseInt(req.params.id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (req.user.role !== "admin" && existing.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Tidak bisa menghapus pesan milik orang lain" });
    }
    deleteImportantMessage(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ===== PRODUCT VARIANTS =====
  app.get("/api/products/:id/variants", auth, (req, res) => {
    res.json(getVariants(parseInt(req.params.id)));
  });

  app.post("/api/products/:id/variants", auth, (req, res) => {
    const product = getProduct(parseInt(req.params.id));
    if (!product) return res.status(404).json({ error: "Product not found" });
    if (req.user.role !== "admin" && product.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const v = addVariant(product.id, req.body.variant_name, req.body.sku || null, req.body.price_adjustment || 0, req.body.stock || 0);
      res.json({ success: true, variant: v });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/variants/:id", auth, (req, res) => {
    try {
      updateVariant(parseInt(req.params.id), req.body);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/variants/:id", auth, (req, res) => {
    deleteVariant(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ===== PRODUCT IMAGES (galeri foto tambahan) =====
  app.get("/api/products/:id/images", auth, (req, res) => {
    res.json(getProductImages(parseInt(req.params.id)));
  });

  app.post("/api/products/:id/images", auth, (req, res) => {
    const product = getProduct(parseInt(req.params.id));
    if (!product) return res.status(404).json({ error: "Product not found" });
    if (req.user.role !== "admin" && product.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!req.body.image_url) return res.status(400).json({ error: "image_url wajib diisi" });
    try {
      const images = addProductImage(product.id, req.body.image_url);
      res.json({ success: true, images });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/product-images/:id", auth, (req, res) => {
    deleteProductImage(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ===== VOUCHERS =====
  app.get("/api/vouchers", auth, (req, res) => {
    res.json(getAllVouchers(getViewContext(req).ownerId));
  });

  app.post("/api/vouchers", auth, (req, res) => {
    try {
      req.body.owner_id = getWriteOwnerId(req);
      const v = createVoucher(req.body);
      res.json({ success: true, voucher: v });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/vouchers/:id", auth, (req, res) => {
    deleteVoucher(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.post("/api/vouchers/validate", auth, (req, res) => {
    const result = validateVoucher(req.body.code, req.body.total || 0, getViewContext(req).ownerId);
    res.json(result);
  });

  // ===== PAYMENT METHODS =====
  app.get("/api/payment-methods", auth, (req, res) => {
    res.json(getAllPaymentMethods(getViewContext(req).ownerId));
  });

  app.post("/api/payment-methods", auth, (req, res) => {
    try {
      req.body.owner_id = getWriteOwnerId(req);
      const m = addPaymentMethod(req.body);
      res.json({ success: true, method: m });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/payment-methods/:id", auth, (req, res) => {
    try {
      updatePaymentMethod(parseInt(req.params.id), req.body);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/payment-methods/:id", auth, (req, res) => {
    deletePaymentMethod(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ===== CSV EXPORT =====
  app.get("/api/export/:type", auth, (req, res) => {
    const ctx = getViewContext(req);
    const type = req.params.type;
    let rows, headers;
    if (type === "products") {
      rows = getAllProducts(null, ctx.ownerId);
      headers = ["SKU", "Nama", "Harga", "Harga Diskon", "Kategori", "Stok", "Status"];
      const csv = [headers.join(","), ...rows.map(r => [r.sku || "", `"${(r.name || "").replace(/"/g, '""')}"`, r.price, r.discount_price, `"${r.category}"`, r.stock, r.is_active ? "Aktif" : "Nonaktif"].join(","))].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=products_${Date.now()}.csv`);
      return res.send("﻿" + csv);
    }
    if (type === "orders") {
      rows = getAllOrders(null, 10000, ctx.ownerId, ctx.botId);
      headers = ["No Order", "Customer", "Items", "Total", "Status", "Pembayaran", "Catatan", "Tanggal"];
      const csv = [headers.join(","), ...rows.map(r => [r.order_number, `"${(r.customer_name || "").replace(/"/g, '""')}"`, `"${(r.items || "").replace(/"/g, '""')}"`, r.total, r.status, r.payment_status, `"${(r.notes || "").replace(/"/g, '""')}"`, r.created_at].join(","))].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=orders_${Date.now()}.csv`);
      return res.send("﻿" + csv);
    }
    if (type === "customers") {
      rows = getAllCustomers(10000, 0, ctx.ownerId, ctx.botId);
      headers = ["Nama", "No HP", "Email", "Total Order", "Total Belanja", "Rating", "Kontak Pertama", "Kontak Terakhir"];
      const csv = [headers.join(","), ...rows.map(r => [`"${(r.name || "").replace(/"/g, '""')}"`, r.phone, r.email || "", r.total_orders, r.total_spent, r.satisfaction_avg, r.first_contact, r.last_contact].join(","))].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=customers_${Date.now()}.csv`);
      return res.send("﻿" + csv);
    }
    res.status(400).json({ error: "Tipe export tidak valid. Gunakan: products, orders, customers" });
  });

  // ===== SCHEDULED BROADCASTS =====
  app.post("/api/broadcasts/schedule", auth, async (req, res) => {
    const ownerId = getWriteOwnerId(req);
    const bc = createBroadcast(req.body.title, req.body.message, req.body.target_tags || [], ownerId);
    const scheduledAt = req.body.scheduled_at;
    if (!scheduledAt) return res.status(400).json({ error: "scheduled_at diperlukan" });
    db.prepare("UPDATE broadcasts SET scheduled_at = ?, status = 'scheduled' WHERE id = ?").run(scheduledAt, bc.id);
    const delay = new Date(scheduledAt).getTime() - Date.now();
    if (delay > 0 && delay < 7 * 24 * 60 * 60 * 1000) {
      setTimeout(async () => {
        const waSocket = getSocket(req.body.botId);
        if (!waSocket) return;
        const targetTags = req.body.target_tags || [];
        let customers;
        if (targetTags.length > 0) {
          customers = getAllCustomers(1000, 0, ownerId).filter(c => {
            const tags = JSON.parse(c.tags || "[]");
            return targetTags.some(t => tags.includes(t));
          });
        } else {
          customers = getAllCustomers(1000, 0, ownerId).filter(c => !c.is_blocked);
        }
        const result = await bulkSend(waSocket, customers, (c) => ({ text: `📢 *${req.body.title}*\n━━━━━━━━━━━━━━━━━━━━━\n\n${req.body.message}` }), {}, req.body.botId);
        for (const key of result.sentKeys || []) {
          addBroadcastMessage(bc.id, key.jid, key.messageId);
        }
        updateBroadcastStatus(bc.id, "sent", result.sent, result.failed);
      }, delay);
    }
    res.json({ success: true, broadcast: bc, scheduled_at: scheduledAt });
  });

  // ===== LOYALTY =====
  app.get("/api/loyalty/settings", auth, (req, res) => {
    const ownerId = getOwnerId(req) || req.user.id;
    res.json(getLoyaltySettings(ownerId));
  });

  app.put("/api/loyalty/settings", auth, (req, res) => {
    const ownerId = getWriteOwnerId(req);
    updateLoyaltySettings(req.body, ownerId);
    res.json({ success: true });
  });

  app.get("/api/loyalty/:customerId", auth, (req, res) => {
    const history = getLoyaltyHistory(parseInt(req.params.customerId));
    res.json(history);
  });

  app.post("/api/loyalty/add", auth, (req, res) => {
    const { customerId, points, reason } = req.body;
    const ownerId = getWriteOwnerId(req);
    const result = addLoyaltyPoints(customerId, points, reason || "Manual", null, ownerId);
    res.json(result);
  });

  app.post("/api/loyalty/redeem", auth, (req, res) => {
    const { customerId, points } = req.body;
    const result = redeemLoyaltyPoints(customerId, points);
    res.json(result);
  });

  // ===== REFERRALS =====
  app.get("/api/referrals", auth, (req, res) => {
    const { ownerId } = getViewContext(req);
    res.json(getAllReferrals(ownerId));
  });

  app.post("/api/referrals/generate", auth, (req, res) => {
    const code = generateReferralCode(req.body.customerId);
    res.json({ code });
  });

  app.get("/api/referrals/:customerId/stats", auth, (req, res) => {
    res.json(getReferralStats(parseInt(req.params.customerId)));
  });

  // ===== CUSTOMER ADDRESSES =====
  app.get("/api/customers/:id/addresses", auth, (req, res) => {
    res.json(getCustomerAddresses(parseInt(req.params.id)));
  });

  app.post("/api/customers/:id/addresses", auth, (req, res) => {
    const addr = addCustomerAddress(parseInt(req.params.id), req.body.label || "Rumah", req.body.address, req.body.is_default ? 1 : 0);
    res.json(addr);
  });

  app.delete("/api/addresses/:id", auth, (req, res) => {
    deleteCustomerAddress(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.put("/api/addresses/:id/default", auth, (req, res) => {
    setDefaultAddress(parseInt(req.params.id), req.body.customerId);
    res.json({ success: true });
  });

  // ===== BUNDLES =====
  app.get("/api/bundles", auth, (req, res) => {
    const { ownerId } = getViewContext(req);
    res.json(getAllBundles(ownerId));
  });

  app.get("/api/bundles/:id", auth, (req, res) => {
    const bundle = getBundleWithItems(parseInt(req.params.id));
    if (!bundle) return res.status(404).json({ error: "Bundle tidak ditemukan" });
    res.json(bundle);
  });

  app.post("/api/bundles", auth, (req, res) => {
    const ownerId = getWriteOwnerId(req);
    const bundle = createBundle(req.body.name, req.body.description, req.body.bundle_price, ownerId);
    if (req.body.items) {
      for (const item of req.body.items) {
        addBundleItem(bundle.id, item.product_id, item.qty || 1);
      }
    }
    res.json(getBundleWithItems(bundle.id));
  });

  app.delete("/api/bundles/:id", auth, (req, res) => {
    deleteBundle(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ===== CUSTOMER TIMELINE =====
  app.get("/api/customers/:id/timeline", auth, (req, res) => {
    res.json(getCustomerTimeline(parseInt(req.params.id)));
  });

  // ===== LEAD SCORING =====
  app.post("/api/customers/:id/update-lead", auth, (req, res) => {
    const result = updateLeadScore(parseInt(req.params.id));
    res.json(result || { score: 0, tier: "cold" });
  });

  app.get("/api/customers/leads/:tier", auth, (req, res) => {
    const { ownerId } = getViewContext(req);
    res.json(getCustomersByLeadTier(req.params.tier, ownerId));
  });

  // ===== BROADCAST SEGMENTS =====
  app.get("/api/segments/:segment/count", auth, (req, res) => {
    const { ownerId } = getViewContext(req);
    const customers = getCustomersBySegment(req.params.segment, ownerId);
    res.json({ segment: req.params.segment, count: customers.length });
  });

  app.post("/api/broadcasts/segment", auth, (req, res) => {
    const ownerId = getWriteOwnerId(req);
    const { title, message, segment, botId } = req.body;
    const customers = getCustomersBySegment(segment, ownerId);
    if (customers.length === 0) return res.status(400).json({ error: "Tidak ada customer di segmen ini" });
    const bc = createBroadcast(title, message, [segment], ownerId);
    const waSocket = getSocket(botId);
    if (waSocket) {
      (async () => {
        const result = await bulkSend(waSocket, customers, (c) => ({ text: `📢 *${title}*\n━━━━━━━━━━━━━━━━━━━━━\n\n${message}` }), {}, botId);
        for (const key of result.sentKeys || []) {
          addBroadcastMessage(bc.id, key.jid, key.messageId);
        }
        updateBroadcastStatus(bc.id, "sent", result.sent, result.failed);
      })();
    }
    res.json({ success: true, broadcast: bc, recipients: customers.length });
  });

  // ===== EXPORT ENHANCED =====
  app.get("/api/export/analytics", auth, (req, res) => {
    const { ownerId } = getViewContext(req);
    const data = getAnalytics(req.query.days ? parseInt(req.query.days) : 30, ownerId);
    const bom = "﻿";
    let csv = bom + "Tanggal,Pesan Masuk,Pesan Keluar,Customer Baru,Order,Revenue,Tiket Dibuka,Tiket Selesai\n";
    data.forEach(r => { csv += `${r.date},${r.messages_in},${r.messages_out},${r.new_customers},${r.orders_count},${r.revenue},${r.tickets_opened},${r.tickets_resolved}\n`; });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=analytics.csv");
    res.send(csv);
  });

  app.get("/api/export/tickets", auth, (req, res) => {
    const { ownerId, botId } = getViewContext(req);
    const data = getAllTickets(null, 1000, ownerId, botId);
    const bom = "﻿";
    let csv = bom + "No Tiket,Customer,Subject,Prioritas,Status,Dibuat,Updated\n";
    data.forEach(r => { csv += `${r.ticket_number},"${(r.customer_name||'').replace(/"/g,'""')}","${(r.subject||'').replace(/"/g,'""')}",${r.priority},${r.status},${r.created_at},${r.updated_at}\n`; });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=tickets.csv");
    res.send(csv);
  });

  // ===== RATE LIMIT STATUS =====
  app.get("/api/rate-limit-status", auth, (req, res) => {
    res.json(getRateLimitStatus(req.query.botId || "default"));
  });

  // ===== HANDOFFS =====
  app.get("/api/handoffs", auth, (req, res) => {
    const { ownerId } = getViewContext(req);
    const status = req.query.status || null;
    res.json(getAllHandoffs(ownerId, status));
  });

  app.get("/api/handoffs/stats", auth, (req, res) => {
    res.json(getHandoffStats(getViewContext(req).ownerId));
  });

  app.put("/api/handoffs/:id/status", auth, (req, res) => {
    updateHandoffStatus(parseInt(req.params.id), req.body.status);
    res.json({ success: true });
  });

  // ===== AUTOMATION RULES =====
  app.get("/api/automation/rules", auth, (req, res) => {
    res.json(getAllAutomationRules(getViewContext(req).ownerId));
  });

  app.post("/api/automation/rules", auth, (req, res) => {
    try {
      req.body.owner_id = getWriteOwnerId(req);
      const rule = createAutomationRule(req.body);
      res.json({ success: true, rule });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/automation/rules/:id", auth, (req, res) => {
    try {
      updateAutomationRule(parseInt(req.params.id), req.body);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/automation/rules/:id", auth, (req, res) => {
    deleteAutomationRule(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.get("/api/automation/log", auth, (req, res) => {
    res.json(getAutomationLog(getViewContext(req).ownerId));
  });

  // ===== SHARED INBOX =====
  app.get("/api/inbox", auth, (req, res) => {
    const { ownerId } = getViewContext(req);
    const status = req.query.status || null;
    const agentJid = req.query.agent || null;
    res.json(getAllChatAssignments(ownerId, status, agentJid));
  });

  app.get("/api/inbox/stats", auth, (req, res) => {
    res.json(getInboxStats(getViewContext(req).ownerId));
  });

  app.put("/api/inbox/:id/assign", auth, (req, res) => {
    const { agent_jid, agent_name } = req.body;
    if (!agent_jid) return res.status(400).json({ error: "agent_jid diperlukan" });
    const result = assignChat(parseInt(req.params.id), agent_jid, agent_name || "");
    res.json({ success: true, assignment: result });
  });

  app.put("/api/inbox/:id/unassign", auth, (req, res) => {
    unassignChat(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.put("/api/inbox/:id/resolve", auth, (req, res) => {
    resolveChat(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.post("/api/inbox/:id/reply", auth, async (req, res) => {
    const assignment = db.prepare("SELECT * FROM chat_assignments WHERE id = ?").get(parseInt(req.params.id));
    if (!assignment) return res.status(404).json({ error: "Chat tidak ditemukan" });
    const waSocket = getSocket(req.body.botId || assignment.bot_id);
    if (!waSocket) return res.status(503).json({ error: "WhatsApp tidak terhubung" });
    try {
      await waSocket.sendMessage(assignment.customer_jid, { text: req.body.message });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ===== SPA FALLBACK =====
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  const PORT = process.env.DASHBOARD_PORT || 3000;
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Dashboard] Running at http://localhost:${PORT}`);
  });

  const wss = new WebSocketServer({ server });
  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "connected" }));
  });

  app.broadcast = (data) => {
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(data));
      }
    });
  };

  return app;
}
