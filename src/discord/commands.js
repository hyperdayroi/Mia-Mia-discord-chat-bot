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
    .setDescription(`Chọn (hoặc gỡ) kênh chính của ${persona.displayName} trong server này (dùng cho lời chào & mách lẻo)`)
    .addChannelOption(o =>
      o.setName("channel")
        .setDescription("Kênh muốn đặt làm kênh chính (để trống = gỡ kênh đã set)")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("blacklist")
    .setDescription(`[Owner] Chặn 1 user không cho dùng ${persona.displayName} nữa`)
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User cần chặn")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Lý do (tuỳ chọn)")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("unblacklist")
    .setDescription(`[Owner] Gỡ chặn 1 user cho ${persona.displayName}`)
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User cần gỡ chặn")
        .setRequired(true)
    ),

  // =========================
  // VOICE COMMANDS
  // =========================

  new SlashCommandBuilder()
    .setName("join")
    .setDescription("Cho Mia vào voice channel bạn đang ở"),

  new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Cho Mia rời voice channel"),

  new SlashCommandBuilder()
    .setName("listen")
    .setDescription("Bật/tắt chế độ nghe và trả lời bằng giọng nói")
    .addSubcommand(sub =>
      sub
        .setName("start")
        .setDescription("Bắt đầu nghe bạn nói và trả lời bằng giọng nói")
    )
    .addSubcommand(sub =>
      sub
        .setName("stop")
        .setDescription("Dừng chế độ nghe")
    )

].map(c => c.toJSON());