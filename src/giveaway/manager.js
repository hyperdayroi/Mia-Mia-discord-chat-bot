import crypto from "crypto";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { createGiveaway, getGiveaway, updateGiveaway, getActiveGiveaways, addEntry } from "../core/giveawayStore.js";
import { getDailyMessageCount, getDailyMessageCountInChannel } from "../core/dailyMessageStore.js";

let discordClient = null;

/** Gọi 1 lần lúc bot khởi động — cũng tự resume các giveaway đang chạy dở. */
export function initGiveawayManager(client) {
  discordClient = client;
  resumeScheduledGiveaways();
}

function buildRequirementLines(giveaway) {
  const lines = [];
  if (giveaway.requiredRoleId) lines.push(`Cần có role <@&${giveaway.requiredRoleId}>`);
  if (giveaway.requiredDailyMessages) {
    const where = giveaway.requiredMessageChannelId ? `ở <#${giveaway.requiredMessageChannelId}>` : "";
    lines.push(`Cần nhắn ít nhất **${giveaway.requiredDailyMessages}** tin ${where} hôm nay`.replace(/\s+/g, " ").trim());
  }
  if (giveaway.noReqRoleId) lines.push(`*(role <@&${giveaway.noReqRoleId}> được miễn hết điều kiện trên)*`);
  return lines;
}

function buildGiveawayEmbed(giveaway) {
  const ended = giveaway.ended;
  const requirementLines = buildRequirementLines(giveaway);

  const embed = new EmbedBuilder()
    .setColor(ended ? 0x888888 : giveaway.color || 0x57f287)
    .setTitle(ended ? "🎉 GIVEAWAY ĐÃ KẾT THÚC 🎉" : "🎉 GIVEAWAY 🎉")
    .setDescription(
      `**Phần thưởng:** ${giveaway.prize}\n` +
        `**Tổ chức bởi:** <@${giveaway.hostId}>\n` +
        `**Số người thắng:** ${giveaway.winnerCount}\n` +
        (requirementLines.length ? `**Điều kiện:**\n${requirementLines.map(l => `- ${l}`).join("\n")}\n` : "") +
        (ended
          ? `**Người thắng:** ${
              giveaway.winners?.length ? giveaway.winners.map(id => `<@${id}>`).join(", ") : "Không có ai tham gia 😢"
            }`
          : `**Kết thúc:** <t:${Math.floor(giveaway.endsAt / 1000)}:R>\n**Số người tham gia:** ${giveaway.entries.length}`)
    )
    .setFooter({ text: `ID: ${giveaway.id}` })
    .setTimestamp(ended ? giveaway.endedAt : giveaway.endsAt);

  if (giveaway.thumbnail) embed.setThumbnail(giveaway.thumbnail);
  if (giveaway.image) embed.setImage(giveaway.image);

  return embed;
}

/** @param {object} giveaway */
export function buildParticipantsEmbed(giveaway) {
  const embed = new EmbedBuilder()
    .setColor(giveaway.color || 0x5865f2)
    .setTitle(`👥 Người tham gia — ${giveaway.prize}`)
    .setFooter({ text: `ID: ${giveaway.id} • Tổng: ${giveaway.entries.length} người` })
    .setTimestamp();

  if (!giveaway.entries.length) {
    embed.setDescription("Chưa có ai tham gia cả 😢");
    return embed;
  }

  // Discord giới hạn 1024 ký tự/field và tối đa 25 field — chia thành từng nhóm
  // ~20 người/field để không vượt giới hạn, và cắt bớt nếu quá nhiều người tham gia.
  const CHUNK_SIZE = 20;
  const MAX_FIELDS = 24; // chừa 1 slot cho field "và còn X người khác"
  const chunks = [];
  for (let i = 0; i < giveaway.entries.length; i += CHUNK_SIZE) {
    chunks.push(giveaway.entries.slice(i, i + CHUNK_SIZE));
  }

  const visibleChunks = chunks.slice(0, MAX_FIELDS);
  visibleChunks.forEach((chunk, idx) => {
    const start = idx * CHUNK_SIZE + 1;
    const end = start + chunk.length - 1;
    embed.addFields({ name: `${start}–${end}`, value: chunk.map(id => `<@${id}>`).join(", ") });
  });

  if (chunks.length > MAX_FIELDS) {
    const shown = MAX_FIELDS * CHUNK_SIZE;
    embed.addFields({ name: "...", value: `Và **${giveaway.entries.length - shown}** người khác nữa.` });
  }

  return embed;
}

