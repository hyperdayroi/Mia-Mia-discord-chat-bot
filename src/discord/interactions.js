import fs from "fs";
import {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
  PermissionFlagsBits
} from "discord.js";
import persona from "../personas/index.js";
import { OWNER_ID } from "../config/env.js";
import { getMemory, pushMemoryEntry, saveMemory, memoryUserCount } from "../core/memory.js";
import { getUsageStatus, consumeUsage } from "../core/usage.js";
import { checkCooldown } from "../core/cooldown.js";
import { callChatModel, callImageModel } from "../core/aiClient.js";
import { stripThink, splitMessage } from "../core/text.js";
import { getFamilyContextMessage } from "../family/context.js";
import { setHomeChannel, removeHomeChannel } from "../core/channelConfig.js";
import { isBlacklisted, addToBlacklist, removeFromBlacklist } from "../core/blacklist.js";
import { getChannelContextMessage } from "../core/channelContext.js";
import { createGiveawayFlow, endGiveaway, rerollGiveaway, handleJoin } from "../giveaway/manager.js";
import { getGiveaway, getActiveGiveaways } from "../core/giveawayStore.js";
import { parseDuration, formatDuration } from "../utils/duration.js";
import { addAutoresponse, removeAutoresponse, getAutoresponses } from "../core/autoresponseStore.js";

export function registerInteractionHandlers(client) {
  client.on("interactionCreate", async interaction => {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction, client);
      return;
    }

    if (interaction.isButton() && interaction.customId === "choose_qr") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("select_qr")
        .setPlaceholder("Chọn mã QR")
        .addOptions(
          { label: "Qr momo", value: "momo" },
          { label: "Qr Vietcombank", value: "vcb" },
          { label: "Qr zalopay", value: "zalo" }
        );

      const row = new ActionRowBuilder().addComponents(menu);

      return interaction.reply({
        content: "Chọn loại QR:",
        components: [row],
        flags: MessageFlags.Ephemeral
      });
    }

    if (interaction.isButton() && interaction.customId.startsWith("giveaway_join_")) {
      const giveawayId = interaction.customId.replace("giveaway_join_", "");
      const result = handleJoin(giveawayId, interaction.user.id);

      if (!result.ok) {
        const messages = {
          already: "Bạn tham gia rồi mà 🎉",
          ended: "Giveaway này kết thúc rồi, trễ mất tiêu.",
          not_found: "Không tìm thấy giveaway này."
        };
        return interaction.reply({
          content: messages[result.reason] || "Có lỗi xảy ra.",
          flags: MessageFlags.Ephemeral
        });
      }

      return interaction.reply({ content: "✅ Đã ghi danh vào giveaway! Chúc may mắn 🍀", flags: MessageFlags.Ephemeral });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "select_qr") {
      const QR_FILES = {
        momo: "./qr-zalo.jpg",
        vcb: "./qr-vcb.jpg",
        zalo: "./qr-momo.jpg"
      };

      const filePath = QR_FILES[interaction.values[0]];
      if (!filePath) {
        return interaction.reply({ content: "Không tìm thấy mã QR.", flags: MessageFlags.Ephemeral });
      }

      const fileName = filePath.replace("./", "");

      if (!fs.existsSync(filePath)) {
        return interaction.reply({
          content: `Thiếu file ${fileName}`,
          flags: MessageFlags.Ephemeral
        });
      }

      const file = new AttachmentBuilder(fs.readFileSync(filePath), { name: fileName });

      return interaction.reply({
        content: "QR đây 💳",
        files: [file],
        flags: MessageFlags.Ephemeral
      });
    }
  });
}

