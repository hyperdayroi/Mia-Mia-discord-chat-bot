// ========= ANTI-BOT RISK DETECTION (Part 16) =========
// Không tự động kick bot trừ khi config cho phép — mặc định chỉ cảnh báo.

import { AuditLogEvent } from "discord.js";
import { resolveExecutor } from "../core/auditLog.js";
import { memberHasDangerousPermission } from "../protection/firewall.js";
import { sendSecurityLog } from "../logger.js";
import { addRisk } from "../core/risk.js";
import { safeHandler } from "../util.js";

function moduleOn(guildState) {
  return guildState.config.enabled && guildState.config.modules.antiBot;
}

export function registerAntiBot(client, getCtx) {
  client.on(
    "guildMemberAdd",
    safeHandler(async member => {
      if (!member.user.bot) return;
      const ctx = getCtx(member.guild);
      const { guildState, guild } = ctx;
      if (!moduleOn(guildState)) return;

      const executor = await resolveExecutor(guild, AuditLogEvent.BotAdd, member.id);
      const dangerous = memberHasDangerousPermission(member);
      if (!dangerous) return;

      addRisk(guildState, executor?.id || member.id, 40, `Bot có quyền nguy hiểm được thêm: ${member.user.tag}`);

      if (guildState.config.autoKickRiskyBots) {
        try {
          await member.kick("Mia Security: risky bot auto-kick");
        } catch (err) {
          console.error("AUTO_KICK_BOT_ERROR:", err.message);
        }
      }

      await sendSecurityLog(ctx, {
        type: "RISKY_BOT_ADDED",
        severity: "HIGH",
        title: "🤖 RISKY BOT DETECTED",
        description: guildState.config.autoKickRiskyBots
          ? "Bot có quyền nguy hiểm — đã tự động kick."
          : "Bot có quyền nguy hiểm — CHƯA kick (bật `autoKickRiskyBots` qua `/security config` nếu muốn tự động).",
        fields: [
          { name: "Bot", value: `${member.user.tag} (${member.id})`, inline: true },
          { name: "Thêm bởi", value: executor ? `<@${executor.id}>` : "Không rõ (thiếu audit log)", inline: true }
        ]
      });
    })
  );
}
