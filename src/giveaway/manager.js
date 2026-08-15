import crypto from "crypto";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { createGiveaway, getGiveaway, updateGiveaway, getActiveGiveaways, addEntry } from "../core/giveawayStore.js";
import { getDailyMessageCount } from "../core/dailyMessageStore.js";

let discordClient = null;

/** Gọi 1 lần lúc bot khởi động — cũng tự resume các giveaway đang chạy dở. */
export function initGiveawayManager(client) {
  discordClient = client;
  resumeScheduledGiveaways();
}

function buildRequirementLines(giveaway) {
  const lines = [];
  if (giveaway.requiredRoleId) lines.push(`Cần có role <@&${giveaway.requiredRoleId}>`);
  if (giveaway.requiredDailyMessages) lines.push(`Cần nhắn ít nhất **${giveaway.requiredDailyMessages}** tin hôm nay`);
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
  if (!giveaway || !giveaway.ended) return { ok: false, reason: "Giveaway này chưa kết thúc hoặc không tồn tại." };

  const winners = pickWinners(giveaway.entries, giveaway.winnerCount);
  const updated = updateGiveaway(id, { winners });

  if (discordClient) {
    try {
      const channel = await discordClient.channels.fetch(giveaway.channelId);
      const message = await channel.messages.fetch(giveaway.messageId);
      await message.edit({ embeds: [buildGiveawayEmbed(updated)] });

      if (winners.length) {
        await channel.send(`🔄 Reroll! Người thắng mới: ${winners.map(w => `<@${w}>`).join(", ")}`);
      } else {
        await channel.send("🔄 Reroll nhưng không có ai tham gia để chọn cả 😢");
      }
    } catch (err) {
      console.error("GIVEAWAY_REROLL_ERROR:", err.message || err);
    }
  }

  return { ok: true, giveaway: updated };
}

/**
 * @param {string} giveawayId
 * @param {import("discord.js").GuildMember} member
 * @returns {{ ok: boolean, reason?: "already"|"ended"|"not_found"|"missing_role"|"not_enough_messages", need?: number, have?: number }}
 */
export function handleJoin(giveawayId, member) {
  const giveaway = getGiveaway(giveawayId);
  if (!giveaway) return { ok: false, reason: "not_found" };
  if (giveaway.ended) return { ok: false, reason: "ended" };
  if (giveaway.entries.includes(member.id)) return { ok: false, reason: "already" };

  if (giveaway.requiredRoleId && !member.roles?.cache?.has(giveaway.requiredRoleId)) {
    return { ok: false, reason: "missing_role" };
  }

  if (giveaway.requiredDailyMessages) {
    const have = getDailyMessageCount(giveaway.guildId, member.id);
    if (have < giveaway.requiredDailyMessages) {
      return { ok: false, reason: "not_enough_messages", need: giveaway.requiredDailyMessages, have };
    }
  }

  addEntry(giveawayId, member.id);
  return { ok: true };
}

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
