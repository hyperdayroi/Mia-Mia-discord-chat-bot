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

import {
  getMemory,
  pushMemoryEntry,
  saveMemory,
  memoryUserCount
} from "../core/memory.js";

import {
  getUsageStatus,
  consumeUsage
} from "../core/usage.js";

import { checkCooldown } from "../core/cooldown.js";

import {
  callChatModel,
  callImageModel
} from "../core/aiClient.js";

import {
  stripThink,
  splitMessage
} from "../core/text.js";

import { getFamilyContextMessage } from "../family/context.js";

import {
  setHomeChannel,
  removeHomeChannel
} from "../core/channelConfig.js";

import {
  isBlacklisted,
  addToBlacklist,
  removeFromBlacklist
} from "../core/blacklist.js";

// =========================
// VOICE MODULE
// =========================

import {
  joinChannel,
  leaveChannel,
  getActiveConnection
} from "../voice/connection.js";

import {
  isListening,
  startListening,
  stopListening
} from "../voice/session.js";


export function registerInteractionHandlers(client) {

  client.on("interactionCreate", async interaction => {

    // =========================
    // SLASH COMMAND
    // =========================

    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction, client);
      return;
    }


    // =========================
    // QR BUTTON
    // =========================

    if (
      interaction.isButton() &&
      interaction.customId === "choose_qr"
    ) {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("select_qr")
        .setPlaceholder("Chọn mã QR")
        .addOptions(
          {
            label: "Qr momo",
            value: "momo"
          },
          {
            label: "Qr Vietcombank",
            value: "vcb"
          },
          {
            label: "Qr zalopay",
            value: "zalo"
          }
        );

      const row =
        new ActionRowBuilder()
          .addComponents(menu);

      return interaction.reply({
        content: "Chọn loại QR:",
        components: [row],
        flags: MessageFlags.Ephemeral
      });
    }


    // =========================
    // QR SELECT MENU
    // =========================

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "select_qr"
    ) {

      const QR_FILES = {
        momo: "./qr-zalo.jpg",
        vcb: "./qr-vcb.jpg",
        zalo: "./qr-momo.jpg"
      };

      const filePath =
        QR_FILES[interaction.values[0]];

      if (!filePath) {
        return interaction.reply({
          content: "Không tìm thấy mã QR.",
          flags: MessageFlags.Ephemeral
        });
      }

      const fileName =
        filePath.replace("./", "");

      if (!fs.existsSync(filePath)) {
        return interaction.reply({
          content: `Thiếu file ${fileName}`,
          flags: MessageFlags.Ephemeral
        });
      }

      const file =
        new AttachmentBuilder(
          fs.readFileSync(filePath),
          {
            name: fileName
          }
        );

      return interaction.reply({
        content: "QR đây 💳",
        files: [file],
        flags: MessageFlags.Ephemeral
      });
    }

  });

}


// ============================================================
// SLASH COMMAND HANDLER
// ============================================================

