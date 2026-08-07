import fetch from "node-fetch";
import {
  GEMINI_API_KEY,
  GEMINI_API_BASE,
  GEMINI_MODEL
} from "../config/env.js";

/*
 * STT có thể dùng model riêng nếu Railway env có:
 * GEMINI_STT_MODEL=...
 *
 * Nếu không có thì tự fallback về GEMINI_MODEL hiện tại.
 */
const STT_MODEL =
  process.env.GEMINI_STT_MODEL || GEMINI_MODEL;

const STT_PROMPT =
  "Phiên âm chính xác audio sang tiếng Việt. " +
  "Chỉ trả về đúng lời được nói, không giải thích.";

export async function transcribeAudio(wavBuffer) {
  const url =
    `${GEMINI_API_BASE}/models/${STT_MODEL}` +
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
          parts: [
            { text: STT_PROMPT },
            {
              inlineData: {
                mimeType: "audio/wav",
                data: wavBuffer.toString("base64")
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 100
      }
    })
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(
      "GEMINI_STT_ERROR:",
      JSON.stringify(data)
    );
    throw new Error(JSON.stringify(data));
  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map(p => p.text || "")
      .join("") || "";

  console.log(
    `VOICE_STT: ${Date.now() - started}ms`
  );

  return text.trim();
}
