import fs from "fs";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import persona from "../personas/index.js";
import { OWNER_ID } from "../config/env.js";
import { getMemory, pushMemoryEntry, saveMemory } from "../core/memory.js";
import { getUsageStatus, consumeUsage } from "../core/usage.js";
import { checkCooldown } from "../core/cooldown.js";
import { callChatModel } from "../core/aiClient.js";
import { stripThink, splitMessage } from "../core/text.js";
import { getFamilyContextMessage } from "../family/context.js";

export function registerMessageHandlers(client) {
  // ========= MENTION CHAT + OWNER TEXT COMMANDS =========
  client.on("messageCreate", async msg => {
    if (msg.author.bot) return;

    if (msg.content === "?listsrvr") {
      if (msg.author.id !== OWNER_ID) {
        return msg.reply("❌ Chỉ bố mới dùng được.");
      }

      const list = client.guilds.cache
        .map(g => `${g.name} | ${g.memberCount} members | ${g.id}`)
        .join("\n");

      fs.writeFileSync("guilds.txt", list);

      await msg.reply({
        content: persona.texts.listSrvr(client.guilds.cache.size),
        files: ["guilds.txt"]
      });

      return;
    }

    // ============?nuke=============
    if (msg.content === "?nuke") {
      if (msg.author.id !== OWNER_ID) return;

      await msg.reply("💣 Đang khởi động Nuke...");

      await new Promise(r => setTimeout(r, 1000));
      await msg.channel.send("💥 10%");
      await new Promise(r => setTimeout(r, 1000));
      await msg.channel.send("💥 35%");
      await new Promise(r => setTimeout(r, 1000));
      await msg.channel.send("💥 69%");
      await new Promise(r => setTimeout(r, 1000));
      await msg.channel.send("💥 99%");
      await new Promise(r => setTimeout(r, 1500));

      await msg.channel.send(
`# ☢️ NUKING...
\`\`\`
███████████████ 100%
Deleting channels...
Deleting roles...
Deleting emojis...
Banning members...
\`\`\``);

      await new Promise(r => setTimeout(r, 3000));

      await msg.channel.send(persona.texts.nukeOutro);
    }

    // =======?svinfor========
    if (msg.content.startsWith("?svinfor")) {
      if (msg.author.id !== OWNER_ID) return;

      const id = msg.content.split(" ")[1];
      const guild = client.guilds.cache.get(id);

      if (!guild) return msg.reply("Không tìm thấy server.");

      return msg.reply(
        `📌 ${guild.name}
👥 ${guild.memberCount} thành viên
👑 Owner ID: ${guild.ownerId}`
      );
    }

    // =======?outsv========
    if (msg.content.startsWith("?outsv")) {
      if (msg.author.id !== OWNER_ID) {
        return msg.reply("❌ Chỉ bố mới dùng được.");
      }

      const guildId = msg.content.split(" ")[1];
      if (!guildId) {
        return msg.reply("Dùng: ?leave <GuildID>");
      }
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        return msg.reply("❌ Không tìm thấy server.");
      }
      const name = guild.name;
      await guild.leave();
      return msg.reply(`👋 Đã rời server: ${name}`);
    }

    if (!msg.mentions.has(client.user)) return;

    const content = msg.content
      .replace(`<@${client.user.id}>`, "")
      .replace(`<@!${client.user.id}>`, "")
      .trim();

    if (!content) return;

    const uid = msg.author.id;

    const wait = checkCooldown("mention", uid);
    if (wait > 0) return;

    const quota = getUsageStatus("chat", uid);
    if (!quota.allowed) {
      msg.reply(`Hết lượt chat hôm nay rồi 😢 (giới hạn ${quota.limit} lượt/ngày, mai quay lại nha)`);
      return;
    }

    const chat = getMemory(uid);

    let repliedMsg = msg.reference?.message;
    if (!repliedMsg && msg.reference) {
      try {
        repliedMsg = await msg.fetchReference();
      } catch {
        repliedMsg = null;
      }
    }
    const image = msg.attachments.first() || repliedMsg?.attachments?.first();

    let userContent = content;

    if (image) {
      userContent = [
        {
          type: "text",
          text: content || "Mô tả ảnh này."
        },
        {
          type: "image_url",
          image_url: {
            url: image.url
          }
        }
      ];
    }

    pushMemoryEntry(uid, { role: "user", content: userContent });

    try {
      const reply = await callChatModel([
        { role: "system", content: persona.systemPrompt(uid, msg.guild) },
        { role: "system", content: getFamilyContextMessage() },
        ...chat
      ]);
      const finalReply = stripThink(reply || "Lag.") || "Lag.";
      pushMemoryEntry(uid, { role: "assistant", content: finalReply });
      saveMemory();
      consumeUsage("chat", uid);

      const parts = splitMessage(finalReply);
      await msg.reply(parts[0]);
      for (let i = 1; i < parts.length; i++) {
        await msg.channel.send(parts[i]);
      }
    } catch (err) {
      if (
        err.message?.includes("402") ||
        err.message?.includes("balance") ||
        err.message?.includes("insufficient")
      ) {
        return msg.reply(persona.texts.apiErrorApology);
      }

      console.error(err);
      msg.reply(persona.texts.apiErrorApology);
    }
  });

  // ========= ANXIN =========
  client.on("messageCreate", async msg => {
    if (msg.author.bot) return;

    if (msg.content.toLowerCase().trim() === "anxin") {
      const embed = new EmbedBuilder()
        .setColor("#00ff99")
        .setTitle("💸 HYPER ANXIN")
        .setDescription("Chọn QR để cho bố em cốc cà phê nè hihi!")
        .setThumbnail("https://media.tenor.com/8E5qF5LhY2kAAAAi/money.gif");

      const button = new ButtonBuilder()
        .setCustomId("choose_qr")
        .setLabel("Chọn mã")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(button);

      await msg.reply({
        embeds: [embed],
        components: [row]
      });
    }
  });
}
