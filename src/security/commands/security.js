// ========= /security SLASH COMMAND (Part 25) =========
// 1 lệnh gốc + subcommand/subcommand group — đúng convention Discord, khớp cách bạn liệt kê lệnh trong spec.

import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from "discord.js";
import { addToWhitelist, removeFromWhitelist } from "../protection/whitelist.js";
import { enableLockdown, disableLockdown } from "../protection/lockdown.js";
import { sendSecurityLog } from "../logger.js";
import { buildStatusEmbed, buildConfigEmbed, buildLogsEmbed, buildThreatsEmbed } from "../forensics/report.js";
import { persist } from "../store.js";
import { IMPLEMENTED_MODULES } from "../constants.js";

export const securityCommandJSON = new SlashCommandBuilder()
  .setName("security")
  .setDescription("Quản lý Mia Security Engine")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sc => sc.setName("status").setDescription("Xem trạng thái bảo mật server"))
  .addSubcommand(sc => sc.setName("config").setDescription("Xem cấu hình bảo mật hiện tại"))
  .addSubcommand(sc => sc.setName("logs").setDescription("Xem log bảo mật gần đây"))
  .addSubcommand(sc => sc.setName("threats").setDescription("Xem risk score / mối đe doạ gần đây"))
  .addSubcommand(sc => sc.setName("reset").setDescription("Reset toàn bộ security state của server này"))
  .addSubcommand(sc => sc.setName("lockdown").setDescription("Bật Emergency Lockdown thủ công"))
  .addSubcommand(sc => sc.setName("unlockdown").setDescription("Tắt Emergency Lockdown"))
  .addSubcommand(sc =>
    sc
      .setName("setup")
      .setDescription("Thiết lập kênh log bảo mật")
      .addChannelOption(o =>
        o
          .setName("channel")
          .setDescription("Chọn kênh có sẵn (bỏ trống để Mia tự tạo kênh mới)")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
  )
  .addSubcommand(sc =>
    sc
      .setName("enable")
      .setDescription("Bật 1 module bảo mật")
      .addStringOption(o =>
        o
          .setName("module")
          .setDescription("Tên module")
          .setRequired(true)
          .addChoices(...IMPLEMENTED_MODULES.map(m => ({ name: m, value: m })))
      )
  )
  .addSubcommand(sc =>
    sc
      .setName("disable")
      .setDescription("Tắt 1 module bảo mật")
      .addStringOption(o =>
        o
          .setName("module")
          .setDescription("Tên module")
          .setRequired(true)
          .addChoices(...IMPLEMENTED_MODULES.map(m => ({ name: m, value: m })))
      )
  )
  .addSubcommandGroup(g =>
    g
      .setName("whitelist")
      .setDescription("Quản lý danh sách được tin cậy")
      .addSubcommand(sc =>
        sc.setName("user-add").setDescription("Thêm user vào whitelist").addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
      )
      .addSubcommand(sc =>
        sc.setName("user-remove").setDescription("Xoá user khỏi whitelist").addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
      )
      .addSubcommand(sc =>
        sc.setName("role-add").setDescription("Thêm role vào whitelist").addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true))
      )
      .addSubcommand(sc =>
        sc.setName("role-remove").setDescription("Xoá role khỏi whitelist").addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true))
      )
      .addSubcommand(sc =>
        sc.setName("bot-add").setDescription("Thêm bot vào whitelist").addUserOption(o => o.setName("bot").setDescription("Bot").setRequired(true))
      )
      .addSubcommand(sc =>
        sc.setName("bot-remove").setDescription("Xoá bot khỏi whitelist").addUserOption(o => o.setName("bot").setDescription("Bot").setRequired(true))
      )
  )
  .addSubcommandGroup(g =>
    g
      .setName("link")
      .setDescription("Quản lý danh sách domain bị chặn")
      .addSubcommand(sc =>
        sc.setName("block-add").setDescription("Chặn 1 domain").addStringOption(o => o.setName("domain").setDescription("Ví dụ: evil.com").setRequired(true))
      )
      .addSubcommand(sc =>
        sc.setName("block-remove").setDescription("Bỏ chặn 1 domain").addStringOption(o => o.setName("domain").setDescription("Ví dụ: evil.com").setRequired(true))
      )
  )
  .toJSON();

