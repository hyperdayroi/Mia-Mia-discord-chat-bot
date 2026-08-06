import fetch from "node-fetch";
import {
  API_BASE,
  CKEY_API_KEY,
  CHAT_MODEL,
  IMAGE_MODEL,
  AI_PROVIDER,
  GEMINI_API_KEY,
  GEMINI_API_BASE,
  GEMINI_MODEL
} from "../config/env.js";

// ========= CHAT =========
// AI_PROVIDER=ckey (mặc định) hoặc AI_PROVIDER=gemini — chỉ ảnh hưởng /ask, mention chat...
// /image luôn dùng CKEY (Gemini free tier không có tạo ảnh tương đương).
export async function callChatModel(messages) {
  if (AI_PROVIDER === "gemini") {
    return callGeminiChatModel(messages);
  }
  return callCkeyChatModel(messages);
}

async function callCkeyChatModel(messages) {
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CKEY_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      temperature: 0.85,
      top_p: 0.95,
      max_tokens: 800
    })
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("CKEY CHAT ERROR:", JSON.stringify(data));
    throw new Error(JSON.stringify(data));
  }

  return data.choices?.[0]?.message?.content?.trim() || "";
}

// Gemini không có role "system" trong `contents` — dùng field `systemInstruction` riêng,
// và chỉ chấp nhận role "user"/"model" (không phải "assistant"). Hàm này tự chuyển đổi
// từ định dạng messages kiểu OpenAI (system/user/assistant) đang dùng trong codebase sang
// đúng định dạng Gemini, không cần sửa gì ở nơi gọi callChatModel().
async function callGeminiChatModel(messages) {
  const systemInstruction = messages
    .filter(m => m.role === "system")
    .map(m => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
    .join("\n\n");

  const contents = messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: typeof m.content === "string" ? m.content : extractTextFromContent(m.content) }]
    }));

  const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: { temperature: 0.85, maxOutputTokens: 800 }
    })
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("GEMINI CHAT ERROR:", JSON.stringify(data));
    throw new Error(JSON.stringify(data));
  }

  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
  return text.trim();
}

// Mention chat có thể gửi content dạng mảng (text + image_url) khi có ảnh đính kèm.
// Gemini xử lý ảnh khác cách (inlineData/fileData), phần này chỉ lấy phần text ra
// để không vỡ khi dùng AI_PROVIDER=gemini kèm ảnh — muốn Gemini đọc được ảnh cần
// nâng cấp thêm sau (chuyển ảnh sang inlineData base64).
function extractTextFromContent(content) {
  if (!Array.isArray(content)) return String(content ?? "");
  const textPart = content.find(p => p.type === "text");
  return textPart?.text || "";
}

// ========= IMAGE (luôn dùng CKEY, không đổi theo AI_PROVIDER) =========
export async function callImageModel(prompt) {
  const res = await fetch(`${API_BASE}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CKEY_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      parameters: {
        size: "2048*2048",
        n: 1,
        watermark: false,
        thinking_mode: true
      }
    })
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("CKEY IMAGE ERROR:", JSON.stringify(data));
    throw new Error(JSON.stringify(data));
  }

  if (data.data?.[0]?.url) {
    const imgRes = await fetch(data.data[0].url);
    return Buffer.from(await imgRes.arrayBuffer());
  }

  if (data.data?.[0]?.b64_json) {
    return Buffer.from(data.data[0].b64_json, "base64");
  }

  throw new Error("No image returned");
}
