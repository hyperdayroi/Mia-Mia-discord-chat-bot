// ========= MIA SECURITY ENGINE — CONSTANTS =========
// Mọi con số/ngưỡng để tinh chỉnh độ nhạy nằm hết ở đây.
// Đổi số ở file này để chỉnh hành vi, không cần sửa logic ở nơi khác.

import { PermissionFlagsBits } from "discord.js";

// Quyền bị coi là "nguy hiểm" nếu 1 role đang cấp cho member (Part 10 — Permission Firewall)
export const DANGEROUS_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.MentionEveryone
];

// Điểm rủi ro cộng thêm theo từng loại hành động (Part 7)
export const RISK_POINTS = {
  CHANNEL_DELETE: 30,
  CHANNEL_CREATE_MASS: 15,
  ROLE_DELETE: 30,
  ROLE_CREATE_MASS: 15,
  PERMISSION_ESCALATION: 70,
  MEMBER_KICK: 50,
  MEMBER_BAN: 60,
  WEBHOOK_ABUSE: 50,
  NUKE_PATTERN_BONUS: 100,
  SPAM: 10,
  DUPLICATE_SPAM: 15,
  MASS_MENTION: 20,
  SUSPICIOUS_LINK: 25
};

// Ngưỡng mức độ rủi ro (Part 7)
export function getThreatLevel(score) {
  if (score > 100) return "CRITICAL";
  if (score >= 61) return "HIGH_RISK";
  if (score >= 31) return "WARNING";
  return "NORMAL";
}

// Tốc độ hành động bị coi là bất thường (Part 6) — dạng [count, windowMs]
export const VELOCITY_THRESHOLDS = {
  CHANNEL_DELETE: [3, 10_000],
  ROLE_DELETE: [3, 10_000],
  MEMBER_BAN: [3, 10_000],
  MEMBER_KICK: [3, 10_000],
  WEBHOOK_CREATE: [3, 10_000],
  WEBHOOK_DELETE: [3, 10_000],
  CHANNEL_CREATE: [5, 10_000],
  ROLE_CREATE: [5, 10_000],
  PERMISSION_UPDATE: [2, 10_000]
};

// Cửa sổ để xét "combo" nhiều loại hành động phá hoại khác nhau = nuke pattern (Part 5)
export const COMBO_WINDOW_MS = 60_000;
export const COMBO_MIN_DISTINCT_ACTIONS = 2;
export const DESTRUCTIVE_ACTIONS = [
  "CHANNEL_DELETE", "ROLE_DELETE", "MEMBER_BAN", "MEMBER_KICK",
  "WEBHOOK_CREATE", "WEBHOOK_DELETE", "PERMISSION_UPDATE"
];

// Anti-Raid (Part 11) — dạng [count, windowMs]
export const RAID_THRESHOLDS = {
  ALERT: [5, 30_000],
  LOCKDOWN: [10, 30_000]
};
export const NEW_ACCOUNT_AGE_MS = 3 * 24 * 60 * 60 * 1000; // tài khoản < 3 ngày tuổi

// Risk score decay theo thời gian (Part 7)
export const RISK_DECAY_PER_MINUTE = 5;
export const RISK_MAX = 300;

// Giới hạn dữ liệu lưu trữ — không được phình vô hạn (Part 2)
export const MAX_EVENTS_PER_GUILD = 300;
export const MAX_JOINS_PER_GUILD = 200;
export const EVENT_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_RISK_REASONS = 8;

// Module đã implement (dùng cho /security enable|disable)
// snapshots sẽ thêm ở Phase 3
export const IMPLEMENTED_MODULES = [
  "antiRaid", "antiNuke", "antiBot", "antiPermissionAbuse",
  "antiSpam", "antiFlood", "antiLink", "antiMention"
];

export const DEFAULT_MODULES = {
  antiRaid: true,
  antiNuke: true,
  antiBot: true,
  antiPermissionAbuse: true,
  antiSpam: true,
  antiFlood: true,
  antiLink: true,
  antiMention: true
};

export const LOG_EMOJI = {
  RAID_DETECTED: "🚨",
  NUKE_DETECTED: "🔨",
  RISKY_BOT_ADDED: "🤖",
  PERMISSION_ABUSE: "🔐",
  WEBHOOK_ABUSE: "🪝",
  SPAM_DETECTED: "💬",
  SUSPICIOUS_LINK: "🔗",
  MASS_MENTION: "📢",
  LOCKDOWN_ENABLED: "🔒",
  LOCKDOWN_DISABLED: "🔓",
  SECURITY_CONFIG_CHANGED: "⚠️",
  INFO: "ℹ️"
};

export const SEVERITY_COLOR = {
  INFO: 0x5865f2,
  LOW: 0x57f287,
  NORMAL: 0x57f287,
  MEDIUM: 0xfee75c,
  WARNING: 0xfee75c,
  HIGH: 0xe67e22,
  HIGH_RISK: 0xe67e22,
  CRITICAL: 0xed4245,
  ALERT: 0xe67e22,
  LOCKDOWN: 0xed4245,
  EMERGENCY: 0xed4245
};

// ========= PHASE 2 — ANTI-SPAM / FLOOD / LINK / MENTION =========

// Bao nhiêu tin trong bao lâu ở CÙNG 1 kênh = flood (Part 12)
export const FLOOD_THRESHOLD = [6, 6_000];
// Bao nhiêu tin GIỐNG NHAU trong bao lâu, tính trên toàn guild = duplicate spam
export const DUPLICATE_THRESHOLD = [3, 20_000];
// Bao nhiêu tin có đính kèm file trong bao lâu ở cùng kênh = attachment spam
export const ATTACHMENT_FLOOD_THRESHOLD = [5, 10_000];

export const CHAR_SPAM_REGEX = /(.)\1{9,}/; // 1 ký tự lặp lại >=10 lần liên tiếp
export const EMOJI_SPAM_COUNT = 10; // >=10 emoji trong 1 tin nhắn
export const MENTION_SPAM_COUNT = 6; // >=6 user được mention riêng biệt trong 1 tin nhắn

// Timeout áp dụng khi risk score do spam/link/mention đạt mức tương ứng (ms)
export const MESSAGE_TIMEOUT_MS = {
  HIGH_RISK: 10 * 60 * 1000, // 10 phút
  CRITICAL: 60 * 60 * 1000 // 1 tiếng
};

// Giới hạn dữ liệu messageActivity theo user, tương tự Part 2
export const MAX_MESSAGE_ACTIVITY_PER_USER = 40;
export const MESSAGE_ACTIVITY_TTL_MS = 2 * 60 * 1000;

// Heuristic phát hiện link giả mạo (Part 13) — CHỈ so khớp chuỗi, KHÔNG gọi network để kiểm tra URL.
// Đây là best-effort, luôn có thể sai — cơ chế đáng tin cậy hơn là blockedDomains do owner tự thêm.
export const IMPERSONATION_KEYWORDS = ["discord", "steam", "nitro"];
export const KNOWN_SAFE_DOMAINS = [
  "discord.com", "discordapp.com", "discord.gg", "discordstatus.com",
  "steamcommunity.com", "steampowered.com", "store.steampowered.com"
];
export const SUSPICIOUS_TLDS = [".xyz", ".top", ".click", ".gq", ".cf", ".tk", ".rest", ".zip"];
export const SCAM_KEYWORDS = ["free", "gift", "airdrop", "claim", "verify-account"];

