import fetch from "node-fetch";
import { API_BASE, CKEY_API_KEY, CHAT_MODEL, IMAGE_MODEL } from "../config/env.js";

export async function callChatModel(messages) {
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
