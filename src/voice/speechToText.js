import fetch from "node-fetch";
import { GEMINI_API_KEY, GEMINI_API_BASE, GEMINI_MODEL } from "../config/env.js";

/**
 * Gửi audio (WAV buffer) cho Gemini để lấy ra transcript văn bản thuần —
 * không dùng dịch vụ STT riêng, tận dụng khả năng đọc audio trực tiếp của Gemini.
 * @param {Buffer} wavBuffer
 * @returns {Promise<string>}
 */
export async function transcribeAudio(wavBuffer) {
  const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: "Hãy phiên âm CHÍNH XÁC những gì được nói trong đoạn audio này sang văn bản tiếng Việt. Chỉ trả về đúng phần văn bản đã nói, không thêm chú thích, không thêm dấu ngoặc kép, không dịch nghĩa gì thêm." },
            { inlineData: { mimeType: "audio/wav", data: wavBuffer.toString("base64") } }
          ]
        }
      ],
      generationConfig: { temperature: 0.1, maxOutputTokens: 300 }
    })
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("GEMINI_STT_ERROR:", JSON.stringify(data));
    throw new Error(JSON.stringify(data));
  }

  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
  return text.trim();
}
