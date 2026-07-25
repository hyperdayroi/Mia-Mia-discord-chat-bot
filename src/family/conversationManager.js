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
export function getDiscordClient() {
  return discordClient;
}

// Xưng hô đúng vai vế chị-em khi 2 bot nói chuyện với NHAU (không dùng "tớ"/"cậu"
// như lúc nói chuyện với người dùng thường).
const SELF_PRONOUN = persona.sibling.relationToSibling === "em gái" ? "chị" : "em";
const SIBLING_PRONOUN = persona.sibling.relationToSibling === "em gái" ? "em" : "chị";
const SIBLING_ADDRESS_RULE = `Đây là cuộc nói chuyện RIÊNG với ${persona.sibling.displayName} (${persona.sibling.relationToSibling} của bạn) — xưng "${SELF_PRONOUN}", gọi ${persona.sibling.displayName} là "${SIBLING_PRONOUN}". Tuyệt đối không xưng "tớ"/gọi "cậu" trong cuộc nói chuyện này.`;

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

function randomBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

export async function postToChannel(channelId, text) {
  if (!channelId || !discordClient) return false;
  try {
    const channel = await discordClient.channels.fetch(channelId);
    if (channel?.isTextBased()) {
      await channel.send(text);
      return true;
    }
    return false;
  } catch (err) {
    console.error("FAMILY_CHAT_POST_ERROR:", err.message || err);
    return false;
  }
}

export async function postToFamilyChannel(text) {
  if (FAMILY_CHAT_MODE !== "public") return false;
  return postToChannel(FAMILY_CHAT_CHANNEL_ID, text);
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
  // Lưu ý: KHÔNG được để messages chỉ toàn role "system" — nhiều upstream (kể cả model
  // đang dùng) sẽ từ chối request kiểu đó (lỗi "Yêu cầu đã bị upstream từ chối").
  // Vì vậy instruction (chỉ dẫn nội bộ) phải là "user" và luôn đứng cuối cùng.
  const messages = [
    { role: "system", content: persona.systemPrompt(null, null) },
    { role: "system", content: getFamilyContextMessage() },
    ...getHistory(conversationId),
    { role: "user", content: instruction }
  ];
  const raw = await callChatModel(messages);
  return stripThink(raw || "").trim();
}

