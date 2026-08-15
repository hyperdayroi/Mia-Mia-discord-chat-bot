import { createJsonStore } from "./jsonStore.js";
import { DAILY_MESSAGE_FILE } from "../config/env.js";

// { [guildId]: { day: "YYYY-MM-DD", counts: { [userId]: number } } }
const store = createJsonStore(DAILY_MESSAGE_FILE, {});

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Gọi cho MỖI tin nhắn user gửi trong server (không tính bot). */
export function incrementDailyMessage(guildId, userId) {
  if (!guildId) return;

  const day = todayKey();
  if (!store.data[guildId] || store.data[guildId].day !== day) {
    store.data[guildId] = { day, counts: {} };
  }

  store.data[guildId].counts[userId] = (store.data[guildId].counts[userId] || 0) + 1;
  store.save();
}

/** @returns {number} Số tin nhắn user đã gửi HÔM NAY trong server này. */
export function getDailyMessageCount(guildId, userId) {
  const guildData = store.data[guildId];
  if (!guildData || guildData.day !== todayKey()) return 0;
  return guildData.counts[userId] || 0;
}
