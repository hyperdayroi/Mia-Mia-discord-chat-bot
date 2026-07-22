import { SlashCommandBuilder } from "discord.js";
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
    .setDescription("Xem trạng thái")
].map(c => c.toJSON());