async function handleSlashCommand(interaction, client) {

  // ==========================================================
  // PING
  // ==========================================================

  if (interaction.commandName === "ping") {

    return interaction.reply(
      `🏓 Pong ${client.ws.ping}ms`
    );
  }


  // ==========================================================
  // STATUS
  // ==========================================================

  if (interaction.commandName === "status") {

    const uid =
      interaction.user.id;

    const chatQuota =
      getUsageStatus("chat", uid);

    const imageQuota =
      getUsageStatus("image", uid);

    return interaction.reply(
`${persona.texts.statusIntro}
Chat: openai/gpt-5.6-sol
Image: Qwen/qwen-Image-2.0-Pro
Memory users: ${memoryUserCount()}
Lượt chat còn lại hôm nay: ${
  chatQuota.remaining === Infinity
    ? "không giới hạn"
    : `${chatQuota.remaining}/${chatQuota.limit}`
}
Lượt tạo ảnh còn lại hôm nay: ${
  imageQuota.remaining === Infinity
    ? "không giới hạn"
    : `${imageQuota.remaining}/${imageQuota.limit}`
}`
    );
  }


  // ==========================================================
  // SET CHANNEL
  // ==========================================================

  if (interaction.commandName === "setchannel") {

    const hasPermission =
      interaction.user.id === OWNER_ID ||
      interaction.memberPermissions?.has(
        PermissionFlagsBits.ManageGuild
      );

    if (!hasPermission) {

      return interaction.reply({
        content:
          "❌ Cần quyền Manage Server (hoặc là bố) mới dùng được lệnh này.",
        flags: MessageFlags.Ephemeral
      });
    }

    if (!interaction.guildId) {

      return interaction.reply({
        content:
          "Lệnh này chỉ dùng được trong server.",
        flags: MessageFlags.Ephemeral
      });
    }

    const channel =
      interaction.options.getChannel("channel");

    if (!channel) {

      removeHomeChannel(
        interaction.guildId
      );

      return interaction.reply(
        `🗑️ Đã gỡ kênh chính của ${persona.displayName} ở server này. Lời chào/mách lẻo sẽ fallback về FAMILY_CHAT_CHANNEL_ID (nếu có).`
      );
    }

    setHomeChannel(
      interaction.guildId,
      channel.id
    );

    return interaction.reply(
      `✅ Đã đặt <#${channel.id}> làm kênh chính của ${persona.displayName} ở server này (dùng cho lời chào & mách lẻo). Mention chat vẫn hoạt động ở mọi kênh như bình thường.`
    );
  }


  // ==========================================================
  // BLACKLIST
  // ==========================================================

  if (interaction.commandName === "blacklist") {

    if (interaction.user.id !== OWNER_ID) {

      return interaction.reply({
        content:
          "❌ Chỉ bố mới dùng được lệnh này.",
        flags: MessageFlags.Ephemeral
      });
    }

    const target =
      interaction.options.getUser("user");

    const reason =
      interaction.options.getString("reason");

    if (target.id === OWNER_ID) {

      return interaction.reply({
        content:
          "❌ Không thể tự chặn bố được.",
        flags: MessageFlags.Ephemeral
      });
    }

    addToBlacklist(
      target.id,
      reason
    );

    return interaction.reply(
      `🚫 Đã chặn <@${target.id}> — không thể chat/dùng lệnh với ${persona.displayName} nữa.${
        reason
          ? `\nLý do: ${reason}`
          : ""
      }`
    );
  }


  // ==========================================================
  // UNBLACKLIST
  // ==========================================================

  if (
    interaction.commandName ===
    "unblacklist"
  ) {

    if (interaction.user.id !== OWNER_ID) {

      return interaction.reply({
        content:
          "❌ Chỉ bố mới dùng được lệnh này.",
        flags: MessageFlags.Ephemeral
      });
    }

    const target =
      interaction.options.getUser("user");

    const removed =
      removeFromBlacklist(
        target.id
      );

    return interaction.reply(
      removed
        ? `✅ Đã gỡ chặn <@${target.id}>.`
        : `<@${target.id}> đâu có trong danh sách chặn đâu.`
    );
  }


  // ==========================================================
  // VOICE: JOIN
  // ==========================================================

  if (interaction.commandName === "join") {

    if (
      !interaction.guildId ||
      !interaction.guild
    ) {

      return interaction.reply({
        content:
          "Lệnh này chỉ dùng được trong server.",
        flags: MessageFlags.Ephemeral
      });
    }

    const member =
      interaction.member;

    const channel =
      member?.voice?.channel;

    if (!channel) {

      return interaction.reply({
        content:
          "Bố phải vào voice channel trước đã 😭",
        flags: MessageFlags.Ephemeral
      });
    }

    const me =
      interaction.guild.members.me;

    const permissions =
      me
        ? channel.permissionsFor(me)
        : null;

    if (
      permissions &&
      !permissions.has(
        PermissionFlagsBits.Connect
      )
    ) {

      return interaction.reply({
        content:
          "Mia không có quyền **Connect** vào voice channel này.",
        flags: MessageFlags.Ephemeral
      });
    }

    if (
      permissions &&
      !permissions.has(
        PermissionFlagsBits.Speak
      )
    ) {

      return interaction.reply({
        content:
if (interaction.commandName === "join") {
  if (!interaction.guildId || !interaction.guild) {
    return interaction.reply({
      content: "Lệnh này chỉ dùng được trong server.",
      flags: MessageFlags.Ephemeral
    });
  }

  const member = interaction.member;
  const channel = member?.voice?.channel;

  if (!channel) {
    return interaction.reply({
      content: "Bố phải vào voice channel trước đã 😭",
      flags: MessageFlags.Ephemeral
    });
  }

  const me = interaction.guild.members.me;
  const permissions = me ? channel.permissionsFor(me) : null;

  if (
    permissions &&
    !permissions.has(PermissionFlagsBits.Connect)
  ) {
    return interaction.reply({
      content: "Mia không có quyền **Connect** vào voice channel này.",
      flags: MessageFlags.Ephemeral
    });
  }

  if (
    permissions &&
    !permissions.has(PermissionFlagsBits.Speak)
  ) {
    return interaction.reply({
      content: "Mia không có quyền **Speak** trong voice channel này.",
      flags: MessageFlags.Ephemeral
    });
  }

  // ACK interaction ngay lập tức
  await interaction.deferReply();

  try {
    stopListening(interaction.guildId);

    await joinChannel(channel);

    return interaction.editReply(
      `🎧 Mia đã vào <#${channel.id}>. Dùng \`/listen start\` để Mia bắt đầu nghe và trả lời bằng giọng nói.`
    );

  } catch (err) {
    console.error("VOICE_JOIN_ERROR:", err);

    return interaction.editReply(
      "Mia không vào voice được 😭 Kiểm tra quyền **Connect/Speak** và thử lại nha."
    );
  }
      }


  // ==========================================================
  // VOICE: LEAVE
  // ==========================================================

  if (interaction.commandName === "leave") {

    if (!interaction.guildId) {

      return interaction.reply({
        content:
          "Lệnh này chỉ dùng được trong server.",
        flags: MessageFlags.Ephemeral
      });
    }

    stopListening(
      interaction.guildId
    );

    const left =
      leaveChannel(
        interaction.guildId
      );

    return interaction.reply(
      left
        ? "👋 Mia ra khỏi voice rồi nha."
        : "Mia đâu có ở voice channel nào đâu :>"
    );
  }


  // ==========================================================
  // VOICE: LISTEN
  // ==========================================================

  if (interaction.commandName === "listen") {

    if (
      !interaction.guildId ||
      !interaction.guild
    ) {

      return interaction.reply({
        content:
          "Lệnh này chỉ dùng được trong server.",
        flags: MessageFlags.Ephemeral
      });
    }

    const subcommand =
      interaction.options.getSubcommand();


    // --------------------------------------------------------
    // LISTEN STOP
    // --------------------------------------------------------

    if (subcommand === "stop") {

      const stopped =
        stopListening(
          interaction.guildId
        );

      return interaction.reply(
        stopped
          ? "🛑 Mia ngừng nghe rồi nha."
          : "Mia hiện không ở chế độ nghe."
      );
    }


    // --------------------------------------------------------
    // LISTEN START
    // --------------------------------------------------------

    if (subcommand === "start") {

      const member =
        interaction.member;

      const userChannel =
        member?.voice?.channel;

      if (!userChannel) {

        return interaction.reply({
          content:
            "Bố phải vào voice channel trước đã 😭",
          flags: MessageFlags.Ephemeral
        });
      }

      const connection =
        getActiveConnection(
          interaction.guildId
        );

      if (!connection) {

        return interaction.reply({
          content:
            "Mia chưa vào voice. Dùng `/join` trước nha.",
          flags: MessageFlags.Ephemeral
        });
      }

      const botChannelId =
        interaction.guild.members.me
          ?.voice?.channelId;

      if (
        !botChannelId ||
        botChannelId !== userChannel.id
      ) {

        return interaction.reply({
          content:
            "Bố phải ở cùng voice channel với Mia mới nghe được nha.",
          flags: MessageFlags.Ephemeral
        });
      }

      if (
        isListening(
          interaction.guildId
        )
      ) {

        return interaction.reply({
          content:
            "Mia đang nghe rồi 👂",
          flags: MessageFlags.Ephemeral
        });
      }

      const started =
        startListening(
          connection,
          interaction.guild,
          interaction.user.id
        );

      return interaction.reply(
        started
          ? "🎙️ Mia bắt đầu nghe rồi. Cứ nói bình thường nha — Mia sẽ nghe → hiểu → trả lời → nói lại bằng giọng."
          : "Không thể bắt đầu phiên nghe lúc này."
      );
    }
  }


  // ==========================================================
  // ASK
  // ==========================================================

  if (interaction.commandName === "ask") {

    const uid =
      interaction.user.id;

    if (isBlacklisted(uid)) {

      return interaction.reply({
        content:
          "🚫 Bạn đã bị chặn, không thể dùng lệnh này.",
        flags: MessageFlags.Ephemeral
      });
    }

    const wait =
      checkCooldown(
        "ask",
        uid
      );

    if (wait > 0) {

      return interaction.reply({
        content:
          `Từ từ đã, đợi ${Math.ceil(wait / 1000)}s nữa nha 😅`,
        flags: MessageFlags.Ephemeral
      });
    }

    const quota =
      getUsageStatus(
        "chat",
        uid
      );

    if (!quota.allowed) {

      return interaction.reply({
        content:
          `Bố/cậu hết lượt chat hôm nay rồi 😢 (giới hạn ${quota.limit} lượt/ngày, mai quay lại nha)`,
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply();

    const content =
      interaction.options.getString("text");

    const chat =
      getMemory(uid);

    pushMemoryEntry(
      uid,
      {
        role: "user",
        content
      }
    );

    try {

      const reply =
        await callChatModel([
          {
            role: "system",
            content:
              persona.systemPrompt(
                uid,
                interaction.guild
              )
          },

          {
            role: "system",
            content:
              getFamilyContextMessage()
          },

          ...chat
        ]);

      const finalReply =
        stripThink(
          reply ||
          "Lag."
        ) ||
        "Lag.";

      pushMemoryEntry(
        uid,
        {
          role: "assistant",
          content: finalReply
        }
      );

      saveMemory();

      consumeUsage(
        "chat",
        uid
      );

      const parts =
        splitMessage(
          finalReply
        );

      await interaction.editReply(
        parts[0]
      );

      for (
        let i = 1;
        i < parts.length;
        i++
      ) {

        await interaction.followUp(
          parts[i]
        );
      }

    } catch (err) {

      console.error(
        "ASK ERROR:",
        err
      );

      await interaction.editReply(
        "Lỗi AI rồi bố ơi."
      );
    }

    return;
  }


  // ==========================================================
  // IMAGE
  // ==========================================================

  if (interaction.commandName === "image") {

    const uid =
      interaction.user.id;

    if (isBlacklisted(uid)) {

      return interaction.reply({
        content:
          "🚫 Bạn đã bị chặn, không thể dùng lệnh này.",
        flags: MessageFlags.Ephemeral
      });
    }

    const wait =
      checkCooldown(
        "image",
        uid
      );

    if (wait > 0) {

      return interaction.reply({
        content:
          `Tạo ảnh tốn thời gian lắm, đợi ${Math.ceil(wait / 1000)}s nữa nha 😅`,
        flags: MessageFlags.Ephemeral
      });
    }

    const quota =
      getUsageStatus(
        "image",
        uid
      );

    if (!quota.allowed) {

      return interaction.reply({
        content:
          `Hết lượt tạo ảnh hôm nay rồi 😢 (giới hạn ${quota.limit} ảnh/ngày, mai quay lại nha)`,
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply();

    const prompt =
      interaction.options.getString(
        "prompt"
      );

    try {

      const imgBuffer =
        await callImageModel(
          prompt
        );

      const file =
        new AttachmentBuilder(
          imgBuffer,
          {
            name:
              `${persona.key}.png`
          }
        );

      consumeUsage(
        "image",
        uid
      );

      return interaction.editReply({
        content:
          `${persona.texts.imageReply} (còn ${
            quota.remaining - 1
          } lượt tạo ảnh hôm nay)`,

        files: [file]
      });

    } catch (err) {

      console.error(
        "IMAGE ERROR:",
        err
      );

      return interaction.editReply(
        "Lỗi tạo ảnh rồi bố ơi."
      );
    }
  }
}
