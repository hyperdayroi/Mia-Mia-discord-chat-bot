import { joinVoiceChannel, VoiceConnectionStatus, entersState, getVoiceConnection } from "@discordjs/voice";

/**
 * Bot chỉ ở trong 1 kênh voice / server tại 1 thời điểm.
 * @param {import("discord.js").VoiceBasedChannel} channel
 */
export async function joinChannel(channel) {
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false // phải tắt selfDeaf thì mới nhận được audio người dùng gửi lên
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  return connection;
}

/** @param {string} guildId */
export function leaveChannel(guildId) {
  const connection = getVoiceConnection(guildId);
  if (connection) {
    connection.destroy();
    return true;
  }
  return false;
}

/** @param {string} guildId */
export function getActiveConnection(guildId) {
  return getVoiceConnection(guildId);
}
