// ========= ANTI-FLOOD (Part 12) — tốc độ gửi tin nhắn =========
// Lưu ý: messageActivity đã được ghi nhận ở messagePipeline.js TRƯỚC khi hàm này chạy.

import { countInChannel, countAttachmentsInChannel } from "../core/messageActivity.js";
import { applyMessagePenalty } from "../core/messagePenalty.js";
import { RISK_POINTS, FLOOD_THRESHOLD, ATTACHMENT_FLOOD_THRESHOLD } from "../constants.js";

export async function scanFlood(ctx, message) {
  const { guildState } = ctx;
  const userId = message.author.id;
  const hasAttachment = message.attachments.size > 0;

  const [floodLimit, floodWindow] = FLOOD_THRESHOLD;
  if (countInChannel(guildState, userId, message.channelId, floodWindow) >= floodLimit) {
    return applyMessagePenalty(ctx, message, {
      points: RISK_POINTS.SPAM,
      reason: "Gửi tin nhắn quá nhanh (flood)",
      logType: "SPAM_DETECTED",
      title: "💬 Phát hiện Flood",
      description: `<@${userId}> gửi tin quá nhanh ở <#${message.channelId}>.`
    });
  }

  const [attLimit, attWindow] = ATTACHMENT_FLOOD_THRESHOLD;
  if (hasAttachment && countAttachmentsInChannel(guildState, userId, message.channelId, attWindow) >= attLimit) {
    return applyMessagePenalty(ctx, message, {
      points: RISK_POINTS.SPAM,
      reason: "Spam đính kèm file/ảnh",
      logType: "SPAM_DETECTED",
      title: "💬 Phát hiện Attachment Spam",
      description: `<@${userId}> gửi quá nhiều file/ảnh liên tiếp ở <#${message.channelId}>.`
    });
  }

  return false;
}