async function handleSlashCommand(interaction, client) {
  if (interaction.commandName === "ping") {
    return interaction.reply(`🏓 Pong ${client.ws.ping}ms`);
  }

  if (interaction.commandName === "status") {
    const uid = interaction.user.id;
    const chatQuota = getUsageStatus("chat", uid);
    const imageQuota = getUsageStatus("image", uid);

    return interaction.reply(
`${persona.texts.statusIntro}
Chat: openai/gpt-5.6-sol
Image: Qwen/qwen-Image-2.0-Pro
Memory users: ${memoryUserCount()}
Lượt chat còn lại hôm nay: ${chatQuota.remaining === Infinity ? "không giới hạn" : `${chatQuota.remaining}/${chatQuota.limit}`}
Lượt tạo ảnh còn lại hôm nay: ${imageQuota.remaining === Infinity ? "không giới hạn" : `${imageQuota.remaining}/${imageQuota.limit}`}`
    );
  }

  if (interaction.commandName === "setchannel") {
    const hasPermission =
      interaction.user.id === OWNER_ID ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

    if (!hasPermission) {
      return interaction.reply({
        content: "❌ Cần quyền Manage Server (hoặc là bố) mới dùng được lệnh này.",
        flags: MessageFlags.Ephemeral
      });
    }

    if (!interaction.guildId) {
      return interaction.reply({
        content: "Lệnh này chỉ dùng được trong server.",
        flags: MessageFlags.Ephemeral
      });
    }

    const channel = interaction.options.getChannel("channel");

    if (!channel) {
      removeHomeChannel(interaction.guildId);
      return interaction.reply(
        `🗑️ Đã gỡ kênh chính của ${persona.displayName} ở server này. Lời chào/mách lẻo sẽ fallback về FAMILY_CHAT_CHANNEL_ID (nếu có).`
      );
    }

    setHomeChannel(interaction.guildId, channel.id);

    return interaction.reply(
      `✅ Đã đặt <#${channel.id}> làm kênh chính của ${persona.displayName} ở server này (dùng cho lời chào & mách lẻo). Mention chat vẫn hoạt động ở mọi kênh như bình thường.`
    );
  }

  if (interaction.commandName === "blacklist") {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({ content: "❌ Chỉ bố mới dùng được lệnh này.", flags: MessageFlags.Ephemeral });
    }

    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");

    if (target.id === OWNER_ID) {
      return interaction.reply({ content: "❌ Không thể tự chặn bố được.", flags: MessageFlags.Ephemeral });
    }

    addToBlacklist(target.id, reason);
    return interaction.reply(
      `🚫 Đã chặn <@${target.id}> — không thể chat/dùng lệnh với ${persona.displayName} nữa.${reason ? `\nLý do: ${reason}` : ""}`
    );
  }

  if (interaction.commandName === "unblacklist") {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({ content: "❌ Chỉ bố mới dùng được lệnh này.", flags: MessageFlags.Ephemeral });
    }

    const target = interaction.options.getUser("user");
    const removed = removeFromBlacklist(target.id);

    return interaction.reply(
      removed ? `✅ Đã gỡ chặn <@${target.id}>.` : `<@${target.id}> đâu có trong danh sách chặn đâu.`
    );
  }

  if (interaction.commandName === "giveaway") {
    const sub = interaction.options.getSubcommand();

    if (sub === "create") {
      const prize = interaction.options.getString("prize");
      const durationInput = interaction.options.getString("duration");
      const winnerCount = interaction.options.getInteger("winners") || 1;

      const durationMs = parseDuration(durationInput);
      if (!durationMs || durationMs < 30_000) {
        return interaction.reply({
          content: "❌ Thời lượng không hợp lệ (tối thiểu 30s). Dùng dạng: `1h`, `30m`, `1d2h`...",
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      await createGiveawayFlow({
        channel: interaction.channel,
        prize,
        durationMs,
        winnerCount,
        hostId: interaction.user.id,
        hostName: interaction.member?.displayName || interaction.user.username
      });

      return interaction.editReply(`✅ Đã tạo giveaway "${prize}" — kết thúc sau ${formatDuration(durationMs)}.`);
    }

    if (sub === "end" || sub === "reroll") {
      const hasPermission =
        interaction.user.id === OWNER_ID || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

      if (!hasPermission) {
        return interaction.reply({
          content: "❌ Cần quyền Administrator (hoặc là bố) mới dùng được lệnh này.",
          flags: MessageFlags.Ephemeral
        });
      }

      const id = interaction.options.getString("id");
      const giveaway = getGiveaway(id);
      if (!giveaway) {
        return interaction.reply({ content: "Không tìm thấy giveaway với ID đó.", flags: MessageFlags.Ephemeral });
      }

      if (sub === "end") {
        if (giveaway.ended) {
          return interaction.reply({ content: "Giveaway này kết thúc rồi.", flags: MessageFlags.Ephemeral });
        }
        await endGiveaway(id);
        return interaction.reply({ content: "✅ Đã kết thúc giveaway.", flags: MessageFlags.Ephemeral });
      }

      if (sub === "reroll") {
        const result = await rerollGiveaway(id);
        return interaction.reply({
          content: result.ok ? "✅ Đã reroll người thắng." : `❌ ${result.reason}`,
          flags: MessageFlags.Ephemeral
        });
      }
    }

    if (sub === "list") {
      const active = getActiveGiveaways();
      if (!active.length) {
        return interaction.reply({ content: "Hiện không có giveaway nào đang chạy.", flags: MessageFlags.Ephemeral });
      }

      const lines = active.map(
        g =>
          `**${g.prize}** (ID: \`${g.id}\`) — ${g.entries.length} người tham gia, kết thúc <t:${Math.floor(
            g.endsAt / 1000
          )}:R>`
      );
      return interaction.reply({ content: lines.join("\n"), flags: MessageFlags.Ephemeral });
    }
    return;
  }

  if (interaction.commandName === "autorespond") {
    const sub = interaction.options.getSubcommand();

    if (sub === "list") {
      const list = getAutoresponses(interaction.guildId);
      if (!list.length) {
        return interaction.reply({ content: "Chưa có auto-response nào trong server này.", flags: MessageFlags.Ephemeral });
      }
      const lines = list.map(a => `\`${a.id}\` — "${a.trigger}" (${a.matchType}) → "${a.response}"${a.image ? " 🖼️" : ""}`);
      return interaction.reply({ content: lines.join("\n"), flags: MessageFlags.Ephemeral });
    }

    const hasPermission =
      interaction.user.id === OWNER_ID || interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

    if (!hasPermission) {
      return interaction.reply({
        content: "❌ Cần quyền Manage Server (hoặc là bố) mới dùng được lệnh này.",
        flags: MessageFlags.Ephemeral
      });
    }

    if (!interaction.guildId) {
      return interaction.reply({ content: "Lệnh này chỉ dùng được trong server.", flags: MessageFlags.Ephemeral });
    }

    if (sub === "add") {
      const trigger = interaction.options.getString("trigger");
      const response = interaction.options.getString("response");
      const matchType = interaction.options.getString("matchtype") || "contains";
      const image = interaction.options.getString("image");

      const id = addAutoresponse(interaction.guildId, { trigger, response, matchType, image });
      return interaction.reply(
        `✅ Đã thêm auto-response (ID: \`${id}\`): "${trigger}" → "${response}"${image ? " (kèm ảnh)" : ""}`
      );
    }

    if (sub === "remove") {
      const id = interaction.options.getString("id");
      const removed = removeAutoresponse(interaction.guildId, id);
      return interaction.reply(removed ? `✅ Đã xoá auto-response \`${id}\`.` : "Không tìm thấy ID đó.");
    }
    return;
  }

  if (interaction.commandName === "ask") {
    const uid = interaction.user.id;

    if (isBlacklisted(uid)) {
      return interaction.reply({ content: "🚫 Bạn đã bị chặn, không thể dùng lệnh này.", flags: MessageFlags.Ephemeral });
    }

    const wait = checkCooldown("ask", uid);
    if (wait > 0) {
      return interaction.reply({
        content: `Từ từ đã, đợi ${Math.ceil(wait / 1000)}s nữa nha 😅`,
        flags: MessageFlags.Ephemeral
      });
    }

    const quota = getUsageStatus("chat", uid);
    if (!quota.allowed) {
      return interaction.reply({
        content: `Bố/cậu hết lượt chat hôm nay rồi 😢 (giới hạn ${quota.limit} lượt/ngày, mai quay lại nha)`,
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply();

    const content = interaction.options.getString("text");
    const chat = getMemory(uid);
    pushMemoryEntry(uid, { role: "user", content });

    try {
      const channelContext = getChannelContextMessage(interaction.channelId, { excludeLast: false });
      const reply = await callChatModel([
        { role: "system", content: persona.systemPrompt(uid, interaction.guild) },
        { role: "system", content: getFamilyContextMessage() },
        ...(channelContext ? [{ role: "system", content: channelContext }] : []),
        ...chat
      ]);

      const finalReply = stripThink(reply || "Lag.") || "Lag.";
      pushMemoryEntry(uid, { role: "assistant", content: finalReply });
      saveMemory();
      consumeUsage("chat", uid);

      const parts = splitMessage(finalReply);
      await interaction.editReply(parts[0]);
      for (let i = 1; i < parts.length; i++) {
        await interaction.followUp(parts[i]);
      }
    } catch (err) {
      console.error("ASK ERROR:", err);
      await interaction.editReply("Lỗi AI rồi bố ơi.");
    }
    return;
  }

  if (interaction.commandName === "image") {
    const uid = interaction.user.id;

    if (isBlacklisted(uid)) {
      return interaction.reply({ content: "🚫 Bạn đã bị chặn, không thể dùng lệnh này.", flags: MessageFlags.Ephemeral });
    }

    const wait = checkCooldown("image", uid);
    if (wait > 0) {
      return interaction.reply({
        content: `Tạo ảnh tốn thời gian lắm, đợi ${Math.ceil(wait / 1000)}s nữa nha 😅`,
        flags: MessageFlags.Ephemeral
      });
    }

    const quota = getUsageStatus("image", uid);
    if (!quota.allowed) {
      return interaction.reply({
        content: `Hết lượt tạo ảnh hôm nay rồi 😢 (giới hạn ${quota.limit} ảnh/ngày, mai quay lại nha)`,
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply();

    const prompt = interaction.options.getString("prompt");

    try {
      const imgBuffer = await callImageModel(prompt);
      const file = new AttachmentBuilder(imgBuffer, { name: `${persona.key}.png` });

      consumeUsage("image", uid);

      return interaction.editReply({
        content: `${persona.texts.imageReply} (còn ${quota.remaining - 1} lượt tạo ảnh hôm nay)`,
        files: [file]
      });
    } catch (err) {
      console.error("IMAGE ERROR:", err);
      return interaction.editReply("Lỗi tạo ảnh rồi bố ơi.");
    }
  }
}
