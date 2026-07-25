import persona from "../personas/index.js";
import { callChatModel } from "../core/aiClient.js";
import { stripThink } from "../core/text.js";
import { getFamilyContextMessage, addFamilyEvent } from "./context.js";
import { postToChannel, postToFamilyChannel } from "./conversationManager.js";
import { getAllHomeChannels } from "../core/channelConfig.js";
import {
  OWNER_ID,
  GOOD_MORNING_ENABLED,
  GOOD_MORNING_HOUR,
  GOOD_MORNING_MINUTE,
  GOOD_NIGHT_ENABLED,
  GOOD_NIGHT_HOUR,
  GOOD_NIGHT_MINUTE,
  FAMILY_TIMEZONE
} from "../config/env.js";

// Không cần "random" thật (2 process riêng biệt không thể random rồi khớp nhau được) —
// thay vào đó chọn xen kẽ mỗi ngày dựa trên số ngày kể từ epoch, tính độc lập ở cả 2
// service nhưng luôn ra CÙNG một kết quả, để không bị cả 2 cùng gửi hoặc không ai gửi.
function pickTodaySender() {
  const dayIndex = Math.floor(Date.now() / 86400000);
  return dayIndex % 2 === 0 ? "mia" : "mie";
}

function getTimeInTimezone() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FAMILY_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const hour = Number(parts.find(p => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find(p => p.type === "minute")?.value ?? "0");
  const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: FAMILY_TIMEZONE }).format(new Date()); // YYYY-MM-DD
  return { hour, minute, dateKey };
}

async function generateGreeting(kind) {
  const task =
    kind === "morning"
      ? "Nhiệm vụ: gửi lời chào buổi sáng ngắn gọn, dễ thương cho cả nhà (bố Hyper và mọi người trong channel). Chỉ 1-2 câu."
      : "Nhiệm vụ: gửi lời chúc ngủ ngon ngắn gọn, dễ thương cho cả nhà (bố Hyper và mọi người trong channel). Chỉ 1-2 câu.";

  const messages = [
    { role: "system", content: persona.systemPrompt(OWNER_ID, null) },
    { role: "system", content: getFamilyContextMessage() },
    { role: "user", content: task }
  ];

  const raw = await callChatModel(messages);
  return stripThink(raw || "").trim();
}

async function sendGreeting(kind) {
  try {
    const text = await generateGreeting(kind);
    if (!text) return;

    // Ping thật (@mention) chứ không chỉ nói "bố ơi" bằng chữ.
    const message = `<@${OWNER_ID}> ${text}`;

    const channels = getAllHomeChannels();
    if (channels.length) {
      await Promise.all(channels.map(channelId => postToChannel(channelId, message)));
    } else {
      // Chưa server nào dùng /setchannel -> fallback về kênh family-chat chung (nếu có).
      await postToFamilyChannel(message);
    }

    addFamilyEvent(`${persona.displayName} gửi lời chào ${kind === "morning" ? "buổi sáng" : "ngủ ngon"}: ${text}`);
  } catch (err) {
    console.error("FAMILY_GREETING_ERROR:", err.message || err);
  }
}

export function scheduleGreetings() {
  if (!GOOD_MORNING_ENABLED && !GOOD_NIGHT_ENABLED) return;

  let lastMorningDate = null;
  let lastNightDate = null;

  setInterval(() => {
    try {
      const { hour, minute, dateKey } = getTimeInTimezone();
      const isTodaysSender = pickTodaySender() === persona.key;

      if (
        GOOD_MORNING_ENABLED &&
        isTodaysSender &&
        hour === GOOD_MORNING_HOUR &&
        minute === GOOD_MORNING_MINUTE &&
        lastMorningDate !== dateKey
      ) {
        lastMorningDate = dateKey;
        sendGreeting("morning");
      }

      if (
        GOOD_NIGHT_ENABLED &&
        isTodaysSender &&
        hour === GOOD_NIGHT_HOUR &&
        minute === GOOD_NIGHT_MINUTE &&
        lastNightDate !== dateKey
      ) {
        lastNightDate = dateKey;
        sendGreeting("night");
      }
    } catch (err) {
      // Không bao giờ để lỗi ở đây làm crash bot chính.
      console.error("FAMILY_GREETING_SCHEDULE_ERROR:", err);
    }
  }, 60000); // check mỗi phút
}
