import { EndBehaviorType } from "@discordjs/voice";
import prism from "prism-media";
import { pcmToWav } from "./wavUtil.js";

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BIT_DEPTH = 16;

// Shorter silence = lower response latency.
// 800ms is a good starting point for normal conversation.
const DEFAULT_SILENCE_MS = 800;
const DEFAULT_MAX_MS = 15000;

export function captureUtterance(
  connection,
  userId,
  {
    silenceMs = DEFAULT_SILENCE_MS,
    maxMs = DEFAULT_MAX_MS
  } = {}
) {
  return new Promise(resolve => {
    const opusStream = connection.receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: silenceMs
      }
    });

    const decoder = new prism.opus.Decoder({
      rate: SAMPLE_RATE,
      channels: CHANNELS,
      frameSize: 960
    });

    const pcmChunks = [];
    let settled = false;
    let totalBytes = 0;

    const maxDurationTimer = setTimeout(() => {
      finish();
    }, maxMs);

    function finish() {
      if (settled) return;
      settled = true;

      clearTimeout(maxDurationTimer);

      try {
        opusStream.destroy();
      } catch {}

      try {
        decoder.destroy();
      } catch {}

      if (!totalBytes) {
        resolve(null);
        return;
      }

      resolve(
        pcmToWav(Buffer.concat(pcmChunks), {
          sampleRate: SAMPLE_RATE,
          channels: CHANNELS,
          bitDepth: BIT_DEPTH
        })
      );
    }

    decoder.on("data", chunk => {
      pcmChunks.push(chunk);
      totalBytes += chunk.length;
    });

    decoder.on("error", err => {
      console.error(
        "VOICE_DECODE_ERROR:",
        err.message || err
      );
      finish();
    });

    opusStream.on("error", err => {
      console.error(
        "VOICE_CAPTURE_STREAM_ERROR:",
        err.message || err
      );
      finish();
    });

    opusStream.pipe(decoder);
    decoder.once("end", finish);
  });
}
