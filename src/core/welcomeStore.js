import { createJsonStore } from "./jsonStore.js";
import { WELCOME_FILE } from "../config/env.js";

// { [guildId]: { title, message, banner, color } | null }
// message/title/banner/color đều optional — không có message thì AI tự soạn phần mô tả.
const store = createJsonStore(WELCOME_FILE, {});

/**
 * @param {string} guildId
 * @param {{ title?: string, message?: string, banner?: string, color?: number }} config
 */
export function setWelcomeConfig(guildId, config) {
  store.data[guildId] = { ...(store.data[guildId] || {}), ...config };
  store.save();
}

export function removeWelcomeConfig(guildId) {
  if (!(guildId in store.data)) return false;
  delete store.data[guildId];
  store.save();
  return true;
}

/** @returns {{ title?: string, message?: string, banner?: string, color?: number } | null} */
export function getWelcomeConfig(guildId) {
  return store.data[guildId] || null;
}
