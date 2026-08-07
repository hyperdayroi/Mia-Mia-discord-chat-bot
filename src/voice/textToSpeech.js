import fetch from "node-fetch";
import { GEMINI_API_KEY, GEMINI_API_BASE, GEMINI_TTS_MODEL, GEMINI_TTS_VOICE } from "../config/env.js";

/**
 * Gửi text cho Gemini TTS, trả về PCM buffer (24kHz, 16-bit, mono — đúng định
 * dạng output mặc định của Gemini TTS) để phát trực tiếp qua @discordjs/voice.
 * @param {string} text
 * @returns {Promise<Buffer>}
 */
export async function synthesizeSpeech(text) {
  const url = `${GEMINI_API_BASE}/models/${GEMINI_TTS_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_TTS_VOICE } }
        }
      }
    })
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("GEMINI_TTS_ERROR:", JSON.stringify(data));
    throw new Error(JSON.stringify(data));
  }

  const base64Audio = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Gemini TTS không trả về audio.");
  }

  // Gemini TTS trả PCM thô 24kHz/16-bit/mono (audio/L16), không có WAV header.
  return Buffer.from(base64Audio, "base64");
}
