import fs from "fs";
import {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags
} from "discord.js";
import persona from "../personas/index.js";
import { getMemory, pushMemoryEntry, saveMemory, memoryUserCount } from "../core/memory.js";
import { getUsageStatus, consumeUsage } from "../core/usage.js";
import { checkCooldown } from "../core/cooldown.js";
import { callChatModel, callImageModel } from "../core/aiClient.js";
import { stripThink, splitMessage } from "../core/text.js";
import { getFamilyContextMessage } from "../family/context.js";

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

  if (interaction.commandName === "ask") {
    const uid = interaction.user.id;
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
      const reply = await callChatModel([
        { role: "system", content: persona.systemPrompt(uid, interaction.guild) },
        { role: "system", content: getFamilyContextMessage() },
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
