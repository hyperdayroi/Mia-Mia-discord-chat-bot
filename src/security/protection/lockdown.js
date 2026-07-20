// ========= EMERGENCY LOCKDOWN (Part 18) =========
// Chỉ khoá SendMessages của @everyone, và chỉ trên kênh nào CHƯA bị khoá tay từ trước.
// Nhớ chính xác những kênh mình đã đổi để unlockdown khôi phục đúng — không đụng kênh đã khoá sẵn.

import { PermissionFlagsBits, ChannelType } from "discord.js";

const LOCKABLE_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

export async function enableLockdown(guild, guildState, reason) {
  if (guildState.lockdown.active) return guildState.lockdown;

  const everyoneId = guild.id;
  const applied = [];
  const textChannels = guild.channels.cache.filter(c => LOCKABLE_TYPES.includes(c.type));

  for (const channel of textChannels.values()) {
    const overwrite = channel.permissionOverwrites.cache.get(everyoneId);
    const alreadyDenied = overwrite?.deny?.has(PermissionFlagsBits.SendMessages);
    if (alreadyDenied) continue; // đã bị khoá tay từ trước — không đụng vào

    try {
      await channel.permissionOverwrites.edit(
        everyoneId,
        { SendMessages: false },
        { reason: `Mia Security lockdown: ${reason}` }
      );
      applied.push(channel.id);
    } catch (err) {
      console.error(`LOCKDOWN_CHANNEL_ERROR (${channel.name}):`, err.message);
    }
  }

  guildState.lockdown = { active: true, reason, activatedAt: Date.now(), appliedChannelIds: applied };
  return guildState.lockdown;
}

export async function disableLockdown(guild, guildState) {
  if (!guildState.lockdown.active) return guildState.lockdown;

  const everyoneId = guild.id;
  for (const channelId of guildState.lockdown.appliedChannelIds) {
    const channel = guild.channels.cache.get(channelId);
    if (!channel) continue;
    try {
      // Xoá hẳn overwrite mà lockdown đã thêm — đưa kênh về đúng trạng thái trước lockdown
      await channel.permissionOverwrites.edit(
        everyoneId,
        { SendMessages: null },
        { reason: "Mia Security: unlockdown" }
      );
    } catch (err) {
      console.error(`UNLOCKDOWN_CHANNEL_ERROR (${channel.name}):`, err.message);
    }
  }

  guildState.lockdown = { active: false, reason: null, activatedAt: null, appliedChannelIds: [] };
  return guildState.lockdown;
}
