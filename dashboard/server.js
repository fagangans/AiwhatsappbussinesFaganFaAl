import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

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
  confirmPayment,
  getDashboardStats, getAnalytics,
  getDashboardUser, getDashboardUserById, createDashboardUser, dashboardUserExists, updateDashboardPassword,
  getAllDashboardUsers, deleteDashboardUser,
  getMessageLogs, getCustomerOrders, getCustomerTickets,
  getAllImportantMessages, markImportantRead, markAllImportantRead, updateImportantNotes, getImportantStats, deleteImportantMessage,
  addBot, getBot, getAllBots, updateBot, deleteBot,
  grantBotAccess, revokeBotAccess, getBotAccessForBot, getGrantedBotsForClient, hasBotAccess,
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

  app.post("/api/bots/add", auth, async (req, res) => {
    const { name, phone } = req.body;
    if (!name || !phone) return res.status(400).json({ error: "Nama dan nomor telepon wajib diisi" });
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.length < 10) return res.status(400).json({ error: "Nomor telepon tidak valid" });

    const ownerId = getWriteOwnerId(req);
    const botId = `bot_${Date.now()}_${ownerId}`;
    addBot(botId, ownerId, name, cleanPhone);

    if (!app.connectBot) {
      return res.status(503).json({ error: "Sistem bot belum siap, coba lagi nanti" });
    }

    try {
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout menunggu pairing code")), 30000);
        app.connectBot({
          id: botId,
          name,
          phone: cleanPhone,
          owner_id: ownerId,
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
      res.json({ success: true, botId, pairingCode: result.code });
    } catch (e) {
      app.stopBot?.(botId);
      waSockets.delete(botId);
      deleteBot(botId);
      res.status(500).json({ error: "Gagal menghubungkan bot: " + e.message });
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

  // ===== PRODUCTS =====
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
      let sent = 0;
      for (const customer of customers) {
        try {
          await waSocket.sendMessage(customer.jid, { text: `📢 *${req.body.title}*\n━━━━━━━━━━━━━━━━━━━━━\n\n${req.body.message}` });
          sent++;
          await new Promise(r => setTimeout(r, 1000));
        } catch { /* skip */ }
      }
      updateBroadcastStatus(bc.id, "sent", sent);
    }
    res.json({ success: true, broadcast: bc });
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
