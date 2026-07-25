import { SlashCommandBuilder, ChannelType } from "discord.js";
import persona from "../personas/index.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("ask")
    .setDescription(persona.askDescription)
    .addStringOption(o =>
      o.setName("text")
        .setDescription("Nội dung")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("image")
    .setDescription(persona.imageDescription)
    .addStringOption(o =>
      o.setName("prompt")
        .setDescription("Mô tả ảnh")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Ping bot"),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Xem trạng thái"),

  new SlashCommandBuilder()
    .setName("setchannel")
    .setDescription(`Chọn kênh chính của ${persona.displayName} trong server này (dùng cho lời chào & mách lẻo)`)
    .addChannelOption(o =>
      o.setName("channel")
        .setDescription("Kênh muốn đặt làm kênh chính")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
].map(c => c.toJSON());