// Parse emoji người dùng dán vào (unicode thường, hoặc dạng <:name:id> / <a:name:id> copy từ Discord)
// để dùng làm icon trên nút — hỗ trợ cả emoji server đã thêm sẵn vào bot.
function parseEmojiInput(input) {
  if (!input) return "🎉";
  const match = input.match(/^<a?:(\w+):(\d+)>$/);
  if (match) return { id: match[2], name: match[1] };
  return input;
}

function buildActionRow(giveaway, disabled = false) {
  const joinButton = new ButtonBuilder()
    .setCustomId(`giveaway_join_${giveaway.id}`)
    .setLabel("Tham gia")
    .setEmoji(parseEmojiInput(giveaway.emoji))
    .setStyle(giveaway.buttonStyle || ButtonStyle.Success)
    .setDisabled(disabled);

  const participantsButton = new ButtonBuilder()
    .setCustomId(`giveaway_participants_${giveaway.id}`)
    .setLabel("Người tham gia")
    .setEmoji("👥")
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder().addComponents(joinButton, participantsButton);
}

/**
 * @param {object} params
 * @param {import("discord.js").TextBasedChannel} params.channel
 * @param {string} params.prize
 * @param {number} params.durationMs
 * @param {number} params.winnerCount
 * @param {string} params.hostId
 * @param {string} [params.requiredRoleId]
 * @param {number} [params.requiredDailyMessages]
 * @param {string} [params.requiredMessageChannelId] - Chỉ đếm tin nhắn trong kênh này (không set = tính cả server)
 * @param {string} [params.noReqRoleId] - Role có role này được MIỄN mọi điều kiện ở trên
 * @param {string} [params.thumbnail] - URL ảnh nhỏ góc phải embed
 * @param {string} [params.image] - URL ảnh lớn cuối embed
 * @param {number} [params.color] - Màu embed dạng số hex (0xRRGGBB)
 * @param {string} [params.emoji] - Emoji cho nút tham gia
 */
export async function createGiveawayFlow({
  channel,
  prize,
  durationMs,
  winnerCount,
  hostId,
  requiredRoleId = null,
  requiredDailyMessages = null,
  requiredMessageChannelId = null,
  noReqRoleId = null,
  thumbnail = null,
  image = null,
  color = null,
  emoji = null
}) {
  const id = crypto.randomUUID().slice(0, 8);
  const endsAt = Date.now() + durationMs;

  const giveaway = {
    id,
    prize,
    winnerCount,
    hostId,
    channelId: channel.id,
    guildId: channel.guildId,
    requiredRoleId,
    requiredDailyMessages,
    requiredMessageChannelId,
    noReqRoleId,
    thumbnail,
    image,
    color,
    emoji,
    entries: [],
    winners: [],
    ended: false,
    createdAt: Date.now(),
    endsAt,
    endedAt: null,
    messageId: null
  };

  const message = await channel.send({ embeds: [buildGiveawayEmbed(giveaway)], components: [buildActionRow(giveaway)] });
  giveaway.messageId = message.id;
  createGiveaway(giveaway);

  scheduleEnd(id, durationMs);
  return giveaway;
}

function scheduleEnd(id, delayMs) {
  setTimeout(() => {
    endGiveaway(id).catch(err => console.error("GIVEAWAY_END_ERROR:", err.message || err));
  }, Math.max(delayMs, 0));
}

/** @param {string} id */
export async function endGiveaway(id, { silent = false } = {}) {
  const giveaway = getGiveaway(id);
  if (!giveaway || giveaway.ended) return null;

  const winners = pickWinners(giveaway.entries, giveaway.winnerCount);
  const updated = updateGiveaway(id, { ended: true, winners, endedAt: Date.now() });

  if (!discordClient) return updated;

  try {
    const channel = await discordClient.channels.fetch(giveaway.channelId);
    const message = await channel.messages.fetch(giveaway.messageId);
    await message.edit({ embeds: [buildGiveawayEmbed(updated)], components: [buildActionRow(updated, true)] });

    if (!silent) {
      if (winners.length) {
        await channel.send(`🎉 Chúc mừng ${winners.map(w => `<@${w}>`).join(", ")} đã thắng **${giveaway.prize}**!`);
      } else {
        await channel.send(`😢 Giveaway **${giveaway.prize}** kết thúc nhưng không có ai tham gia.`);
      }
    }
  } catch (err) {
    console.error("GIVEAWAY_ANNOUNCE_ERROR:", err.message || err);
  }

  return updated;
}