async function callPeer(body) {
  if (!PEER_INTERNAL_URL || !INTERNAL_SECRET) {
    throw new Error("Chưa cấu hình PEER_INTERNAL_URL / INTERNAL_SECRET");
  }

  let targetUrl;
  try {
    targetUrl = new URL("/internal/chat", PEER_INTERNAL_URL).toString();
  } catch {
    throw new Error(
      `PEER_INTERNAL_URL không hợp lệ: "${PEER_INTERNAL_URL}". Phải là URL đầy đủ dạng https://xxx.up.railway.app`
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INTERNAL_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(targetUrl, {
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
      const err = new Error(`Peer trả lỗi ${res.status}: ${JSON.stringify(data)}`);
      err.status = res.status;
      throw err;
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

// Phần lõi thực sự chạy 1 cuộc hội thoại — dùng chung cho cả scheduler tự động
// VÀ lệnh owner-only kích hoạt thủ công (?call<sibling>).
async function runConversation() {
  const conversationId = crypto.randomUUID();
  claimActiveConversation(conversationId);

  let turn = 1;
  let opening;
  try {
    opening = await generateLine(
      conversationId,
      `Nhiệm vụ: hãy tự nhiên bắt đầu một câu chuyện ngắn, đời thường với ${persona.sibling.displayName} (${persona.sibling.relationToSibling}). Chỉ 1-2 câu, giọng điệu tự nhiên như nhắn tin thật. ${SIBLING_ADDRESS_RULE}`
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

  // Gọi sang bot kia TRƯỚC — chỉ đăng lên Discord nếu chắc chắn bên kia nhận được,
  // tránh trường hợp tự đăng 1 câu "độc thoại" rồi mới phát hiện không gọi được peer.
  // Nếu 2 bot cùng khởi tạo cuộc hội thoại gần như đồng thời, bên kia có thể trả về
  // 429 "đang bận" (do chính nó cũng đang tự khởi tạo). Trường hợp này thử lại 1 lần
  // sau một khoảng chờ ngẫu nhiên ngắn, thay vì bỏ cuộc luôn tới tận interval sau.
  let peerData;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      peerData = await callPeer({
        from: persona.key,
        to: persona.sibling.key,
        conversationId,
        turn,
        message: opening,
        ended: turn >= MAX_CONVERSATION_TURNS
      });
      break;
    } catch (err) {
      const isBusyConflict = err.status === 429;
      if (isBusyConflict && attempt === 1) {
        console.warn("FAMILY_CHAT_BUSY_CONFLICT: 2 bot cùng khởi tạo hội thoại, thử lại sau ít giây...");
        await sleep(randomBetween(3000, 8000));
        continue;
      }
      console.error("FAMILY_CHAT_PEER_UNREACHABLE:", err.message || err);
      endConversation(conversationId);
      return;
    }
  }

  pushHistory(conversationId, "assistant", opening);
  await postToFamilyChannel(opening);
  addFamilyEvent(`${persona.displayName} nói với ${persona.sibling.displayName}: ${opening}`);

  if (!peerData?.reply) {
    endConversation(conversationId);
    return;
  }

  pushHistory(conversationId, "user", peerData.reply);
  turn += 1;

  let currentMessage = opening;

  while (turn <= MAX_CONVERSATION_TURNS) {
    if (peerData.ended || turn > MAX_CONVERSATION_TURNS) break;

    await sleep(FAMILY_TURN_DELAY_MS);

    let nextLine;
    try {
      nextLine = await generateLine(
        conversationId,
        `Đây là đoạn hội thoại đang diễn ra với ${persona.sibling.displayName}. Hãy trả lời tự nhiên, ngắn gọn (1-2 câu), như một cuộc chat đời thường giữa hai chị em. ${SIBLING_ADDRESS_RULE}`
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
  }
}

// ===== INITIATOR SIDE: bot này chủ động bắt đầu 1 cuộc trò chuyện (tự động theo lịch) =====
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

    await runConversation();
  } catch (err) {
    // Bất kỳ lỗi không lường trước nào cũng không được làm crash Discord bot.
    console.error("FAMILY_CHAT_UNEXPECTED_ERROR:", err);
  } finally {
    if (activeConversationId) endConversation(activeConversationId);
  }
}

// ===== Kích hoạt thủ công (lệnh owner-only ?call<sibling>) =====
// Bỏ qua AUTO_CHAT_ENABLED và cooldown (vì đây là owner chủ động yêu cầu),
// nhưng vẫn tôn trọng khoá "1 cuộc hội thoại tại 1 thời điểm" để tránh chồng chéo.
// Trả về { ok: true } nếu bắt đầu được, hoặc { ok: false, reason } nếu không.
export async function triggerConversationNow() {
  if (!PEER_INTERNAL_URL || !INTERNAL_SECRET) {
    return { ok: false, reason: "Chưa cấu hình PEER_INTERNAL_URL / INTERNAL_SECRET." };
  }

  if (activeConversationId) {
    if (!isActiveConversationStale()) {
      return { ok: false, reason: "Đang có 1 cuộc hội thoại khác diễn ra rồi, đợi chút nha." };
    }
    console.warn(`FAMILY_CHAT_STALE_RESET: giải phóng conversation "${activeConversationId}" bị treo quá lâu.`);
    endConversation(activeConversationId);
  }

  // Chạy nền (fire-and-forget) để lệnh Discord phản hồi ngay, không phải đợi cả cuộc hội thoại.
  (async () => {
    try {
      await runConversation();
    } catch (err) {
      console.error("FAMILY_CHAT_MANUAL_TRIGGER_ERROR:", err);
    } finally {
      if (activeConversationId) endConversation(activeConversationId);
    }
  })();

  return { ok: true };
}

export function scheduleAutonomousConversation(intervalMs) {
  if (!AUTO_CHAT_ENABLED) return;

  // Dùng setTimeout tự lặp lại (thay vì setInterval cố định) và cộng thêm 1 khoảng
  // ngẫu nhiên (~±15% intervalMs) mỗi lần — để lịch của Mia và Mie dần lệch nhau,
  // tránh việc 2 bot cứ liên tục khởi tạo cuộc hội thoại đúng cùng một thời điểm.
  function tick() {
    const jitter = randomBetween(-Math.floor(intervalMs * 0.15), Math.floor(intervalMs * 0.15));
    const delay = Math.max(intervalMs + jitter, 5000);
    setTimeout(async () => {
      try {
        await startAutonomousConversation();
      } catch (err) {
        console.error("FAMILY_CHAT_SCHEDULE_ERROR:", err);
      }
      tick();
    }, delay);
  }

  tick();
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
      `Đây là đoạn hội thoại đang diễn ra với ${persona.sibling.displayName}. Hãy trả lời tự nhiên, ngắn gọn (1-2 câu), như một cuộc chat đời thường giữa hai chị em. ${SIBLING_ADDRESS_RULE}`
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
