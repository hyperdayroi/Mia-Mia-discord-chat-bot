import persona from "../personas/index.js";
import { getMemory, pushMemoryEntry, saveMemory } from "../core/memory.js";
import { callChatModel } from "../core/aiClient.js";
import { stripThink } from "../core/text.js";
import { getFamilyContextMessage } from "../family/context.js";
import { captureUtterance } from "./audioCapture.js";
import { transcribeAudio } from "./speechToText.js";
import { synthesizeSpeech } from "./textToSpeech.js";
import { playAudioBuffer } from "./player.js";

// 1 phiên "đang nghe" cho mỗi server — chỉ nghe 1 người/lúc trong 1 server.
const activeSessions = new Map(); // guildId -> { active: boolean }

/** @param {string} guildId */
export function isListening(guildId) {
  return Boolean(activeSessions.get(guildId)?.active);
}

/**
 * Bắt đầu vòng lặp nghe liên tục 1 user trong voice channel, tới khi stopListening().
 * @param {import("@discordjs/voice").VoiceConnection} connection
 * @param {import("discord.js").Guild} guild
 * @param {string} userId
 */
export function startListening(connection, guild, userId) {
  if (activeSessions.get(guild.id)?.active) return false;

  const session = { active: true };
  activeSessions.set(guild.id, session);

  runListenLoop(connection, guild, userId, session).catch(err => {
    console.error("VOICE_SESSION_ERROR:", err.message || err);
    session.active = false;
  });

  return true;
}

/** @param {string} guildId */
export function stopListening(guildId) {
  const session = activeSessions.get(guildId);
  if (!session) return false;
  session.active = false;
  activeSessions.delete(guildId);
  return true;
}

async function runListenLoop(connection, guild, userId, session) {
  while (session.active) {
    let wavBuffer;
    try {
      wavBuffer = await captureUtterance(connection, userId);
    } catch (err) {
      console.error("VOICE_CAPTURE_ERROR:", err.message || err);
      continue;
    }

    if (!session.active) break;
    if (!wavBuffer) continue; // im lặng cả lượt, không có gì để xử lý -> nghe tiếp

    try {
      const transcript = await transcribeAudio(wavBuffer);
      if (!transcript) continue;

      const chat = getMemory(userId);
      pushMemoryEntry(userId, { role: "user", content: transcript });

      const reply = await callChatModel([
        { role: "system", content: persona.systemPrompt(userId, guild) },
        { role: "system", content: getFamilyContextMessage() },
        {
          role: "system",
          content: "Đây là đoạn hội thoại BẰNG GIỌNG NÓI (voice chat), không phải chat chữ — trả lời ngắn gọn, tự nhiên như đang nói chuyện thật, tránh liệt kê dài dòng hay markdown."
        },
        ...chat
      ]);

      const finalReply = stripThink(reply || "").trim();
      if (!finalReply) continue;

      pushMemoryEntry(userId, { role: "assistant", content: finalReply });
      saveMemory();

      const ttsAudio = await synthesizeSpeech(finalReply);
      if (session.active) {
        await playAudioBuffer(connection, ttsAudio);
      }
    } catch (err) {
      console.error("VOICE_TURN_ERROR:", err.message || err);
      // Lỗi 1 lượt không được làm chết cả phiên nghe — tiếp tục vòng lặp.
    }
  }
}
