// ========= ANTI-MASS-MENTION (Part 14) =========

import { PermissionFlagsBits } from "discord.js";
import { applyMessagePenalty } from "../core/messagePenalty.js";
import { RISK_POINTS, MENTION_SPAM_COUNT } from "../constants.js";

export async function scanMentions(ctx, message) {
  const userId = message.author.id;
  const member = message.member;

  // @everyone / @here: Discord đã tự chặn nếu member không có quyền MentionEveryone,
  // nên chỉ đáng lo khi member THỰC SỰ có quyền đó nhưng dùng bừa bãi — vẫn tính là tín hiệu đáng ghi nhận.
  const usedEveryone = message.mentions.everyone;
  const distinctUserMentions = message.mentions.users.filter(u => u.id !== message.client.user.id).size;

  if (usedEveryone && member?.permissions.has(PermissionFlagsBits.MentionEveryone)) {
    return applyMessagePenalty(ctx, message, {
      points: RISK_POINTS.MASS_MENTION,
      reason: "Dùng @everyone/@here",
      logType: "MASS_MENTION",
      title: "📢 Phát hiện Mass Mention",
      description: `<@${userId}> vừa dùng @everyone/@here ở <#${message.channelId}>.`
    });
  }

  if (distinctUserMentions >= MENTION_SPAM_COUNT) {
    return applyMessagePenalty(ctx, message, {
      points: RISK_POINTS.MASS_MENTION,
      reason: `Mention ${distinctUserMentions} người trong 1 tin nhắn`,
      logType: "MASS_MENTION",
      title: "📢 Phát hiện Mass Mention",
      description: `<@${userId}> đã mention ${distinctUserMentions} người cùng lúc ở <#${message.channelId}>.`
    });
  }

  return false;
}
