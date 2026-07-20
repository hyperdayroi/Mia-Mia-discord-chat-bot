// ========= ANTI-NUKE (Part 9) =========

import { AuditLogEvent } from "discord.js";
import { resolveExecutor } from "../core/auditLog.js";
import { handleSecurityEvent } from "../core/response.js";
import { RISK_POINTS } from "../constants.js";
import { safeHandler } from "../util.js";

function moduleOn(guildState) {
  return guildState.config.enabled && guildState.config.modules.antiNuke;
}

export function registerAntiNuke(client, getCtx) {
  client.on(
    "channelDelete",
    safeHandler(async channel => {
      if (!channel.guild) return;
      const ctx = getCtx(channel.guild);
      if (!moduleOn(ctx.guildState)) return;
      const executor = await resolveExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
      await handleSecurityEvent(ctx, {
        action: "CHANNEL_DELETE",
        executorId: executor?.id,
        targetId: channel.id,
        points: RISK_POINTS.CHANNEL_DELETE,
        reason: `Xoá kênh #${channel.name}`,
        logType: "NUKE_DETECTED",
        title: "Kênh bị xoá",
        description: `Kênh **#${channel.name}** vừa bị xoá.`
      });
    })
  );

  client.on(
    "channelCreate",
    safeHandler(async channel => {
      if (!channel.guild) return;
      const ctx = getCtx(channel.guild);
      if (!moduleOn(ctx.guildState)) return;
      const executor = await resolveExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
      await handleSecurityEvent(ctx, {
        action: "CHANNEL_CREATE",
        executorId: executor?.id,
        targetId: channel.id,
        points: RISK_POINTS.CHANNEL_CREATE_MASS,
        reason: `Tạo kênh #${channel.name}`,
        logType: "NUKE_DETECTED",
        severity: "LOW",
        title: "Kênh mới được tạo",
        description: `Kênh **#${channel.name}** vừa được tạo.`
      });
    })
  );

  client.on(
    "roleDelete",
    safeHandler(async role => {
      const ctx = getCtx(role.guild);
      if (!moduleOn(ctx.guildState)) return;
      const executor = await resolveExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
      await handleSecurityEvent(ctx, {
        action: "ROLE_DELETE",
        executorId: executor?.id,
        targetId: role.id,
        points: RISK_POINTS.ROLE_DELETE,
        reason: `Xoá role ${role.name}`,
        logType: "NUKE_DETECTED",
        title: "Role bị xoá",
        description: `Role **${role.name}** vừa bị xoá.`
      });
    })
  );

  client.on(
    "roleCreate",
    safeHandler(async role => {
      const ctx = getCtx(role.guild);
      if (!moduleOn(ctx.guildState)) return;
      const executor = await resolveExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);
      await handleSecurityEvent(ctx, {
        action: "ROLE_CREATE",
        executorId: executor?.id,
        targetId: role.id,
        points: RISK_POINTS.ROLE_CREATE_MASS,
        reason: `Tạo role ${role.name}`,
        logType: "NUKE_DETECTED",
        severity: "LOW",
        title: "Role mới được tạo",
        description: `Role **${role.name}** vừa được tạo.`
      });
    })
  );

  client.on(
    "roleUpdate",
    safeHandler(async (oldRole, newRole) => {
      const ctx = getCtx(newRole.guild);
      if (!moduleOn(ctx.guildState) || !ctx.guildState.config.modules.antiPermissionAbuse) return;

      const gained = newRole.permissions.bitfield & ~oldRole.permissions.bitfield;
      if (gained === 0n) return; // chỉ quan tâm khi role được CẤP THÊM quyền

      const executor = await resolveExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
      await handleSecurityEvent(ctx, {
        action: "PERMISSION_UPDATE",
        executorId: executor?.id,
        targetId: newRole.id,
        points: RISK_POINTS.PERMISSION_ESCALATION,
        reason: `Role ${newRole.name} được cấp thêm quyền nguy hiểm`,
        logType: "PERMISSION_ABUSE",
        title: "Role được nâng quyền",
        description: `Role **${newRole.name}** vừa được cấp thêm quyền.`
      });
    })
  );

  client.on(
    "guildBanAdd",
    safeHandler(async ban => {
      const ctx = getCtx(ban.guild);
      if (!moduleOn(ctx.guildState)) return;
      const executor = await resolveExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
      await handleSecurityEvent(ctx, {
        action: "MEMBER_BAN",
        executorId: executor?.id,
        targetId: ban.user.id,
        points: RISK_POINTS.MEMBER_BAN,
        reason: `Ban ${ban.user.tag}`,
        logType: "NUKE_DETECTED",
        title: "Thành viên bị ban",
        description: `**${ban.user.tag}** vừa bị ban.`
      });
    })
  );

  client.on(
    "guildMemberRemove",
    safeHandler(async member => {
      const ctx = getCtx(member.guild);
      if (!moduleOn(ctx.guildState)) return;
      // guildMemberRemove fire cho cả rời tự nguyện lẫn bị kick — chỉ audit log mới phân biệt được (Part 9: không đoán)
      const executor = await resolveExecutor(member.guild, AuditLogEvent.MemberKick, member.id, { maxAgeMs: 5000 });
      if (!executor) return; // không có audit log kick tương ứng → coi như tự rời, bỏ qua

      await handleSecurityEvent(ctx, {
        action: "MEMBER_KICK",
        executorId: executor.id,
        targetId: member.id,
        points: RISK_POINTS.MEMBER_KICK,
        reason: `Kick ${member.user.tag}`,
        logType: "NUKE_DETECTED",
        title: "Thành viên bị kick",
        description: `**${member.user.tag}** vừa bị kick.`
      });
    })
  );

  client.on(
    "webhooksUpdate",
    safeHandler(async channel => {
      const ctx = getCtx(channel.guild);
      if (!moduleOn(ctx.guildState)) return;
      // webhooksUpdate không cho biết tạo hay xoá — check cả 2 loại audit log gần nhất
      const created = await resolveExecutor(channel.guild, AuditLogEvent.WebhookCreate, undefined, { maxAgeMs: 5000 });
      const deleted = created ? null : await resolveExecutor(channel.guild, AuditLogEvent.WebhookDelete, undefined, { maxAgeMs: 5000 });
      const executor = created || deleted;
      if (!executor) return;

      await handleSecurityEvent(ctx, {
        action: created ? "WEBHOOK_CREATE" : "WEBHOOK_DELETE",
        executorId: executor.id,
        targetId: channel.id,
        points: RISK_POINTS.WEBHOOK_ABUSE,
        reason: `${created ? "Tạo" : "Xoá"} webhook ở #${channel.name}`,
        logType: "WEBHOOK_ABUSE",
        title: `Webhook bị ${created ? "tạo" : "xoá"}`,
        description: `Có thay đổi webhook ở kênh **#${channel.name}**.`
      });
    })
  );
}
