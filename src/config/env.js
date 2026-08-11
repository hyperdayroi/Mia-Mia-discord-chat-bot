import "dotenv/config";

// ========= PERSONA =========
export const PERSONA_KEY = (process.env.PERSONA || "mia").toLowerCase().trim();

// ========= OWNER / SISTER (bố Hyper / chị — chung cho cả Mia và Mie) =========
export const OWNER_ID = "1217373421504041000";
// User ID của "chị" — người mà Mia/Mie xưng "em", gọi "chị". Set qua ENV, để trống thì tính năng này tắt.
export const SISTER_ID = process.env.SISTER_ID || "";

// ========= REQUIRED ENV (bắt buộc để bot chạy được, bất kể persona nào) =========
const REQUIRED_ENV = ["DISCORD_TOKEN", "CLIENT_ID", "CKEY_API_KEY"];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);
if (missingEnv.length) {
  console.error(`Thiếu biến môi trường: ${missingEnv.join(", ")}. Kiểm tra lại file .env`);
  process.exit(1);
}

if (!["mia", "mie"].includes(PERSONA_KEY)) {
  console.error(`PERSONA không hợp lệ: "${PERSONA_KEY}". Chỉ chấp nhận "mia" hoặc "mie".`);
  process.exit(1);
}

// ========= DISCORD / AI API =========
export const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
export const CLIENT_ID = process.env.CLIENT_ID;
export const CKEY_API_KEY = process.env.CKEY_API_KEY;
export const API_BASE = "https://api.xah.io/v1";
export const CHAT_MODEL = "vuduythanh2023/gemini-3.1-pro-high";
export const IMAGE_MODEL = "phuocanh421994/Wan2.7_Image_Pro";

// ========= CHUYỂN ĐỔI PROVIDER CHO PHẦN CHAT (/ask, mention chat...) =========
// /image luôn dùng CKEY_API_KEY ở trên, không đổi theo cái này.
export const AI_PROVIDER = (process.env.AI_PROVIDER || "ckey").toLowerCase().trim();

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

if (AI_PROVIDER === "gemini" && !GEMINI_API_KEY) {
  console.error("AI_PROVIDER=gemini nhưng thiếu GEMINI_API_KEY. Kiểm tra lại file .env");
  process.exit(1);
}
if (!["ckey", "gemini"].includes(AI_PROVIDER)) {
  console.error(`AI_PROVIDER không hợp lệ: "${AI_PROVIDER}". Chỉ chấp nhận "ckey" hoặc "gemini".`);
  process.exit(1);
}

// ========= VOICE (nghe + nói trong voice channel, dùng chung GEMINI_API_KEY) =========
export const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview";
// Chọn 1 trong các giọng có sẵn của Gemini TTS, ví dụ: Kore, Puck, Zephyr, Leda...
export const GEMINI_TTS_VOICE = process.env.GEMINI_TTS_VOICE || "Kore";

export const DEBUG = process.env.DEBUG === "true";
export const DEBUG_GUILD = process.env.DEBUG_GUILD;

// ========= STORAGE (gom hết vào DATA_DIR để chỉ cần trỏ 1 Railway Volume) =========
export const DATA_DIR = process.env.DATA_DIR || "./data";

export const MEMORY_FILE = process.env.MEMORY_FILE || `${DATA_DIR}/memory-${PERSONA_KEY}.json`;
export const USAGE_FILE = process.env.USAGE_FILE || `${DATA_DIR}/usage-${PERSONA_KEY}.json`;
export const FAMILY_MEMORY_FILE = process.env.FAMILY_MEMORY_FILE || `${DATA_DIR}/family-context-${PERSONA_KEY}.json`;
export const CHANNEL_CONFIG_FILE = process.env.CHANNEL_CONFIG_FILE || `${DATA_DIR}/channel-${PERSONA_KEY}.json`;
export const BLACKLIST_FILE = process.env.BLACKLIST_FILE || `${DATA_DIR}/blacklist-${PERSONA_KEY}.json`;

// Số tin nhắn gần nhất giữ lại trong memory của mỗi user (mặc định 20, chỉnh tuỳ ý)
export const MEMORY_HISTORY_LIMIT = Number(process.env.MEMORY_HISTORY_LIMIT || 20);

