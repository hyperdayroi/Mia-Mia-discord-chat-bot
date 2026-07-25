import persona from "../personas/index.js";
import { callChatModel } from "../core/aiClient.js";
import { stripThink } from "../core/text.js";
import { getFamilyContextMessage, addFamilyEvent } from "./context.js";
import { getDiscordClient, postToChannel, postToFamilyChannel } from "./conversationManager.js";
import { getAllHomeChannels } from "../core/channelConfig.js";
import { OWNER_ID, TATTLE_ENABLED, TATTLE_CHECK_INTERVAL_MS, TATTLE_CHANCE } from "../config/env.js";

function randomBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

async function generateTattle() {
  const messages = [
    { role: "system", content: persona.systemPrompt(OWNER_ID, null) },
    { role: "system", content: getFamilyContextMessage() },
    {
      role: "user",
      content: `Nhiệm vụ: mách nhỏ cho bố Hyper nghe 1 chuyện bé xíu, tự nghĩ ra một cách hợp lý và dễ thương về việc ${persona.sibling.displayName} (${persona.sibling.relationToSibling}) vừa làm — kiểu trêu chọc nhẹ nhàng, không ác ý, như đang mách bố ngay trong lúc cả nhà đang chat chung. Chỉ 1-2 câu.`
    }
  ];
  const raw = await callChatModel(messages);
  return stripThink(raw || "").trim();
}

async function sendTattle() {
  try {
    const text = await generateTattle();
    if (!text) return;

    // Ping thật (@mention) khi đăng vào kênh công khai — DM thì không cần vì đã là
    // thông báo riêng trực tiếp cho bố rồi.
    const channelMessage = `<@${OWNER_ID}> ${text}`;

    // Ưu tiên đăng vào kênh chính đã set (/setchannel) -> fallback kênh family-chat chung
    // -> fallback cuối cùng là DM riêng cho bố nếu chưa cấu hình kênh nào cả.
    const channels = getAllHomeChannels();
    let posted = false;

    if (channels.length) {
      const results = await Promise.all(channels.map(channelId => postToChannel(channelId, channelMessage)));
      posted = results.some(Boolean);
    }

    if (!posted) {
      posted = await postToFamilyChannel(channelMessage);
    }

    if (!posted) {
      const client = getDiscordClient();
      if (client) {
        const owner = await client.users.fetch(OWNER_ID);
        await owner.send(text);
        posted = true;
      }
    }

    if (posted) {
      addFamilyEvent(`${persona.displayName} mách bố về ${persona.sibling.displayName}: ${text}`);
    }
  } catch (err) {
    // Owner có thể tắt DM, hoặc lỗi mạng/API — không sao, bỏ qua êm, không crash bot.
    console.error("FAMILY_TATTLE_ERROR:", err.message || err);
  }
}

export function scheduleTattle() {
  if (!TATTLE_ENABLED) return;

  function tick() {
    const jitter = randomBetween(-Math.floor(TATTLE_CHECK_INTERVAL_MS * 0.2), Math.floor(TATTLE_CHECK_INTERVAL_MS * 0.2));
    const delay = Math.max(TATTLE_CHECK_INTERVAL_MS + jitter, 60000);

    setTimeout(async () => {
      try {
        if (Math.random() < TATTLE_CHANCE) {
          await sendTattle();
        }
      } catch (err) {
        console.error("FAMILY_TATTLE_SCHEDULE_ERROR:", err);
      }
      tick();
    }, delay);
  }

  tick();
}