export async function handleSecurityInteraction(interaction, getCtx) {
  const ctx = getCtx(interaction.guild);
  const { guildState, guild } = ctx;
  const sub = interaction.options.getSubcommand();
  const group = interaction.options.getSubcommandGroup(false);

  if (group === "whitelist") {
    const actions = {
      "user-add": () => addToWhitelist(guildState, "users", interaction.options.getUser("user").id),
      "user-remove": () => removeFromWhitelist(guildState, "users", interaction.options.getUser("user").id),
      "role-add": () => addToWhitelist(guildState, "roles", interaction.options.getRole("role").id),
      "role-remove": () => removeFromWhitelist(guildState, "roles", interaction.options.getRole("role").id),
      "bot-add": () => addToWhitelist(guildState, "bots", interaction.options.getUser("bot").id),
      "bot-remove": () => removeFromWhitelist(guildState, "bots", interaction.options.getUser("bot").id)
    };
    actions[sub]?.();
    persist();
    return interaction.reply({ content: "✅ Đã cập nhật whitelist.", flags: MessageFlags.Ephemeral });
  }

  if (group === "link") {
    const domain = interaction.options.getString("domain").toLowerCase().trim().replace(/^www\./, "");
    const list = guildState.config.linkPolicy.blockedDomains;
    if (sub === "block-add") {
      if (!list.includes(domain)) list.push(domain);
    } else if (sub === "block-remove") {
      guildState.config.linkPolicy.blockedDomains = list.filter(d => d !== domain);
    }
    persist();
    return interaction.reply({
      content: `✅ Đã ${sub === "block-add" ? "chặn" : "bỏ chặn"} domain \`${domain}\`.`,
      flags: MessageFlags.Ephemeral
    });
  }

  switch (sub) {
    case "status":
      return interaction.reply({ embeds: [buildStatusEmbed(guild, guildState)] });

    case "config":
      return interaction.reply({ embeds: [buildConfigEmbed(guild, guildState)], flags: MessageFlags.Ephemeral });

    case "logs":
      return interaction.reply({ embeds: [buildLogsEmbed(guildState)], flags: MessageFlags.Ephemeral });

    case "threats":
      return interaction.reply({ embeds: [buildThreatsEmbed(guildState)], flags: MessageFlags.Ephemeral });

    case "reset": {
      guildState.config.enabled = true;
      guildState.risk = {};
      guildState.events = [];
      guildState.joins = [];
      guildState.threatState = "NORMAL";
      persist();
      return interaction.reply({ content: "♻️ Đã reset security state của server này.", flags: MessageFlags.Ephemeral });
    }

    case "lockdown": {
      await enableLockdown(guild, guildState, `Kích hoạt thủ công bởi ${interaction.user.tag}`);
      persist();
      await sendSecurityLog(ctx, {
        type: "LOCKDOWN_ENABLED",
        severity: "HIGH",
        title: "🔒 Lockdown thủ công",
        description: `Kích hoạt bởi <@${interaction.user.id}>`
      });
      return interaction.reply({ content: "🔒 Đã bật Emergency Lockdown.", flags: MessageFlags.Ephemeral });
    }

    case "unlockdown": {
      await disableLockdown(guild, guildState);
      persist();
      await sendSecurityLog(ctx, {
        type: "LOCKDOWN_DISABLED",
        severity: "INFO",
        title: "🔓 Lockdown đã tắt",
        description: `Tắt bởi <@${interaction.user.id}>`
      });
      return interaction.reply({ content: "🔓 Đã tắt Lockdown.", flags: MessageFlags.Ephemeral });
    }

    case "enable":
    case "disable": {
      const moduleName = interaction.options.getString("module");
      guildState.config.modules[moduleName] = sub === "enable";
      persist();
      await sendSecurityLog(ctx, {
        type: "SECURITY_CONFIG_CHANGED",
        severity: "INFO",
        title: "⚠️ Module thay đổi",
        description: `**${moduleName}** đã được ${sub === "enable" ? "bật" : "tắt"} bởi <@${interaction.user.id}>`
      });
      return interaction.reply({
        content: `✅ Đã ${sub === "enable" ? "bật" : "tắt"} module **${moduleName}**.`,
        flags: MessageFlags.Ephemeral
      });
    }

    case "setup": {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      let channel = interaction.options.getChannel("channel");
      const me = guild.members.me;

      if (channel) {
        const perms = channel.permissionsFor(me);
        const required = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        if (!perms || !required.every(p => perms.has(p))) {
          return interaction.editReply("❌ Mia thiếu quyền View Channel / Send Messages / Embed Links ở kênh đó.");
        }
      } else {
        if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return interaction.editReply(
            "❌ Mia cần quyền **Manage Channels** để tự tạo kênh log. Cấp quyền đó, hoặc chọn kênh có sẵn qua option `channel`."
          );
        }
        try {
          const category =
            guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === "📁 MIA SECURITY") ||
            (await guild.channels.create({ name: "📁 MIA SECURITY", type: ChannelType.GuildCategory }));

          channel = await guild.channels.create({
            name: "🔒・security-logs",
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }]
          });
        } catch (err) {
          console.error("SETUP_LOGS_ERROR:", err.message);
          return interaction.editReply("❌ Không tạo được kênh log — kiểm tra lại quyền Manage Channels của Mia.");
        }
      }

      guildState.config.logChannelId = channel.id;
      guildState.logChannelUnavailableWarned = false;
      persist();
      await sendSecurityLog(ctx, {
        type: "SECURITY_CONFIG_CHANGED",
        severity: "INFO",
        title: "⚙️ Đã thiết lập kênh log",
        description: `Kênh log bảo mật: <#${channel.id}>`
      });
      return interaction.editReply(`✅ Đã đặt <#${channel.id}> làm kênh log bảo mật.`);
    }

    default:
      return interaction.reply({ content: "Lệnh con không hợp lệ.", flags: MessageFlags.Ephemeral });
  }
}
