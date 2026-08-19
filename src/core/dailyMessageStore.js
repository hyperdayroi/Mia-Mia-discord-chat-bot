import { createJsonStore } from "./jsonStore.js";
import { DAILY_MESSAGE_FILE } from "../config/env.js";

// { [guildId]: { day, counts: { [userId]: number }, channelCounts: { [channelId]: { [userId]: number } } } }
const store = createJsonStore(DAILY_MESSAGE_FILE, {});

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function ensureGuildToday(guildId) {
  const day = todayKey();
  if (!store.data[guildId] || store.data[guildId].day !== day) {
    store.data[guildId] = { day, counts: {}, channelCounts: {} };
  }
  return store.data[guildId];
}

/** Gọi cho MỖI tin nhắn user gửi trong server (không tính bot). Đếm cả tổng server lẫn riêng theo từng kênh. */
export function incrementDailyMessage(guildId, channelId, userId) {
  if (!guildId) return;

  const guildData = ensureGuildToday(guildId);

  guildData.counts[userId] = (guildData.counts[userId] || 0) + 1;

  if (channelId) {
    if (!guildData.channelCounts[channelId]) guildData.channelCounts[channelId] = {};
    guildData.channelCounts[channelId][userId] = (guildData.channelCounts[channelId][userId] || 0) + 1;
  }

  store.save();
}

/** @returns {number} Số tin nhắn user đã gửi HÔM NAY trong cả server (mọi kênh cộng lại). */
export function getDailyMessageCount(guildId, userId) {
  const guildData = store.data[guildId];
  if (!guildData || guildData.day !== todayKey()) return 0;
  return guildData.counts[userId] || 0;
}

/** @returns {number} Số tin nhắn user đã gửi HÔM NAY, CHỈ tính trong 1 kênh cụ thể. */
export function getDailyMessageCountInChannel(guildId, channelId, userId) {
  const guildData = store.data[guildId];
  if (!guildData || guildData.day !== todayKey()) return 0;
  return guildData.channelCounts?.[channelId]?.[userId] || 0;
}
