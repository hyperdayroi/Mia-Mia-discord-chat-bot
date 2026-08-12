import { createJsonStore } from "../core/jsonStore.js";
import { GIVEAWAY_FILE } from "../config/env.js";

// Lưu tất cả giveaway (đang chạy + đã kết thúc) theo persona: { [giveawayId]: giveaway }
const store = createJsonStore(GIVEAWAY_FILE, {});

export function createGiveaway(giveaway) {
  store.data[giveaway.id] = giveaway;
  store.save();
}

export function getGiveaway(id) {
  return store.data[id] || null;
}

export function updateGiveaway(id, updates) {
  if (!store.data[id]) return null;
  store.data[id] = { ...store.data[id], ...updates };
  store.save();
  return store.data[id];
}

export function getAllGiveaways() {
  return Object.values(store.data);
}

export function getActiveGiveaways() {
  return getAllGiveaways().filter(g => !g.ended);
}

export function addEntry(id, userId) {
  const g = store.data[id];
  if (!g || g.ended) return false;
  if (!g.entries.includes(userId)) {
    g.entries.push(userId);
    store.save();
  }
  return true;
}
