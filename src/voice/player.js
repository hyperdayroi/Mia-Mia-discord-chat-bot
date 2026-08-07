import { createAudioPlayer, createAudioResource, StreamType, AudioPlayerStatus, entersState } from "@discordjs/voice";
import { Readable } from "stream";
import { pcmToWav } from "./wavUtil.js";

// Gemini TTS trả PCM thô 24kHz/16-bit/mono (xem textToSpeech.js).
const TTS_SAMPLE_RATE = 24000;
const TTS_CHANNELS = 1;
const TTS_BIT_DEPTH = 16;

/**
 * Phát 1 đoạn PCM (từ Gemini TTS) qua voice connection, đợi phát xong mới resolve.
 * Dùng StreamType.Arbitrary để @discordjs/voice tự dùng ffmpeg chuyển đổi sample
 * rate/channel cho đúng chuẩn Discord (48kHz), không cần tự resample thủ công.
 * @param {import("@discordjs/voice").VoiceConnection} connection
 * @param {Buffer} pcmBuffer
 */
export async function playAudioBuffer(connection, pcmBuffer) {
  const wavBuffer = pcmToWav(pcmBuffer, {
    sampleRate: TTS_SAMPLE_RATE,
    channels: TTS_CHANNELS,
    bitDepth: TTS_BIT_DEPTH
  });

  const resource = createAudioResource(Readable.from(wavBuffer), { inputType: StreamType.Arbitrary });
  const player = createAudioPlayer();

  connection.subscribe(player);
  player.play(resource);

  await entersState(player, AudioPlayerStatus.Playing, 10_000);

  return new Promise((resolve, reject) => {
    player.once(AudioPlayerStatus.Idle, resolve);
    player.once("error", reject);
  });
}
