import persona from "../personas/index.js";
import {
  getMemory,
  pushMemoryEntry,
  saveMemory
} from "../core/memory.js";
import { callChatModel } from "../core/aiClient.js";
import { stripThink } from "../core/text.js";
import { getFamilyContextMessage } from "../family/context.js";
import { captureUtterance } from "./audioCapture.js";
import { transcribeAudio } from "./speechToText.js";
import { synthesizeSpeech } from "./textToSpeech.js";
import { playAudioBuffer } from "./player.js";

const activeSessions = new Map();

// Chỉ đưa vài message gần nhất vào voice.
// Voice không cần toàn bộ text-chat history.
const VOICE_HISTORY_LIMIT = 6;

const VOICE_INSTRUCTION = [
  "Đây là voice chat.",
  "Trả lời bằng tiếng Việt, tự nhiên như đang nói chuyện.",
  "Chỉ trả lời 1-2 câu ngắn.",
  "Không markdown, không bullet, không code.",
  "Không nhắc rằng bạn là AI.",
  "Không giải thích dài dòng."
].join(" ");

export function isListening(guildId) {
  return Boolean(
    activeSessions.get(guildId)?.active
  );
}

export function startListening(
  connection,
  guild,
  userId
) {
  if (
    activeSessions.get(guild.id)?.active
  ) {
    return false;
  }

  const session = {
    active: true
  };

  activeSessions.set(
    guild.id,
    session
  );

  runListenLoop(
    connection,
    guild,
    userId,
    session
  ).catch(err => {
    console.error(
      "VOICE_SESSION_ERROR:",
      err.message || err
    );

    session.active = false;
    activeSessions.delete(guild.id);
  });

  return true;
}

export function stopListening(guildId) {
  const session =
    activeSessions.get(guildId);

  if (!session) {
    return false;
  }

  session.active = false;
  activeSessions.delete(guildId);

  return true;
}

async function runListenLoop(
  connection,
  guild,
  userId,
  session
) {
  while (session.active) {
    try {
      // 800ms silence thay vì 1200ms.
      const wavBuffer =
        await captureUtterance(
          connection,
          userId,
          {
            silenceMs: 800,
            maxMs: 15000
          }
        );

      if (!session.active) break;
      if (!wavBuffer) continue;

      const turnStarted = Date.now();

      // STT
      const transcript =
        await transcribeAudio(
          wavBuffer
        );

      if (!session.active) break;
      if (!transcript) continue;

      console.log(
        `VOICE_TRANSCRIPT: ${transcript}`
      );

      // Lấy history trước khi thêm message mới,
      // rồi chỉ gửi một phần nhỏ cho model.
      const fullChat =
        getMemory(userId) || [];

      const chat =
        fullChat.slice(
          -VOICE_HISTORY_LIMIT
        );

      pushMemoryEntry(
        userId,
        {
          role: "user",
          content: transcript
        }
      );

      // Chat model: context nhỏ + instruction voice ngắn.
      const reply =
        await callChatModel([
          {
            role: "system",
            content:
              persona.systemPrompt(
                userId,
                guild
              )
          },
          {
            role: "system",
            content:
              getFamilyContextMessage()
          },
          {
            role: "system",
            content:
              VOICE_INSTRUCTION
          },
          ...chat
        ]);

      if (!session.active) break;

      const finalReply =
        stripThink(
          reply || ""
        ).trim();

      if (!finalReply) continue;

      console.log(
        `VOICE_REPLY: ${finalReply}`
      );

      pushMemoryEntry(
        userId,
        {
          role: "assistant",
          content: finalReply
        }
      );

      // Lưu memory sau khi xử lý xong lượt,
      // không chặn trước khi AI/TTS bắt đầu.
      saveMemory();

      // TTS
      const ttsAudio =
        await synthesizeSpeech(
          finalReply
        );

      if (!session.active) break;

      // Playback
      await playAudioBuffer(
        connection,
        ttsAudio
      );

      console.log(
        `VOICE_TURN_TOTAL: ${
          Date.now() - turnStarted
        }ms`
      );

    } catch (err) {
      console.error(
        "VOICE_TURN_ERROR:",
        err.message || err
      );

      // Lỗi một lượt không làm chết session.
      // Nghỉ rất ngắn để tránh loop lỗi ăn CPU.
      await new Promise(
        resolve =>
          setTimeout(resolve, 150)
      );
    }
  }
}
