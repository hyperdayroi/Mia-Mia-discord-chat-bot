// ========= RESPONSE ENGINE (Part 19) =========
// Flow: Event → Normalize → Store → Analyze → Correlate → Risk Score → Response → Report
// Không bao giờ ban mù quáng: whitelist trước, rồi mới xét theo tier risk score.

import { addRisk, getRisk } from "./risk.js";
import { recordEvent, checkVelocity, checkNukeCombo } from "./correlation.js";
import { isProtectedMember } from "../protection/whitelist.js";
import { revokeDangerousPermissions } from "../protection/firewall.js";
import { enableLockdown } from "../protection/lockdown.js";
import { sendSecurityLog } from "../logger.js";
import { RISK_POINTS } from "../constants.js";

/**
 * ctx: { client, guild, guildState, ownerId }
 * eventInput: { action, executorId, targetId, points, reason, logType, severity, title, description, fields }
 */
export async function handleSecurityEvent(ctx, eventInput) {
  const { guild, guildState, ownerId } = ctx;
  const { action, executorId, targetId, points, reason } = eventInput;

  recordEvent(guildState, { guildId: guild.id, executorId: executorId || null, action, targetId });

  let executorMember = null;
  if (executorId) {
    executorMember =
      guild.members.cache.get(executorId) || (await guild.members.fetch(executorId).catch(() => null));
  }

  const protectedExecutor = executorMember
    ? isProtectedMember(guild, guildState, executorMember, ownerId)
    : false;

  // Vẫn cộng điểm + log dù executor được whitelist (Part 8: hành động nguy hiểm của họ vẫn nên được ghi log),
  // nhưng KHÔNG áp dụng phản ứng tự động (revoke/lockdown/kick/ban) lên họ.
  if (executorId) addRisk(guildState, executorId, points, reason);

  const velocity = executorId ? checkVelocity(guildState, executorId, action) : { breached: false };
  const combo = executorId ? checkNukeCombo(guildState, executorId) : { matched: false };

  if (executorId && (velocity.breached || combo.matched)) {
    addRisk(guildState, executorId, RISK_POINTS.NUKE_PATTERN_BONUS, "Phát hiện nuke pattern (velocity/combo)");
  }

  const finalRisk = executorId ? getRisk(guildState, executorId) : { score: 0, level: "NORMAL" };
  const actionsTaken = [];

  if (executorMember && !protectedExecutor) {
    if (finalRisk.level === "HIGH_RISK" || finalRisk.level === "CRITICAL") {
      const removed = await revokeDangerousPermissions(executorMember).catch(() => []);
      if (removed.length) actionsTaken.push(`Đã gỡ quyền nguy hiểm: ${removed.join(", ")}`);
    }

    if (finalRisk.level === "CRITICAL") {
      await enableLockdown(guild, guildState, `Nuke pattern — executor ${executorId}`).catch(() => null);
      actionsTaken.push("Đã bật Emergency Lockdown");

      if (guildState.config.autoBan) {
        try {
          await guild.members.ban(executorId, { reason: "Mia Security: nuke pattern (autoBan)" });
          actionsTaken.push("Đã ban executor (autoBan đang bật)");
        } catch (err) {
          console.error("AUTO_BAN_ERROR:", err.message);
        }
      }
    }
  } else if (protectedExecutor) {
    actionsTaken.push("Executor nằm trong whitelist — chỉ ghi log, không tự động phản ứng");
  }

  await sendSecurityLog(ctx, {
    type: eventInput.logType,
    severity: eventInput.severity || finalRisk.level,
    title: eventInput.title,
    description: eventInput.description,
    fields: [
      ...(eventInput.fields || []),
      { name: "Risk Score", value: `${finalRisk.score} (${finalRisk.level})`, inline: true },
      executorId ? { name: "Executor", value: `<@${executorId}>`, inline: true } : null,
      actionsTaken.length ? { name: "Hành động đã thực hiện", value: actionsTaken.join("\n") } : null
    ].filter(Boolean)
  });

  return { risk: finalRisk, actionsTaken };
}
