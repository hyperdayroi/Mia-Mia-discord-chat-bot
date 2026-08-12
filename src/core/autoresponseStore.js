import crypto from "crypto";
import { createJsonStore } from "./jsonStore.js";
import { AUTORESPONSE_FILE } from "../config/env.js";

// { [guildId]: [{ id, trigger, response, matchType }] }
const store = createJsonStore(AUTORESPONSE_FILE, {});

function getGuildList(guildId) {
  if (!store.data[guildId]) store.data[guildId] = [];
  return store.data[guildId];
}

/**
 * @param {string} guildId
 * @param {{ trigger: string, response: string, matchType?: "contains"|"exact"|"startsWith", image?: string }} entry
 * @returns {string} id vừa tạo
 */
export function addAutoresponse(guildId, { trigger, response, matchType = "contains", image = null }) {
  const list = getGuildList(guildId);
  const id = crypto.randomUUID().slice(0, 8);
  list.push({ id, trigger, response, matchType, image });
  store.save();
  return id;
}

/** @returns {boolean} */
export function removeAutoresponse(guildId, id) {
  const list = getGuildList(guildId);
  const idx = list.findIndex(a => a.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  store.save();
  return true;
}

export function getAutoresponses(guildId) {
  return getGuildList(guildId);
}

/**
 * Tìm auto-response đầu tiên khớp với nội dung tin nhắn (không phân biệt hoa/thường).
 * @param {string} guildId
 * @param {string} content
 */
export function findMatch(guildId, content) {
  if (!guildId || !content) return null;
  const lower = content.toLowerCase();

  return getGuildList(guildId).find(a => {
    const triggerLower = a.trigger.toLowerCase();
    if (a.matchType === "exact") return lower === triggerLower;
    if (a.matchType === "startsWith") return lower.startsWith(triggerLower);
    return lower.includes(triggerLower); // contains (mặc định)
  });
}
