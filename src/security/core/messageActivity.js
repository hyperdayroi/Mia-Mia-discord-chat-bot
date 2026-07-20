// ========= MESSAGE ACTIVITY TRACKER (Part 12) =========
// Theo dõi hoạt động theo guildId (đã có qua guildState) + userId + channelId.
// Việc cắt bớt/hết hạn do store.pruneAll() lo định kỳ — ở đây chỉ cắt nhẹ khi ghi để tránh phình giữa 2 lần prune.

import { MAX_MESSAGE_ACTIVITY_PER_USER } from "../constants.js";

export function recordMessage(guildState, userId, entry) {
  if (!guildState.messageActivity[userId]) {
    guildState.messageActivity[userId] = { recent: [] };
  }
  const activity = guildState.messageActivity[userId];
  activity.recent.push({ timestamp: Date.now(), ...entry });
  if (activity.recent.length > MAX_MESSAGE_ACTIVITY_PER_USER) activity.recent.shift();
}

function getRecent(guildState, userId) {
  return guildState.messageActivity[userId]?.recent || [];
}

// Số tin trong 1 kênh cụ thể, trong khoảng windowMs gần nhất (dùng cho flood)
export function countInChannel(guildState, userId, channelId, windowMs) {
  const now = Date.now();
  return getRecent(guildState, userId).filter(m => m.channelId === channelId && now - m.timestamp <= windowMs).length;
}

// Số tin CÓ NỘI DUNG GIỐNG contentKey, ở bất kỳ kênh nào trong guild, trong windowMs gần nhất (dùng cho duplicate spam)
export function countDuplicates(guildState, userId, contentKey, windowMs) {
  if (!contentKey) return 0;
  const now = Date.now();
  return getRecent(guildState, userId).filter(m => m.contentKey === contentKey && now - m.timestamp <= windowMs).length;
}

// Số tin có đính kèm file trong 1 kênh, trong windowMs gần nhất (dùng cho attachment spam)
export function countAttachmentsInChannel(guildState, userId, channelId, windowMs) {
  const now = Date.now();
  return getRecent(guildState, userId).filter(
    m => m.channelId === channelId && m.hasAttachment && now - m.timestamp <= windowMs
  ).length;
}

export function normalizeContent(content) {
  return (content || "").toLowerCase().trim().replace(/\s+/g, " ").slice(0, 200);
}
