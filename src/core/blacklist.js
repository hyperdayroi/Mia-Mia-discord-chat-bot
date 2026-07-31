import { createJsonStore } from "./jsonStore.js";
import { BLACKLIST_FILE } from "../config/env.js";

// Danh sách user bị chặn không cho dùng bot (chat, /ask, /image...).
// Lưu riêng theo persona (blacklist-mia.json / blacklist-mie.json).
const store = createJsonStore(BLACKLIST_FILE, {});

export function isBlacklisted(userId) {
  return Boolean(store.data[userId]);
}

export function addToBlacklist(userId, reason) {
  store.data[userId] = { reason: reason || null, at: new Date().toISOString() };
  store.save();
}

export function removeFromBlacklist(userId) {
  if (!store.data[userId]) return false;
  delete store.data[userId];
  store.save();
  return true;
}

export function getBlacklist() {
  return Object.entries(store.data).map(([userId, info]) => ({ userId, ...info }));
}
