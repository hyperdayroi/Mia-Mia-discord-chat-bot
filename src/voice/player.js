import {
  createAudioPlayer,
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
  entersState
} from "@discordjs/voice";
import { Readable } from "stream";
import { pcmToWav } from "./wavUtil.js";

const TTS_SAMPLE_RATE = 24000;
const TTS_CHANNELS = 1;
const TTS_BIT_DEPTH = 16;

export async function playAudioBuffer(
  connection,
  pcmBuffer
) {
  const wavBuffer = pcmToWav(pcmBuffer, {
    sampleRate: TTS_SAMPLE_RATE,
    channels: TTS_CHANNELS,
    bitDepth: TTS_BIT_DEPTH
  });

  const resource = createAudioResource(
    Readable.from(wavBuffer),
    {
      inputType: StreamType.Arbitrary
    }
  );

  const player = createAudioPlayer();

  connection.subscribe(player);
  player.play(resource);

  // Chờ bắt đầu phát, nhưng không giữ timeout quá dài.
  await entersState(
    player,
    AudioPlayerStatus.Playing,
    5000
  );

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      player.removeListener(
        AudioPlayerStatus.Idle,
        onIdle
      );
      player.removeListener("error", onError);
    };

    const onIdle = () => {
      cleanup();
      resolve();
    };

    const onError = error => {
      cleanup();
      reject(error);
    };

    player.once(
      AudioPlayerStatus.Idle,
      onIdle
    );

    player.once("error", onError);
  });
}
