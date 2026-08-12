import { CHANNEL_CONTEXT_LIMIT } from "../config/env.js";

// Bộ nhớ TẠM (RAM) — không ghi ra file. Đây chỉ là "ngữ cảnh nền" giúp bot hiểu
// kênh đang nói chuyện gì, KHÔNG dùng để tự động trả lời hay trigger bất cứ gì.
// Mỗi channelId có 1 hàng đợi tối đa CHANNEL_CONTEXT_LIMIT tin nhắn gần nhất.
const channelBuffers = new Map(); // channelId -> [{ author, content, at }]

const MAX_CONTENT_LENGTH = 200;

/**
 * Ghi nhận 1 tin nhắn vào bộ đệm ngữ cảnh của kênh. Gọi cho MỌI tin nhắn user
 * gửi trong kênh (không chỉ tin nhắn @ bot), để bot "nghe" được xung quanh.
 */
export function trackChannelMessage(channelId, authorName, content) {
  if (!content || !content.trim()) return;

  if (!channelBuffers.has(channelId)) {
    channelBuffers.set(channelId, []);
  }

  const buffer = channelBuffers.get(channelId);
  buffer.push({
    author: authorName,
    content: content.length > MAX_CONTENT_LENGTH ? `${content.slice(0, MAX_CONTENT_LENGTH)}...` : content,
    at: Date.now()
  });

  while (buffer.length > CHANNEL_CONTEXT_LIMIT) {
    buffer.shift();
  }
}

/**
 * Trả về đoạn text ngữ cảnh gần đây của kênh, dùng làm 1 system message phụ
 * khi gọi AI — CHỈ để tham khảo, không phải lịch sử chat trực tiếp với bot.
 * @param {string} channelId
 * @param {object} [options]
 * @param {boolean} [options.excludeLast=true] - Bỏ dòng cuối (thường là tin nhắn hiện tại đang xử lý, đã có trong chat history riêng rồi, tránh lặp).
 */
export function getChannelContextMessage(channelId, { excludeLast = true } = {}) {
  const buffer = channelBuffers.get(channelId) || [];
  const entries = excludeLast ? buffer.slice(0, -1) : buffer;

  if (!entries.length) return "";

  const lines = entries.map(e => `${e.author}: ${e.content}`).join("\n");

  return `
[Ngữ cảnh nền - vài tin nhắn gần đây trong kênh, chỉ để tham khảo cho hiểu chuyện, KHÔNG cần phản hồi trực tiếp từng dòng này]
${lines}
`.trim();
}
