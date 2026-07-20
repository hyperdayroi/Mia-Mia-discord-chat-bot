// ========= MESSAGE SECURITY PIPELINE =========
// 1 điểm vào duy nhất cho index.js — tránh phải tạo thêm client.on("messageCreate") riêng.

import { isProtectedMember } from "./protection/whitelist.js";
import { recordMessage, normalizeContent } from "./core/messageActivity.js";
import { scanFlood } from "./detectors/antiFlood.js";
import { scanSpamPatterns } from "./detectors/antiSpam.js";
import { scanLinks } from "./detectors/antiLink.js";
import { scanMentions } from "./detectors/antiMention.js";

// Trả về true nếu tin nhắn đã bị Security Engine xoá — index.js nên `return` ngay khi true,
// để không xử lý AI chat / prefix-command tiếp trên 1 tin đã bị coi là vi phạm.
export async function scanMessageSecurity(getCtx, message) {
  if (!message.guild || message.author.bot) return false;

  const ctx = getCtx(message.guild);
  const { guildState, ownerId, guild } = ctx;
  if (!guildState.config.enabled) return false;

  // Whitelist (owner/server owner/trusted user/role) -> bỏ qua hoàn toàn, không quét, không tính risk.
  if (isProtectedMember(guild, guildState, message.member, ownerId)) return false;

  // Ghi nhận hoạt động 1 LẦN DUY NHẤT, dùng chung cho cả antiFlood lẫn antiSpam bên dưới.
  recordMessage(guildState, message.author.id, {
    channelId: message.channelId,
    contentKey: normalizeContent(message.content),
    hasAttachment: message.attachments.size > 0
  });

  const modules = guildState.config.modules;

  if (modules.antiFlood && (await scanFlood(ctx, message))) return true;
  if (modules.antiSpam && (await scanSpamPatterns(ctx, message))) return true;
  if (modules.antiLink && (await scanLinks(ctx, message))) return true;
  if (modules.antiMention && (await scanMentions(ctx, message))) return true;

  return false;
}
