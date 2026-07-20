// ========= MESSAGE PENALTY / ESCALATION (Part 19, áp dụng riêng cho spam/link/mention) =========
// Nuke-type threat dùng Permission Firewall + Lockdown (core/response.js).
// Message-type threat (spam/link/mention) dùng Delete + Timeout — vũ khí phù hợp hơn cho loại vi phạm này.

import { addRisk } from "./risk.js";
import { sendSecurityLog } from "../logger.js";
import { MESSAGE_TIMEOUT_MS } from "../constants.js";

/**
 * ctx: { guild, guildState, ownerId }
 * Trả về true nếu tin nhắn đã bị xoá (để pipeline biết dừng xử lý tiếp).
 */
export async function applyMessagePenalty(ctx, message, { points, reason, logType, title, description }) {
  const { guild, guildState } = ctx;
  const userId = message.author.id;

  const risk = addRisk(guildState, userId, points, reason);

  let deleted = false;
  try {
    await message.delete();
    deleted = true;
  } catch (err) {
    // Thường do thiếu quyền Manage Messages hoặc tin đã bị xoá trước đó — không crash
    console.error("MESSAGE_DELETE_ERROR:", err.message);
  }

  const actionsTaken = deleted ? ["Đã xoá tin nhắn vi phạm"] : [];

  const timeoutMs = MESSAGE_TIMEOUT_MS[risk.level];
  if (timeoutMs && message.member) {
    try {
      await message.member.timeout(timeoutMs, `Mia Security: ${reason}`);
      actionsTaken.push(`Đã timeout ${Math.round(timeoutMs / 60000)} phút`);
    } catch (err) {
      console.error("MESSAGE_TIMEOUT_ERROR:", err.message);
    }
  }

  await sendSecurityLog(ctx, {
    type: logType,
    severity: risk.level,
    title,
    description,
    fields: [
      { name: "User", value: `<@${userId}>`, inline: true },
      { name: "Kênh", value: `<#${message.channelId}>`, inline: true },
      { name: "Risk Score", value: `${risk.score} (${risk.level})`, inline: true },
      actionsTaken.length ? { name: "Hành động", value: actionsTaken.join("\n") } : null
    ].filter(Boolean)
  });

  return deleted;
}
