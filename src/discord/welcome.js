import { EmbedBuilder } from "discord.js";
import persona from "../personas/index.js";
import { callChatModel } from "../core/aiClient.js";
import { stripThink } from "../core/text.js";
import { getHomeChannel } from "../core/channelConfig.js";
import { getWelcomeConfig } from "../core/welcomeStore.js";
import { getFamilyContextMessage } from "../family/context.js";

/** @param {import("discord.js").Client} client */
export function registerWelcomeHandler(client) {
  client.on("guildMemberAdd", async member => {
    try {
      const channelId = getHomeChannel(member.guild.id);
      if (!channelId) return; // chưa /setchannel thì không chào (tránh đăng nhầm kênh)

      const channel = await member.guild.channels.fetch(channelId).catch(() => null);
      if (!channel?.isTextBased()) return;

      const config = getWelcomeConfig(member.guild.id) || {};

      const description = config.message
        ? fillPlaceholders(config.message, member)
        : await generateWelcomeText(member);

      if (!description) return;

      const embed = new EmbedBuilder()
        .setColor(config.color || persona.color || 0x57f287)
        .setTitle(config.title ? fillPlaceholders(config.title, member) : `🎉 CHÀO MỪNG ĐẾN VỚI ${member.guild.name.toUpperCase()}!`)
        .setDescription(description)
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setFooter({ text: `Thành viên thứ ${member.guild.memberCount}` })
        .setTimestamp();

      if (config.banner) embed.setImage(config.banner);

      await channel.send({ content: `<@${member.id}>`, embeds: [embed] });
    } catch (err) {
      console.error("WELCOME_HANDLER_ERROR:", err.message || err);
    }
  });
}

function fillPlaceholders(template, member) {
  return template
    .replaceAll("{user}", `<@${member.id}>`)
    .replaceAll("{server}", member.guild.name)
    .replaceAll("{membercount}", String(member.guild.memberCount));
}

async function generateWelcomeText(member) {
  try {
    const reply = await callChatModel([
      { role: "system", content: persona.systemPrompt(member.id, member.guild) },
      { role: "system", content: getFamilyContextMessage() },
      {
        role: "user",
        content: `Có thành viên mới vừa vào server tên là ${member.user.username} (nhắc tới họ bằng <@${member.id}>). Hãy viết 1 lời chào mừng ngắn gọn (1-2 câu), tự nhiên, đúng tính cách của bạn.`
      }
    ]);
    return stripThink(reply || "").trim();
  } catch (err) {
    console.error("WELCOME_AI_ERROR:", err.message || err);
    return `Chào mừng <@${member.id}> đã đến với server nè!`;
  }
}
