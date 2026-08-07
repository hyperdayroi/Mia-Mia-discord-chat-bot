import fetch from "node-fetch";
import {
  GEMINI_API_KEY,
  GEMINI_API_BASE,
  GEMINI_TTS_MODEL,
  GEMINI_TTS_VOICE
} from "../config/env.js";

export async function synthesizeSpeech(text) {
  const cleanText = String(text)
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[*_~`#]/g, "")
    .trim();

  if (!cleanText) {
    throw new Error("Không có text để TTS.");
  }

  const url =
    `${GEMINI_API_BASE}/models/${GEMINI_TTS_MODEL}` +
    `:generateContent?key=${GEMINI_API_KEY}`;

  const started = Date.now();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: cleanText }]
        }
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: GEMINI_TTS_VOICE
            }
          }
        }
      }
    })
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(
      "GEMINI_TTS_ERROR:",
      JSON.stringify(data)
    );
    throw new Error(JSON.stringify(data));
  }

  const base64Audio =
    data?.candidates?.[0]?.content?.parts?.[0]
      ?.inlineData?.data;

  if (!base64Audio) {
    throw new Error("Gemini TTS không trả về audio.");
  }

  console.log(
    `VOICE_TTS: ${Date.now() - started}ms`
  );

  return Buffer.from(base64Audio, "base64");
}