// Số tin nhắn gần nhất trong kênh mà bot âm thầm ghi nhớ (không cần @) để hiểu ngữ cảnh
// đang nói chuyện gì — CHỈ dùng để trả lời có liên quan hơn khi được @, không tự nhảy vào chat.
export const CHANNEL_CONTEXT_LIMIT = Number(process.env.CHANNEL_CONTEXT_LIMIT || 15);

// Số tin nhắn gần nhất CỦA RIÊNG 1 user mà bot âm thầm ghi nhớ (không cần @) — khác
// CHANNEL_CONTEXT_LIMIT ở chỗ đây chỉ tính tin của người đó, không lẫn người khác.
export const USER_CONTEXT_LIMIT = Number(process.env.USER_CONTEXT_LIMIT || 18);

// ========= DAILY LIMIT =========
export const DAILY_LIMIT = {
  chat: 10,
  image: 5
};
export const UNLIMITED_IDS = [OWNER_ID];

// ========= COOLDOWN =========
export const COOLDOWN_MS = {
  ask: 4000,
  image: 15000,
  mention: 4000
};

// ========= MIA <-> MIE INTERNAL COMMUNICATION =========
function normalizeInternalUrl(url) {
  if (!url) return "";
  let trimmed = url.trim();
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed.replace(/\/+$/, "");
}

// Mia set MIE_INTERNAL_URL, Mie set MIA_INTERNAL_URL. PEER_INTERNAL_URL là fallback chung.
export const PEER_INTERNAL_URL = normalizeInternalUrl(
  PERSONA_KEY === "mia"
    ? (process.env.MIE_INTERNAL_URL || process.env.PEER_INTERNAL_URL || "")
    : (process.env.MIA_INTERNAL_URL || process.env.PEER_INTERNAL_URL || "")
);

export const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "";
export const INTERNAL_PORT = process.env.PORT || 3000;
export const INTERNAL_REQUEST_TIMEOUT_MS = Number(process.env.INTERNAL_REQUEST_TIMEOUT_MS || 15000);

// ========= AUTONOMOUS FAMILY CONVERSATION =========
export const AUTO_CHAT_ENABLED = process.env.AUTO_CHAT_ENABLED === "true";
export const AUTO_CHAT_INTERVAL = Number(process.env.AUTO_CHAT_INTERVAL || 1800000); // 30 phút
export const MAX_CONVERSATION_TURNS = Number(process.env.MAX_CONVERSATION_TURNS || 10);
export const FAMILY_CHAT_CHANNEL_ID = process.env.FAMILY_CHAT_CHANNEL_ID || "";
export const FAMILY_CHAT_COOLDOWN_MS = Number(process.env.FAMILY_CHAT_COOLDOWN_MS || AUTO_CHAT_INTERVAL);
export const FAMILY_TURN_DELAY_MS = Number(process.env.FAMILY_TURN_DELAY_MS || 3000);

export const FAMILY_CHAT_MODE = FAMILY_CHAT_CHANNEL_ID ? "public" : "internal";

// ========= GOOD MORNING / GOOD NIGHT =========
export const GOOD_MORNING_ENABLED = process.env.GOOD_MORNING_ENABLED === "true";
export const GOOD_MORNING_HOUR = Number(process.env.GOOD_MORNING_HOUR ?? 0);
export const GOOD_MORNING_MINUTE = Number(process.env.GOOD_MORNING_MINUTE ?? 0);

export const GOOD_NIGHT_ENABLED = process.env.GOOD_NIGHT_ENABLED === "true";
export const GOOD_NIGHT_HOUR = Number(process.env.GOOD_NIGHT_HOUR ?? 22);
export const GOOD_NIGHT_MINUTE = Number(process.env.GOOD_NIGHT_MINUTE ?? 0);

export const FAMILY_TIMEZONE = process.env.FAMILY_TIMEZONE || "Asia/Ho_Chi_Minh";

// ========= RANDOM "MÁCH LẺO" =========
export const TATTLE_ENABLED = process.env.TATTLE_ENABLED === "true";
export const TATTLE_CHECK_INTERVAL_MS = Number(process.env.TATTLE_CHECK_INTERVAL_MS || 3600000);
export const TATTLE_CHANCE = Number(process.env.TATTLE_CHANCE ?? 0.15);
