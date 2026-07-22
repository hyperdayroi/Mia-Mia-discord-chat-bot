import { createJsonStore } from "./jsonStore.js";
import { USAGE_FILE, DAILY_LIMIT, UNLIMITED_IDS } from "../config/env.js";

const store = createJsonStore(USAGE_FILE, {});

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// Trả về { allowed, remaining, used, limit } — không tự trừ quota
export function getUsageStatus(type, uid) {
  const limit = DAILY_LIMIT[type];
  if (UNLIMITED_IDS.includes(uid)) {
    return { allowed: true, remaining: Infinity, used: 0, limit: Infinity };
  }

  const day = todayKey();
  if (!store.data[uid] || store.data[uid].day !== day) {
    store.data[uid] = { day, chat: 0, image: 0 };
  }

  const used = store.data[uid][type] || 0;
  return { allowed: used < limit, remaining: Math.max(limit - used, 0), used, limit };
}

// Trừ 1 lượt quota (gọi sau khi đã pass getUsageStatus và chuẩn bị gọi API)
export function consumeUsage(type, uid) {
  if (UNLIMITED_IDS.includes(uid)) return;

  const day = todayKey();
  if (!store.data[uid] || store.data[uid].day !== day) {
    store.data[uid] = { day, chat: 0, image: 0 };
  }
  store.data[uid][type] = (store.data[uid][type] || 0) + 1;
  store.save();
}
