import { EndBehaviorType } from "@discordjs/voice";
import prism from "prism-media";
import { pcmToWav } from "./wavUtil.js";

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BIT_DEPTH = 16;

/**
 * Nghe 1 lượt nói của `userId` trong voice connection hiện tại, tự dừng sau
 * khi im lặng `silenceMs`, hoặc sau `maxMs` nếu nói quá dài (an toàn, tránh treo mãi).
 * @param {import("@discordjs/voice").VoiceConnection} connection
 * @param {string} userId
 * @param {{ silenceMs?: number, maxMs?: number }} [options]
 * @returns {Promise<Buffer|null>} Buffer WAV (48kHz stereo 16-bit) hoặc null nếu không có audio.
 */
export function captureUtterance(connection, userId, { silenceMs = 1200, maxMs = 20000 } = {}) {
  return new Promise(resolve => {
    const opusStream = connection.receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: silenceMs }
    });

    const decoder = new prism.opus.Decoder({ rate: SAMPLE_RATE, channels: CHANNELS, frameSize: 960 });
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
      opusStream.destroy();
      decoder.destroy();

      if (!totalBytes) {
        resolve(null);
        return;
      }
      resolve(pcmToWav(Buffer.concat(pcmChunks), { sampleRate: SAMPLE_RATE, channels: CHANNELS, bitDepth: BIT_DEPTH }));
    }

    decoder.on("data", chunk => {
      pcmChunks.push(chunk);
      totalBytes += chunk.length;
    });

    decoder.on("error", err => {
      console.error("VOICE_DECODE_ERROR:", err.message || err);
      finish();
    });

    opusStream.on("error", () => finish());
    opusStream.pipe(decoder);
    decoder.once("end", finish);
  });
}
