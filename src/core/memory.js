import { createJsonStore } from "./jsonStore.js";
import { MEMORY_FILE, MEMORY_HISTORY_LIMIT } from "../config/env.js";

// Giữ nguyên hành vi memory gốc: object { [userId]: [{role, content}, ...] }
// Chỉ khác là file được chọn theo persona (MEMORY_FILE), nên Mia và Mie không đụng vào memory của nhau.
const store = createJsonStore(MEMORY_FILE, {});

export function getMemory(uid) {
  if (!store.data[uid]) store.data[uid] = [];
  return store.data[uid];
}

// Thêm 1 tin nhắn vào memory của user và tự cắt bớt về đúng giới hạn
// (mặc định 20, chỉnh qua ENV MEMORY_HISTORY_LIMIT) — dùng chung 1 chỗ để mọi
// nơi (slash command /ask, mention chat...) luôn nhất quán số tin được giữ lại.
export function pushMemoryEntry(uid, entry) {
  const chat = getMemory(uid);
  chat.push(entry);
  while (chat.length > MEMORY_HISTORY_LIMIT) chat.shift();
  return chat;
}

export function saveMemory() {
  store.save();
}

export function memoryUserCount() {
  return Object.keys(store.data).length;
}
