import fs from "fs";
import path from "path";

const DB_DIR = path.join(process.cwd(), "WhatsApp", "database", "game");
const DB_PATH = path.join(DB_DIR, "players.json");

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, "{}");

const extractId = (jid) => (jid || "").split("@")[0].split(":")[0];

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return {};
  }
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export function getPlayer(senderId, pushname) {
  const db = load();
  const id = extractId(senderId);
  if (!db[id]) {
    db[id] = {
      name: pushname || "Player",
      xp: 0,
      level: 1,
      balance: 0,
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
    };
    save(db);
  } else if (pushname && db[id].name !== pushname) {
    db[id].name = pushname;
    save(db);
  }
  return db[id];
}

export function addReward(senderId, xp, balance) {
  const db = load();
  const id = extractId(senderId);
  if (!db[id])
    db[id] = {
      name: "Player",
      xp: 0,
      level: 1,
      balance: 0,
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
    };
  db[id].xp += xp;
  db[id].balance += balance;
  db[id].wins += 1;
  db[id].gamesPlayed += 1;
  db[id].level = Math.max(1, Math.floor(Math.sqrt(db[id].xp / 100)) + 1);
  save(db);
  return db[id];
}

export function addLoss(senderId) {
  const db = load();
  const id = extractId(senderId);
  if (!db[id]) return { losses: 0 };
  db[id].losses += 1;
  db[id].gamesPlayed += 1;
  save(db);
  return db[id];
}

export function getLeaderboard(limit = 10) {
  const db = load();
  return Object.entries(db)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);
}
