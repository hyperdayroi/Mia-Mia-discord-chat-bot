// ========= ANTI-SPAM (Part 12) — duplicate / character / emoji spam =========
// Flood tốc độ tin nhắn nằm ở antiFlood.js (module riêng, toggle riêng).

import { countDuplicates, normalizeContent } from "../core/messageActivity.js";
import { applyMessagePenalty } from "../core/messagePenalty.js";
import { RISK_POINTS, DUPLICATE_THRESHOLD, CHAR_SPAM_REGEX, EMOJI_SPAM_COUNT } from "../constants.js";

const EMOJI_REGEX = /<a?:\w+:\d+>|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

function countEmoji(content) {
  return (content.match(EMOJI_REGEX) || []).length;
}

// Lưu ý: messageActivity đã được ghi nhận ở messagePipeline.js TRƯỚC khi hàm này chạy.
export async function scanSpamPatterns(ctx, message) {
  const { guildState } = ctx;
  const userId = message.author.id;
  const contentKey = normalizeContent(message.content);

  const [dupLimit, dupWindow] = DUPLICATE_THRESHOLD;
  if (contentKey && countDuplicates(guildState, userId, contentKey, dupWindow) >= dupLimit) {
    return applyMessagePenalty(ctx, message, {
      points: RISK_POINTS.DUPLICATE_SPAM,
      reason: "Spam tin nhắn giống nhau nhiều lần",
      logType: "SPAM_DETECTED",
      title: "💬 Phát hiện Duplicate Spam",
      description: `<@${userId}> gửi lặp lại cùng 1 nội dung nhiều lần.`
    });
  }

  if (CHAR_SPAM_REGEX.test(message.content)) {
    return applyMessagePenalty(ctx, message, {
      points: RISK_POINTS.SPAM,
      reason: "Spam ký tự lặp lại",
      logType: "SPAM_DETECTED",
      title: "💬 Phát hiện Character Spam",
      description: `<@${userId}> gửi tin có ký tự lặp lại bất thường.`
    });
  }

  if (countEmoji(message.content) >= EMOJI_SPAM_COUNT) {
    return applyMessagePenalty(ctx, message, {
      points: RISK_POINTS.SPAM,
      reason: "Spam emoji",
      logType: "SPAM_DETECTED",
      title: "💬 Phát hiện Emoji Spam",
      description: `<@${userId}> gửi quá nhiều emoji trong 1 tin nhắn.`
    });
  }

  return false;
}
