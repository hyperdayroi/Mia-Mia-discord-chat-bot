import { createJsonStore } from "./jsonStore.js";
import { CHANNEL_CONFIG_FILE } from "../config/env.js";

// Lưu "kênh nhà chính" của bot này theo từng server: { [guildId]: channelId }
// KHÔNG ảnh hưởng tới mention chat — mention vẫn hoạt động ở bất kỳ kênh nào như cũ,
// chỉ dùng cho việc quyết định greeting (good morning/night) và tattle nên đăng vào đâu.
const store = createJsonStore(CHANNEL_CONFIG_FILE, {});

export function setHomeChannel(guildId, channelId) {
  store.data[guildId] = channelId;
  store.save();
}

export function getHomeChannel(guildId) {
  return store.data[guildId] || null;
}

export function getAllHomeChannels() {
  return Object.values(store.data).filter(Boolean);
}
