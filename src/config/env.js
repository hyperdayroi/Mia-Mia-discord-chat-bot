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
export const CHAT_MODEL = "vuduythanh2023/gemini-3.5-flash";
export const IMAGE_MODEL = "quanganh101107/gemini-flash";

export const DEBUG = process.env.DEBUG === "true";
export const DEBUG_GUILD = process.env.DEBUG_GUILD;

// ========= PER-PERSONA STORAGE (mỗi Railway service set riêng) =========
export const MEMORY_FILE = process.env.MEMORY_FILE || `./memory-${PERSONA_KEY}.json`;
export const USAGE_FILE = process.env.USAGE_FILE || `./usage-${PERSONA_KEY}.json`;
export const FAMILY_MEMORY_FILE = process.env.FAMILY_MEMORY_FILE || `./family-context-${PERSONA_KEY}.json`;
export const CHANNEL_CONFIG_FILE = process.env.CHANNEL_CONFIG_FILE || `./channel-${PERSONA_KEY}.json`;

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
function normalizeInternalUrl(url) {
  if (!url) return "";
  let trimmed = url.trim();
  if (!trimmed) return "";
  // Nếu người dùng dán thiếu "https://" (chỉ có dạng "xxx.up.railway.app") thì tự thêm vào,
  // tránh lỗi "Invalid URL" khi gọi fetch().
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed.replace(/\/+$/, ""); // bỏ dấu "/" thừa ở cuối
}

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
// Khoảng cách tối thiểu giữa 2 cuộc hội thoại tự động (mặc định = AUTO_CHAT_INTERVAL nếu không set riêng)
export const FAMILY_CHAT_COOLDOWN_MS = Number(process.env.FAMILY_CHAT_COOLDOWN_MS || AUTO_CHAT_INTERVAL);
// Delay giữa mỗi lượt nhắn trong 1 cuộc hội thoại để không spam quá nhanh
export const FAMILY_TURN_DELAY_MS = Number(process.env.FAMILY_TURN_DELAY_MS || 3000);

// Chế độ hiển thị: nếu có FAMILY_CHAT_CHANNEL_ID => PUBLIC (gửi ra Discord), không thì INTERNAL (chỉ log/lưu).
export const FAMILY_CHAT_MODE = FAMILY_CHAT_CHANNEL_ID ? "public" : "internal";

// ========= GOOD MORNING / GOOD NIGHT =========
// Mỗi ngày, một trong hai bé (chọn xen kẽ theo ngày, tính toán độc lập ở cả 2 service
// nhưng luôn ra cùng kết quả) sẽ gửi lời chào vào FAMILY_CHAT_CHANNEL_ID.
export const GOOD_MORNING_ENABLED = process.env.GOOD_MORNING_ENABLED === "true";
export const GOOD_MORNING_HOUR = Number(process.env.GOOD_MORNING_HOUR ?? 0);
export const GOOD_MORNING_MINUTE = Number(process.env.GOOD_MORNING_MINUTE ?? 0);

export const GOOD_NIGHT_ENABLED = process.env.GOOD_NIGHT_ENABLED === "true";
export const GOOD_NIGHT_HOUR = Number(process.env.GOOD_NIGHT_HOUR ?? 22);
export const GOOD_NIGHT_MINUTE = Number(process.env.GOOD_NIGHT_MINUTE ?? 0);

// Timezone dùng để tính giờ chào buổi sáng/tối (định dạng IANA, ví dụ Asia/Ho_Chi_Minh)
export const FAMILY_TIMEZONE = process.env.FAMILY_TIMEZONE || "Asia/Ho_Chi_Minh";

// ========= RANDOM "MÁCH LẺO" =========
// Bot thỉnh thoảng (random) tự DM cho bố 1 câu mách nhỏ, dễ thương về người chị/em còn lại.
export const TATTLE_ENABLED = process.env.TATTLE_ENABLED === "true";
// Cứ mỗi khoảng này thì roll thử 1 lần xem có "mách" không (mặc định 1 giờ/lần)
export const TATTLE_CHECK_INTERVAL_MS = Number(process.env.TATTLE_CHECK_INTERVAL_MS || 3600000);
// Xác suất "mách" mỗi lần roll (0-1, mặc định 15%)
export const TATTLE_CHANCE = Number(process.env.TATTLE_CHANCE ?? 0.15);
