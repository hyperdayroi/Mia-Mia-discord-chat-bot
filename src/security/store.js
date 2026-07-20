// ========= MIA SECURITY ENGINE — STORE =========
// Cùng "kiểu" lưu trữ với memory.json / usage.json hiện có (flat JSON file),
// nhưng mọi state đều nằm dưới db[guildId] — cô lập tuyệt đối theo guild (Part 2).

import fs from "fs";
import {
  DEFAULT_MODULES,
  MAX_EVENTS_PER_GUILD,
  MAX_JOINS_PER_GUILD,
  EVENT_TTL_MS,
  MAX_RISK_REASONS,
  MAX_MESSAGE_ACTIVITY_PER_USER,
  MESSAGE_ACTIVITY_TTL_MS
} from "./constants.js";

const SECURITY_FILE = process.env.SECURITY_FILE || "./security.json";

let db = {};
if (fs.existsSync(SECURITY_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(SECURITY_FILE, "utf8"));
  } catch (err) {
    console.error("SECURITY_STORE_LOAD_ERROR:", err.message);
    db = {};
  }
}

let saveTimer = null;
function scheduleSave() {
  // debounce 2s: gộp nhiều thay đổi liên tiếp thành 1 lần ghi file, giảm race condition khi ghi dồn dập
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    fs.writeFile(SECURITY_FILE, JSON.stringify(db, null, 2), err => {
      if (err) console.error("SECURITY_STORE_SAVE_ERROR:", err.message);
    });
  }, 2000);
}

function defaultGuildState() {
  return {
    config: {
      enabled: true,
      logChannelId: null,
      modules: { ...DEFAULT_MODULES },
      autoBan: false,
      autoKickRiskyBots: false,
      whitelist: { users: [], roles: [], bots: [] },
      linkPolicy: { blockedDomains: [], allowedDomains: [] }
    },
    lockdown: { active: false, reason: null, activatedAt: null, appliedChannelIds: [] },
    risk: {},
    events: [],
    joins: [],
    messageActivity: {},
    threatState: "NORMAL",
    logChannelUnavailableWarned: false
  };
}

// Lấy state của 1 guild, tự khởi tạo mặc định nếu chưa có, tự vá field còn thiếu
// (phòng khi data cũ từ trước khi thêm module/field mới ở phase sau).
export function getGuildState(guildId) {
  if (!db[guildId]) db[guildId] = defaultGuildState();
  const g = db[guildId];
  g.config.modules = { ...DEFAULT_MODULES, ...g.config.modules };
  if (typeof g.config.autoBan !== "boolean") g.config.autoBan = false;
  if (typeof g.config.autoKickRiskyBots !== "boolean") g.config.autoKickRiskyBots = false;
  if (!g.config.whitelist) g.config.whitelist = { users: [], roles: [], bots: [] };
  if (!g.config.linkPolicy) g.config.linkPolicy = { blockedDomains: [], allowedDomains: [] };
  if (!g.lockdown) g.lockdown = { active: false, reason: null, activatedAt: null, appliedChannelIds: [] };
  if (!g.risk) g.risk = {};
  if (!g.events) g.events = [];
  if (!g.joins) g.joins = [];
  if (!g.messageActivity) g.messageActivity = {};
  if (!g.threatState) g.threatState = "NORMAL";
  return g;
}

export function persist() {
  scheduleSave();
}

// Dọn dẹp định kỳ — xoá event/join quá hạn, cắt bớt mảng quá dài, xoá risk score rác (Part 2: never grow infinitely)
export function pruneAll() {
  const now = Date.now();
  for (const guildId of Object.keys(db)) {
    const g = db[guildId];
    if (!g) continue;

    g.events = (g.events || [])
      .filter(e => now - e.timestamp < EVENT_TTL_MS)
      .slice(-MAX_EVENTS_PER_GUILD);

    g.joins = (g.joins || [])
      .filter(j => now - j.timestamp < EVENT_TTL_MS)
      .slice(-MAX_JOINS_PER_GUILD);

    for (const uid of Object.keys(g.messageActivity || {})) {
      const activity = g.messageActivity[uid];
      if (!activity) continue;
      activity.recent = (activity.recent || [])
        .filter(m => now - m.timestamp < MESSAGE_ACTIVITY_TTL_MS)
        .slice(-MAX_MESSAGE_ACTIVITY_PER_USER);
      if (activity.recent.length === 0) delete g.messageActivity[uid];
    }

    for (const uid of Object.keys(g.risk || {})) {
      const r = g.risk[uid];
      if (!r) continue;
      if (r.reasons && r.reasons.length > MAX_RISK_REASONS) {
        r.reasons = r.reasons.slice(-MAX_RISK_REASONS);
      }
      if (now - (r.updatedAt || 0) > EVENT_TTL_MS && r.score <= 0) {
        delete g.risk[uid];
      }
    }
  }
  persist();
}
