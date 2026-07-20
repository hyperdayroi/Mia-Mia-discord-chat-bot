// ========= ANTI-RAID (Part 11) =========
// Không bao giờ mass-ban chỉ vì mới join — chỉ nâng risk score + chuyển threat state + lockdown khi vượt ngưỡng.

import { enableLockdown } from "../protection/lockdown.js";
import { sendSecurityLog } from "../logger.js";
import { addRisk } from "../core/risk.js";
import { RAID_THRESHOLDS, NEW_ACCOUNT_AGE_MS } from "../constants.js";
import { safeHandler } from "../util.js";

function moduleOn(guildState) {
  return guildState.config.enabled && guildState.config.modules.antiRaid;
}

export function registerAntiRaid(client, getCtx) {
  client.on(
    "guildMemberAdd",
    safeHandler(async member => {
      if (member.user.bot) return; // bot mới join → xử lý ở antiBot.js
      const ctx = getCtx(member.guild);
      const { guildState, guild } = ctx;
      if (!moduleOn(guildState)) return;

      const now = Date.now();
      const accountAge = now - member.user.createdTimestamp;
      guildState.joins.push({ userId: member.id, timestamp: now, accountAge });

      if (accountAge < NEW_ACCOUNT_AGE_MS) {
        addRisk(guildState, member.id, 15, "Tài khoản mới (<3 ngày tuổi) tham gia trong lúc nhạy cảm");
      }

      const [alertCount, alertWindow] = RAID_THRESHOLDS.ALERT;
      const [lockdownCount, lockdownWindow] = RAID_THRESHOLDS.LOCKDOWN;
      const joinsInLockdownWindow = guildState.joins.filter(j => now - j.timestamp <= lockdownWindow).length;
      const joinsInAlertWindow = guildState.joins.filter(j => now - j.timestamp <= alertWindow).length;

      let newState = "NORMAL";
      if (joinsInLockdownWindow >= lockdownCount) newState = "LOCKDOWN";
      else if (joinsInAlertWindow >= alertCount) newState = "ALERT";

      if (newState === guildState.threatState) return;
      guildState.threatState = newState;

      if (newState === "ALERT") {
        await sendSecurityLog(ctx, {
          type: "RAID_DETECTED",
          severity: "MEDIUM",
          title: "Nghi ngờ Raid — mức ALERT",
          description: `${joinsInAlertWindow} thành viên vừa tham gia trong ${alertWindow / 1000}s.`
        });
      } else if (newState === "LOCKDOWN") {
        await enableLockdown(guild, guildState, "Tốc độ join vượt ngưỡng raid");
        await sendSecurityLog(ctx, {
          type: "RAID_DETECTED",
          severity: "CRITICAL",
          title: "🚨 RAID — đã tự động Lockdown",
          description: `${joinsInLockdownWindow} thành viên tham gia trong ${lockdownWindow / 1000}s. Đã khoá gửi tin nhắn của @everyone. Dùng /security unlockdown khi chắc chắn an toàn.`
        });
      }
    })
  );
}
