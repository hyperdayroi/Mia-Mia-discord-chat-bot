import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection
} from "@discordjs/voice";

/**
 * Join a Discord voice channel.
 *
 * Timeout cũ: 10 giây.
 * Bản này tăng lên 30 giây vì Discord Voice negotiation
 * trên Railway có thể mất lâu hơn.
 */
export async function joinChannel(channel) {
  if (!channel?.guild) {
    throw new Error(
      "Invalid voice channel: guild is missing."
    );
  }

  if (!channel.guild.voiceAdapterCreator) {
    throw new Error(
      "Discord voice adapter is unavailable. Check the Discord client/guild setup."
    );
  }

  const guildId = channel.guild.id;

  const oldConnection =
    getVoiceConnection(guildId);

  if (oldConnection) {
    try {
      oldConnection.destroy();
    } catch (error) {
      console.warn(
        "VOICE_OLD_CONNECTION_DESTROY_ERROR:",
        error
      );
    }
  }

  const connection =
    joinVoiceChannel({
      channelId: channel.id,
      guildId,
      adapterCreator:
        channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

  const stateLog =
    (oldState, newState) => {
      console.log(
        `VOICE_STATE: ${oldState.status} -> ${newState.status}`
      );
    };

  connection.on(
    "stateChange",
    stateLog
  );

  try {

    console.log(
      `VOICE_JOIN: joining ${
        channel.name ?? channel.id
      } (${channel.id})`
    );

    // Cho Discord Voice tối đa 30 giây
    // để hoàn tất quá trình kết nối.
    await entersState(
      connection,
      VoiceConnectionStatus.Ready,
      30_000
    );

    console.log(
      `VOICE_READY: connected to ${
        channel.name ?? channel.id
      }`
    );

    connection.off(
      "stateChange",
      stateLog
    );

    return connection;

  } catch (error) {

    console.error(
      `VOICE_CONNECT_TIMEOUT: state=${connection.state.status}`,
      error
    );

    connection.off(
      "stateChange",
      stateLog
    );

    try {
      connection.destroy();
    } catch (destroyError) {

      console.warn(
        "VOICE_CONNECTION_DESTROY_ERROR:",
        destroyError
      );

    }

    throw error;
  }
}


export function leaveChannel(guildId) {

  const connection =
    getVoiceConnection(guildId);

  if (connection) {

    try {
      connection.destroy();
    } catch (error) {

      console.warn(
        "VOICE_LEAVE_ERROR:",
        error
      );

    }

    return true;
  }

  return false;
}


export function getActiveConnection(guildId) {

  return getVoiceConnection(
    guildId
  );

}
