// ========= SECURITY LOG CHANNEL (Parts 21-24) =========
// Không bao giờ crash nếu thiếu kênh/quyền — log console, cảnh báo 1 lần, không retry dồn dập.

import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { LOG_EMOJI, SEVERITY_COLOR } from "./constants.js";
import { persist } from "./store.js";

export async function sendSecurityLog(ctx, { type, severity = "INFO", title, description, fields = [] }) {
  const { guild, guildState } = ctx;

  console.log(`[MIA SECURITY][${guild.name}][${severity}] ${title}`);

  if (!guildState.config.logChannelId) return; // chưa setup kênh log — chỉ log console (Part 24)

  const channel = guild.channels.cache.get(guildState.config.logChannelId);
  if (!channel) {
    if (!guildState.logChannelUnavailableWarned) {
      console.error(`SECURITY_LOG_CHANNEL_MISSING (guild ${guild.id}): kênh ${guildState.config.logChannelId} không còn tồn tại.`);
      guildState.logChannelUnavailableWarned = true;
      persist();
    }
    return;
  }

  const me = guild.members.me;
  const perms = me ? channel.permissionsFor(me) : null;
  const required = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
  if (!perms || !required.every(p => perms.has(p))) {
    if (!guildState.logChannelUnavailableWarned) {
      console.error(`SECURITY_LOG_CHANNEL_NO_PERMISSION (guild ${guild.id}): thiếu quyền trong #${channel.name}.`);
      guildState.logChannelUnavailableWarned = true;
      persist();
    }
    return;
  }

  if (guildState.logChannelUnavailableWarned) {
    guildState.logChannelUnavailableWarned = false;
    persist();
  }

  const embed = new EmbedBuilder()
    .setColor(SEVERITY_COLOR[severity] ?? SEVERITY_COLOR.INFO)
    .setTitle(`${LOG_EMOJI[type] || LOG_EMOJI.INFO} ${title}`)
    .setTimestamp();
  if (description) embed.setDescription(description);
  if (fields.length) embed.addFields(fields);

  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("SECURITY_LOG_SEND_ERROR:", err.message);
  }
}
