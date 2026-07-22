import "dotenv/config";

// ========= PERSONA =========
export const PERSONA_KEY = (process.env.PERSONA || "mia").toLowerCase().trim();

// ========= OWNER (bố Hyper — chung cho cả Mia và Mie) =========
export const OWNER_ID = "1217373421504041000";

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

export const DEBUG = process.env.DEBUG === "true";
export const DEBUG_GUILD = process.env.DEBUG_GUILD;

// ========= PER-PERSONA STORAGE (mỗi Railway service set riêng) =========
export const MEMORY_FILE = process.env.MEMORY_FILE || `./memory-${PERSONA_KEY}.json`;
export const USAGE_FILE = process.env.USAGE_FILE || `./usage-${PERSONA_KEY}.json`;
export const FAMILY_MEMORY_FILE = process.env.FAMILY_MEMORY_FILE || `./family-context-${PERSONA_KEY}.json`;

// Số tin nhắn gần nhất được giữ lại trong memory của mỗi user (chỉnh tuỳ ý qua ENV).
export const MEMORY_HISTORY_LIMIT = Number(process.env.MEMORY_HISTORY_LIMIT || 20);

// ========= DAILY LIMIT =========
export const DAILY_LIMIT = {
  chat: 500,
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
// Mỗi service chỉ cần biết URL nội bộ của "em/chị" bên kia.
// Mia set MIE_INTERNAL_URL, Mie set MIA_INTERNAL_URL. PEER_INTERNAL_URL là fallback chung.
export const PEER_INTERNAL_URL =
  PERSONA_KEY === "mia"
    ? (process.env.MIE_INTERNAL_URL || process.env.PEER_INTERNAL_URL || "")
    : (process.env.MIA_INTERNAL_URL || process.env.PEER_INTERNAL_URL || "");

export const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "";
export const INTERNAL_PORT = process.env.PORT || 3000;
export const INTERNAL_REQUEST_TIMEOUT_MS = Number(process.env.INTERNAL_REQUEST_TIMEOUT_MS || 15000);

// ========= AUTONOMOUS FAMILY CONVERSATION =========
export const AUTO_CHAT_ENABLED = process.env.AUTO_CHAT_ENABLED === "true";
export const AUTO_CHAT_INTERVAL = Number(process.env.AUTO_CHAT_INTERVAL || 1800000); // 30 phút
export const MAX_CONVERSATION_TURNS = Number(process.env.MAX_CONVERSATION_TURNS || 10);
export const FAMILY_CHAT_CHANNEL_ID = process.env.FAMILY_CHAT_CHANNEL_ID || "";
// Khoảng cách tối thiểu giữa 2 cuộc hội thoại tự động (mặc định = AUTO_CHAT_INTERVAL nếu không set riêng)
export const FAMILY_CHAT_COOLDOWN_MS = Number(process.env.FAMILY_CHAT_COOLDOWN_MS || AUTO_CHAT_INTERVAL);
// Delay giữa mỗi lượt nhắn trong 1 cuộc hội thoại để không spam quá nhanh
export const FAMILY_TURN_DELAY_MS = Number(process.env.FAMILY_TURN_DELAY_MS || 3000);

// Chế độ hiển thị: nếu có FAMILY_CHAT_CHANNEL_ID => PUBLIC (gửi ra Discord), không thì INTERNAL (chỉ log/lưu).
export const FAMILY_CHAT_MODE = FAMILY_CHAT_CHANNEL_ID ? "public" : "internal";
