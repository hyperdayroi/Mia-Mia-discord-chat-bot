import fetch from "node-fetch";
import crypto from "crypto";
import persona from "../personas/index.js";
import { callChatModel } from "../core/aiClient.js";
import { stripThink } from "../core/text.js";
import { getFamilyContextMessage, addFamilyEvent } from "./context.js";
import {
  PEER_INTERNAL_URL,
  INTERNAL_SECRET,
  INTERNAL_REQUEST_TIMEOUT_MS,
  AUTO_CHAT_ENABLED,
  MAX_CONVERSATION_TURNS,
  FAMILY_CHAT_CHANNEL_ID,
  FAMILY_CHAT_MODE,
  FAMILY_CHAT_COOLDOWN_MS,
  FAMILY_TURN_DELAY_MS
} from "../config/env.js";

let discordClient = null;
export function initConversationManager(client) {
  discordClient = client;
}

// ===== state (in-memory, per service) =====
let activeConversationId = null; // chỉ 1 cuộc hội thoại tại 1 thời điểm
let activeConversationStartedAt = 0;
let lastConversationEndedAt = 0;
const localHistory = new Map(); // conversationId -> [{role, content}]
const lastProcessedTurn = new Map(); // conversationId -> turn số cuối đã xử lý (chống duplicate/loop)

// Nếu vì lý do gì đó (bên kia crash, mất mạng giữa chừng...) một cuộc hội thoại
// không bao giờ được đánh dấu "ended" thì activeConversationId có thể bị "kẹt" mãi mãi,
// chặn luôn mọi cuộc hội thoại sau này. Coi một cuộc hội thoại là "hết hạn" nếu quá lâu
// không có hoạt động, để tự giải phóng thay vì phải restart service.
const CONVERSATION_STALE_MS = Math.max(INTERNAL_REQUEST_TIMEOUT_MS * 4, 120000);

function isActiveConversationStale() {
  return Boolean(activeConversationId) && Date.now() - activeConversationStartedAt > CONVERSATION_STALE_MS;
}

