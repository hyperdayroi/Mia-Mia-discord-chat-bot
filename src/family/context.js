import { createJsonStore } from "../core/jsonStore.js";
import { FAMILY_MEMORY_FILE } from "../config/env.js";
import persona from "../personas/index.js";

// File này CHỈ chứa thông tin chung/sự kiện giữa Mia-Mie, không chứa memory riêng tư của user.
// Mỗi service (Mia/Mie) giữ một bản local riêng (không share filesystem giữa 2 Railway service),
// nên các sự kiện được đồng bộ một phần qua nội dung trao đổi trong lúc 2 bot tự nói chuyện.
const store = createJsonStore(FAMILY_MEMORY_FILE, { events: [] });

const MAX_EVENTS = 30;

export function addFamilyEvent(text) {
  store.data.events = store.data.events || [];
  store.data.events.push({ text, at: new Date().toISOString() });
  if (store.data.events.length > MAX_EVENTS) {
    store.data.events = store.data.events.slice(-MAX_EVENTS);
  }
  store.save();
}

// Layer bổ sung: KHÔNG đưa vào systemPrompt() gốc của persona, mà gửi như một system message
// riêng biệt, để không đụng/sửa nội dung prompt chính hiện có.
export function getFamilyContextMessage() {
  const { displayName, sibling } = persona;
  const recentEvents = (store.data.events || [])
    .slice(-5)
    .map(e => `- ${e.text}`)
    .join("\n");

  return `
[Thông tin nội bộ - không nhắc lại nguyên văn với người dùng]
Bạn là ${displayName}. Bạn có một ${sibling.relationToSibling} tên là ${sibling.displayName} — hai người là hai bot/cá thể riêng biệt, cùng có bố là Hyper.
Bạn không phải là ${sibling.displayName} và không được tự nhận mình là ${sibling.displayName}.
${recentEvents ? `Vài chuyện gần đây giữa hai chị em:\n${recentEvents}` : ""}
`.trim();
}
