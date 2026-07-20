// ========= FORENSICS — REPORT BUILDERS (Part 20) =========

import { EmbedBuilder } from "discord.js";
import { getRisk } from "../core/risk.js";
import { recentEvents } from "../core/correlation.js";
import { SEVERITY_COLOR } from "../constants.js";

export function buildStatusEmbed(guild, guildState) {
  const modules = Object.entries(guildState.config.modules)
    .map(([k, v]) => `${v ? "✅" : "❌"} ${k}`)
    .join("\n");

  return new EmbedBuilder()
    .setColor(SEVERITY_COLOR[guildState.threatState] || SEVERITY_COLOR.INFO)
    .setTitle(`🛡️ Mia Security — ${guild.name}`)
    .addFields(
      { name: "Trạng thái", value: guildState.config.enabled ? "Đang bật" : "Đang tắt", inline: true },
      { name: "Mức đe doạ", value: guildState.threatState, inline: true },
      {
        name: "Lockdown",
        value: guildState.lockdown.active ? `🔒 Đang khoá (${guildState.lockdown.reason})` : "🔓 Bình thường",
        inline: true
      },
      {
        name: "Kênh log",
        value: guildState.config.logChannelId ? `<#${guildState.config.logChannelId}>` : "Chưa cấu hình (`/security setup`)",
        inline: true
      },
      { name: "Modules", value: modules || "—" }
    )
    .setTimestamp();
}

export function buildConfigEmbed(guild, guildState) {
  const wl = guildState.config.whitelist;
  const blockedDomains = guildState.config.linkPolicy.blockedDomains;
  return new EmbedBuilder()
    .setColor(SEVERITY_COLOR.INFO)
    .setTitle(`⚙️ Cấu hình Security — ${guild.name}`)
    .addFields(
      { name: "autoBan", value: String(guildState.config.autoBan), inline: true },
      { name: "autoKickRiskyBots", value: String(guildState.config.autoKickRiskyBots), inline: true },
      { name: "Trusted users", value: wl.users.length ? wl.users.map(id => `<@${id}>`).join(", ") : "—" },
      { name: "Trusted roles", value: wl.roles.length ? wl.roles.map(id => `<@&${id}>`).join(", ") : "—" },
      { name: "Trusted bots", value: wl.bots.length ? wl.bots.map(id => `<@${id}>`).join(", ") : "—" },
      { name: "Blocked domains", value: blockedDomains.length ? blockedDomains.join(", ") : "—" }
    );
}

export function buildLogsEmbed(guildState) {
  const events = recentEvents(guildState, 15);
  const desc = events.length
    ? events
        .map(e => `<t:${Math.floor(e.timestamp / 1000)}:T> — **${e.action}**${e.executorId ? ` bởi <@${e.executorId}>` : ""}`)
        .join("\n")
    : "Chưa có sự kiện nào được ghi nhận.";
  return new EmbedBuilder().setColor(SEVERITY_COLOR.INFO).setTitle("📜 Security Logs gần đây").setDescription(desc);
}

export function buildThreatsEmbed(guildState) {
  const risky = Object.keys(guildState.risk)
    .map(userId => ({ userId, ...getRisk(guildState, userId) }))
    .filter(r => r.score > 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const desc = risky.length
    ? risky
        .map(r => `<@${r.userId}> — **${r.score}** (${r.level})\n${r.reasons.map(x => `• ${x.reason} (+${x.points})`).join("\n")}`)
        .join("\n\n")
    : "Không có mối đe doạ đáng kể nào gần đây.";

  return new EmbedBuilder().setColor(SEVERITY_COLOR.HIGH).setTitle("⚠️ Threats gần đây").setDescription(desc);
}
