import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection
} from "@discordjs/voice";

export async function joinChannel(channel) {
  const oldConnection =
    getVoiceConnection(channel.guild.id);

  if (oldConnection) {
    oldConnection.destroy();
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false
  });

  try {
    await entersState(
      connection,
      VoiceConnectionStatus.Ready,
      10_000
    );

    return connection;

  } catch (error) {
    connection.destroy();
    throw error;
  }
}

export function leaveChannel(guildId) {
  const connection =
    getVoiceConnection(guildId);

  if (connection) {
    connection.destroy();
    return true;
  }

  return false;
}

export function getActiveConnection(guildId) {
  return getVoiceConnection(guildId);
}
