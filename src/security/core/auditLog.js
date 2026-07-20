// ========= AUDIT LOG RESOLUTION (Part 9) =========
// "You MUST use Discord Audit Logs to identify the executor. Do not guess the executor from messages."
// Không bao giờ throw ra ngoài — thiếu quyền "View Audit Log" thì trả về null và log console 1 lần, không crash, không retry dồn dập.

import { AuditLogEvent } from "discord.js";

let warnedGuilds = new Set();

export async function resolveExecutor(guild, auditLogEvent, targetId, { maxAgeMs = 8000 } = {}) {
  try {
    const logs = await guild.fetchAuditLogs({ type: auditLogEvent, limit: 6 });
    const now = Date.now();
    const entry = logs.entries.find(e => {
      const matchesTarget = targetId ? e.targetId === targetId : true;
      const recent = now - e.createdTimestamp < maxAgeMs;
      return matchesTarget && recent;
    });
    return entry?.executor ? { id: entry.executor.id, tag: entry.executor.tag } : null;
  } catch (err) {
    if (!warnedGuilds.has(guild.id)) {
      console.error(
        `AUDIT_LOG_ERROR (guild ${guild.id}) — kiểm tra quyền "View Audit Log" của Mia trong server này:`,
        err.message
      );
      warnedGuilds.add(guild.id);
    }
    return null;
  }
}

export { AuditLogEvent };
