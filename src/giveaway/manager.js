import crypto from "crypto";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { createGiveaway, getGiveaway, updateGiveaway, getActiveGiveaways, addEntry } from "../core/giveawayStore.js";

let discordClient = null;

/** Gọi 1 lần lúc bot khởi động — cũng tự resume các giveaway đang chạy dở. */
export function initGiveawayManager(client) {
  discordClient = client;
  resumeScheduledGiveaways();
}

function buildGiveawayEmbed(giveaway) {
  const ended = giveaway.ended;

  return new EmbedBuilder()
    .setColor(ended ? 0x888888 : 0x57f287)
    .setTitle(ended ? "🎉 GIVEAWAY ĐÃ KẾT THÚC 🎉" : "🎉 GIVEAWAY 🎉")
    .setDescription(
      `**Phần thưởng:** ${giveaway.prize}\n` +
        `**Số người thắng:** ${giveaway.winnerCount}\n` +
        (ended
          ? `**Người thắng:** ${
              giveaway.winners?.length ? giveaway.winners.map(id => `<@${id}>`).join(", ") : "Không có ai tham gia 😢"
            }`
          : `**Kết thúc:** <t:${Math.floor(giveaway.endsAt / 1000)}:R>\n**Số người tham gia:** ${giveaway.entries.length}`)
    )
    .setFooter({ text: `ID: ${giveaway.id} • Tổ chức bởi ${giveaway.hostName}` })
    .setTimestamp(ended ? giveaway.endedAt : giveaway.endsAt);
}

function buildJoinRow(giveawayId, disabled = false) {
  const button = new ButtonBuilder()
    .setCustomId(`giveaway_join_${giveawayId}`)
    .setLabel("🎉 Tham gia")
    .setStyle(ButtonStyle.Success)
    .setDisabled(disabled);
  return new ActionRowBuilder().addComponents(button);
}

/**
 * @param {object} params
 * @param {import("discord.js").TextBasedChannel} params.channel
 * @param {string} params.prize
 * @param {number} params.durationMs
 * @param {number} params.winnerCount
 * @param {string} params.hostId
 * @param {string} params.hostName
 */
export async function createGiveawayFlow({ channel, prize, durationMs, winnerCount, hostId, hostName }) {
  const id = crypto.randomUUID().slice(0, 8);
  const endsAt = Date.now() + durationMs;

  const giveaway = {
    id,
    prize,
    winnerCount,
    hostId,
    hostName,
    channelId: channel.id,
    guildId: channel.guildId,
    entries: [],
    winners: [],
    ended: false,
    createdAt: Date.now(),
    endsAt,
    endedAt: null,
    messageId: null
  };

  const message = await channel.send({ embeds: [buildGiveawayEmbed(giveaway)], components: [buildJoinRow(id)] });
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
    await message.edit({ embeds: [buildGiveawayEmbed(updated)], components: [buildJoinRow(id, true)] });

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
 * @param {string} userId
 * @returns {{ ok: boolean, reason?: "already"|"ended"|"not_found" }}
 */
export function handleJoin(giveawayId, userId) {
  const giveaway = getGiveaway(giveawayId);
  if (!giveaway) return { ok: false, reason: "not_found" };
  if (giveaway.ended) return { ok: false, reason: "ended" };
  if (giveaway.entries.includes(userId)) return { ok: false, reason: "already" };

  addEntry(giveawayId, userId);
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