function claimActiveConversation(conversationId) {
  activeConversationId = conversationId;
  activeConversationStartedAt = Date.now();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function postToFamilyChannel(text) {
  if (FAMILY_CHAT_MODE !== "public" || !discordClient) return;
  try {
    const channel = await discordClient.channels.fetch(FAMILY_CHAT_CHANNEL_ID);
    if (channel?.isTextBased()) {
      await channel.send(text);
    }
  } catch (err) {
    console.error("FAMILY_CHAT_POST_ERROR:", err.message || err);
  }
}

function getHistory(conversationId) {
  if (!localHistory.has(conversationId)) localHistory.set(conversationId, []);
  return localHistory.get(conversationId);
}

function pushHistory(conversationId, role, content) {
  const hist = getHistory(conversationId);
  hist.push({ role, content });
  if (hist.length > 12) hist.shift();
}

async function generateLine(conversationId, instruction) {
  const messages = [
    { role: "system", content: persona.systemPrompt(null, null) },
    { role: "system", content: getFamilyContextMessage() },
    { role: "system", content: instruction },
    ...getHistory(conversationId)
  ];
  const raw = await callChatModel(messages);
  return stripThink(raw || "").trim();
}

async function callPeer(body) {
  if (!PEER_INTERNAL_URL || !INTERNAL_SECRET) {
    throw new Error("Chưa cấu hình PEER_INTERNAL_URL / INTERNAL_SECRET");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INTERNAL_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${PEER_INTERNAL_URL.replace(/\/$/, "")}/internal/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Peer trả lỗi ${res.status}: ${JSON.stringify(data)}`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function endConversation(conversationId) {
  if (activeConversationId === conversationId) {
    activeConversationId = null;
    lastConversationEndedAt = Date.now();
  }
  localHistory.delete(conversationId);
  lastProcessedTurn.delete(conversationId);
}

// ===== INITIATOR SIDE: bot này chủ động bắt đầu 1 cuộc trò chuyện =====
export async function startAutonomousConversation() {
  try {
    if (!AUTO_CHAT_ENABLED) return;
    if (!PEER_INTERNAL_URL || !INTERNAL_SECRET) return; // chưa cấu hình -> bỏ qua an toàn

    if (activeConversationId) {
      if (!isActiveConversationStale()) return; // đang có cuộc hội thoại khác chạy -> tránh chồng
      console.warn(`FAMILY_CHAT_STALE_RESET: giải phóng conversation "${activeConversationId}" bị treo quá lâu.`);
      endConversation(activeConversationId);
    }
    if (Date.now() - lastConversationEndedAt < FAMILY_CHAT_COOLDOWN_MS) return;

    const conversationId = crypto.randomUUID();
    claimActiveConversation(conversationId);

    let turn = 1;
    let opening;
    try {
      opening = await generateLine(
        conversationId,
        `Nhiệm vụ: hãy tự nhiên bắt đầu một câu chuyện ngắn, đời thường với ${persona.sibling.displayName} (${persona.sibling.relationToSibling}). Chỉ 1-2 câu, giọng điệu tự nhiên như nhắn tin thật.`
      );
    } catch (err) {
      console.error("FAMILY_CHAT_OPENING_ERROR:", err.message || err);
      endConversation(conversationId);
      return;
    }
    if (!opening) {
      endConversation(conversationId);
      return;
    }

    pushHistory(conversationId, "assistant", opening);
    await postToFamilyChannel(opening);
    addFamilyEvent(`${persona.displayName} nói với ${persona.sibling.displayName}: ${opening}`);

    let currentMessage = opening;

    while (turn <= MAX_CONVERSATION_TURNS) {
      let peerData;
      try {
        peerData = await callPeer({
          from: persona.key,
          to: persona.sibling.key,
          conversationId,
          turn,
          message: currentMessage,
          ended: turn >= MAX_CONVERSATION_TURNS
        });
      } catch (err) {
        console.error("FAMILY_CHAT_PEER_UNREACHABLE:", err.message || err);
        break; // bên kia offline/lỗi -> dừng êm, không crash bot
      }

      if (!peerData?.reply) break;

      pushHistory(conversationId, "user", peerData.reply);
      turn += 1;

      if (peerData.ended || turn > MAX_CONVERSATION_TURNS) break;

      await sleep(FAMILY_TURN_DELAY_MS);

      let nextLine;
      try {
        nextLine = await generateLine(
          conversationId,
          `Đây là đoạn hội thoại đang diễn ra với ${persona.sibling.displayName}. Hãy trả lời tự nhiên, ngắn gọn (1-2 câu), như một cuộc chat đời thường giữa hai chị em.`
        );
      } catch (err) {
        console.error("FAMILY_CHAT_REPLY_ERROR:", err.message || err);
        break;
      }
      if (!nextLine) break;

      pushHistory(conversationId, "assistant", nextLine);
      await postToFamilyChannel(nextLine);
      addFamilyEvent(`${persona.displayName} nói với ${persona.sibling.displayName}: ${nextLine}`);

      currentMessage = nextLine;
      turn += 1;
      await sleep(FAMILY_TURN_DELAY_MS);
    }
  } catch (err) {
    // Bất kỳ lỗi không lường trước nào cũng không được làm crash Discord bot.
    console.error("FAMILY_CHAT_UNEXPECTED_ERROR:", err);
  } finally {
    if (activeConversationId) endConversation(activeConversationId);
  }
}

export function scheduleAutonomousConversation(intervalMs) {
  if (!AUTO_CHAT_ENABLED) return;
  setInterval(() => {
    startAutonomousConversation().catch(err =>
      console.error("FAMILY_CHAT_SCHEDULE_ERROR:", err)
    );
  }, intervalMs);
}

// ===== RECEIVER SIDE: xử lý message tới từ bot kia (đi qua HTTP server) =====
export async function handleIncomingChat({ from, to, conversationId, turn, message, ended }) {
  if (to !== persona.key) {
    const err = new Error("Sai persona đích");
    err.status = 400;
    throw err;
  }
  if (from !== persona.sibling.key) {
    const err = new Error("Không nhận diện được người gửi");
    err.status = 400;
    throw err;
  }
  if (!conversationId || typeof turn !== "number") {
    const err = new Error("Payload không hợp lệ");
    err.status = 400;
    throw err;
  }

  // Chống loop / message trùng lặp: nếu turn này đã xử lý rồi thì bỏ qua.
  const lastTurn = lastProcessedTurn.get(conversationId) ?? 0;
  if (turn <= lastTurn) {
    const err = new Error("Turn trùng lặp, đã xử lý trước đó");
    err.status = 409;
    throw err;
  }

  // Nếu đang bận với 1 cuộc hội thoại khác (turn === 1 nghĩa là cuộc hội thoại mới) -> báo bận,
  // trừ khi cuộc hội thoại cũ đó đã bị treo quá lâu (bên kia crash giữa chừng) thì tự giải phóng.
  if (turn === 1 && activeConversationId && activeConversationId !== conversationId) {
    if (!isActiveConversationStale()) {
      const err = new Error("Đang bận trò chuyện khác");
      err.status = 429;
      throw err;
    }
    console.warn(`FAMILY_CHAT_STALE_RESET: giải phóng conversation "${activeConversationId}" bị treo quá lâu.`);
    endConversation(activeConversationId);
  }

  claimActiveConversation(conversationId);
  lastProcessedTurn.set(conversationId, turn);

  pushHistory(conversationId, "user", message);

  let reply;
  try {
    reply = await generateLine(
      conversationId,
      `Đây là đoạn hội thoại đang diễn ra với ${persona.sibling.displayName}. Hãy trả lời tự nhiên, ngắn gọn (1-2 câu), như một cuộc chat đời thường giữa hai chị em.`
    );
  } catch (err) {
    console.error("FAMILY_CHAT_INCOMING_REPLY_ERROR:", err.message || err);
    endConversation(conversationId);
    const e = new Error("Lỗi tạo phản hồi AI");
    e.status = 500;
    throw e;
  }

  if (!reply) {
    endConversation(conversationId);
    const e = new Error("Không tạo được phản hồi");
    e.status = 500;
    throw e;
  }

  pushHistory(conversationId, "assistant", reply);
  await postToFamilyChannel(reply);
  addFamilyEvent(`${persona.displayName} nói với ${persona.sibling.displayName}: ${reply}`);

  const isEnded = Boolean(ended) || turn >= MAX_CONVERSATION_TURNS;
  if (isEnded) endConversation(conversationId);

  return { reply, turn, ended: isEnded };
}