/** @param {string} id */
export async function rerollGiveaway(id) {
  const giveaway = getGiveaway(id);
  if (!giveaway) return { ok: false, reason: "Không tìm thấy giveaway này." };
  if (!giveaway.ended) return { ok: false, reason: "Giveaway này chưa kết thúc, không reroll được." };
  if (!giveaway.entries.length) return { ok: false, reason: "Không có ai tham gia để reroll cả." };

  const winners = pickWinners(giveaway.entries, giveaway.winnerCount);
  const updated = updateGiveaway(id, { winners });

  if (!discordClient) return { ok: true, giveaway: updated, announced: false };

  try {
    const channel = await discordClient.channels.fetch(giveaway.channelId);
    const message = await channel.messages.fetch(giveaway.messageId);
    await message.edit({ embeds: [buildGiveawayEmbed(updated)] });
    await channel.send(`🔄 Reroll! Người thắng mới: ${winners.map(w => `<@${w}>`).join(", ")}`);
    return { ok: true, giveaway: updated, announced: true };
  } catch (err) {
    console.error("GIVEAWAY_REROLL_ERROR:", err.message || err);
    // Đã chọn được người thắng mới và lưu thành công, chỉ là không đăng thông báo lên
    // Discord được (VD tin nhắn gốc bị xoá) — vẫn báo ok:true nhưng announced:false để
    // command handler báo đúng tình trạng cho owner, không nói dối là mọi thứ suôn sẻ.
    return { ok: true, giveaway: updated, announced: false };
  }
}

/**
 * @param {string} giveawayId
 * @param {import("discord.js").GuildMember} member
 * @returns {{ ok: boolean, reason?: "already"|"ended"|"not_found"|"missing_role"|"not_enough_messages", need?: number, have?: number, channelId?: string }}
 */
export function handleJoin(giveawayId, member) {
  const giveaway = getGiveaway(giveawayId);
  if (!giveaway) return { ok: false, reason: "not_found" };
  if (giveaway.ended) return { ok: false, reason: "ended" };
  if (giveaway.entries.includes(member.id)) return { ok: false, reason: "already" };

  // Role "miễn req" — có role này thì bỏ qua HẾT mọi điều kiện bên dưới.
  const isExempt = giveaway.noReqRoleId && member.roles?.cache?.has(giveaway.noReqRoleId);

  if (!isExempt) {
    // Nếu có set required_role thì ƯU TIÊN kiểm tra role, BỎ QUA điều kiện tin nhắn
    // (2 điều kiện không cộng dồn — set role thì khỏi cần đủ tin nhắn nữa).
    if (giveaway.requiredRoleId) {
      if (!member.roles?.cache?.has(giveaway.requiredRoleId)) {
        return { ok: false, reason: "missing_role" };
      }
    } else if (giveaway.requiredDailyMessages) {
      const have = giveaway.requiredMessageChannelId
        ? getDailyMessageCountInChannel(giveaway.guildId, giveaway.requiredMessageChannelId, member.id)
        : getDailyMessageCount(giveaway.guildId, member.id);

      if (have < giveaway.requiredDailyMessages) {
        return {
          ok: false,
          reason: "not_enough_messages",
          need: giveaway.requiredDailyMessages,
          have,
          channelId: giveaway.requiredMessageChannelId || null
        };
      }
    }
  }

  addEntry(giveawayId, member.id);
  return { ok: true };
}

// Chọn ngẫu nhiên `count` người thắng từ danh sách entries, KHÔNG trùng lặp.
// Thuật toán: mỗi lượt chọn 1 phần tử ngẫu nhiên đều trong pool còn lại rồi loại nó ra
// (partial Fisher-Yates) — đảm bảo MỌI người trong entries có xác suất trúng bằng nhau,
// dùng chung cho cả lúc kết thúc giveaway lẫn lúc /giveaway reroll.
function pickWinners(entries, count) {
  const pool = [...entries];
  const winners = [];
  while (winners.length < count && pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(idx, 1)[0]);
  }
  return winners;
}

// Khi bot restart giữa chừng 1 giveaway đang chạy — resume lịch kết thúc đúng giờ,
// hoặc kết thúc ngay (không thông báo lại từ đầu) nếu đã quá hạn trong lúc bot offline.
function resumeScheduledGiveaways() {
  for (const giveaway of getActiveGiveaways()) {
    const remaining = giveaway.endsAt - Date.now();
    if (remaining <= 0) {
      endGiveaway(giveaway.id).catch(err => console.error("GIVEAWAY_RESUME_ERROR:", err.message || err));
    } else {
      scheduleEnd(giveaway.id, remaining);
    }
  }
}
