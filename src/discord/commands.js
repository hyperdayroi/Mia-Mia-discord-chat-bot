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
    .addUserOption(o => o.setName("user").setDescription("User cần chặn").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Lý do (tuỳ chọn)").setRequired(false)),

  new SlashCommandBuilder()
    .setName("unblacklist")
    .setDescription(`[Owner] Gỡ chặn 1 user cho ${persona.displayName}`)
    .addUserOption(o => o.setName("user").setDescription("User cần gỡ chặn").setRequired(true)),

  new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Tạo/quản lý giveaway")
    .addSubcommand(sub =>
      sub
        .setName("create")
        .setDescription("Tạo giveaway mới")
        .addStringOption(o => o.setName("prize").setDescription("Phần thưởng là gì").setRequired(true))
        .addStringOption(o =>
          o.setName("duration").setDescription("Thời lượng (vd: 1h, 30m, 1d2h)").setRequired(true)
        )
        .addIntegerOption(o =>
          o.setName("winners").setDescription("Số người thắng (mặc định 1)").setMinValue(1).setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("end")
        .setDescription("[Owner] Kết thúc sớm 1 giveaway")
        .addStringOption(o => o.setName("id").setDescription("ID giveaway (xem ở footer embed)").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("reroll")
        .setDescription("[Owner] Quay lại người thắng cho 1 giveaway đã kết thúc")
        .addStringOption(o => o.setName("id").setDescription("ID giveaway (xem ở footer embed)").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("list").setDescription("Xem các giveaway đang chạy")),

  new SlashCommandBuilder()
    .setName("autorespond")
    .setDescription("Bot tự trả lời khi có từ khoá xuất hiện trong tin nhắn (không cần @)")
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("Thêm 1 auto-response mới")
        .addStringOption(o => o.setName("trigger").setDescription("Từ khoá kích hoạt").setRequired(true))
        .addStringOption(o => o.setName("response").setDescription("Nội dung bot sẽ trả lời").setRequired(true))
        .addStringOption(o =>
          o
            .setName("matchtype")
            .setDescription("Kiểu khớp (mặc định: chứa từ khoá)")
            .addChoices(
              { name: "Chứa từ khoá", value: "contains" },
              { name: "Khớp chính xác", value: "exact" },
              { name: "Bắt đầu bằng", value: "startsWith" }
            )
            .setRequired(false)
        )
        .addStringOption(o =>
          o.setName("image").setDescription("URL ảnh đính kèm (tuỳ chọn) — có ảnh sẽ gửi dạng embed").setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("Xoá 1 auto-response theo ID")
        .addStringOption(o => o.setName("id").setDescription("ID (xem qua /autorespond list)").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("list").setDescription("Xem danh sách auto-response trong server này")),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("[Admin] Đăng + tự ghim 1 thông báo vào kênh")
    .addChannelOption(o =>
      o.setName("channel").setDescription("Kênh muốn đăng").addChannelTypes(ChannelType.GuildText).setRequired(true)
    )
    .addStringOption(o => o.setName("title").setDescription("Tiêu đề thông báo").setRequired(true))
    .addStringOption(o => o.setName("message").setDescription("Nội dung thông báo").setRequired(true))
    .addStringOption(o => o.setName("image").setDescription("URL ảnh đính kèm (tuỳ chọn)").setRequired(false))
].map(c => c.toJSON());
