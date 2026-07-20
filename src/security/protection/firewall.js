// ========= PERMISSION FIREWALL (Part 10) =========
// Nguyên tắc: khi chưa đủ tin cậy để ban, ƯU TIÊN gỡ quyền nguy hiểm TRƯỚC.

import { DANGEROUS_PERMISSIONS } from "../constants.js";

export function memberHasDangerousPermission(member) {
  return DANGEROUS_PERMISSIONS.some(p => member.permissions.has(p));
}

// Gỡ CÁC ROLE đang cấp quyền nguy hiểm khỏi member (không đụng role không nguy hiểm, không đụng @everyone).
// Trả về danh sách tên role đã gỡ thành công, để log. Không throw — role nào lỗi (vd. cao hơn hierarchy của bot) thì bỏ qua và log console.
export async function revokeDangerousPermissions(member) {
  const removed = [];
  const dangerousRoles = member.roles.cache.filter(
    role => role.id !== member.guild.id && DANGEROUS_PERMISSIONS.some(p => role.permissions.has(p))
  );

  for (const role of dangerousRoles.values()) {
    try {
      await member.roles.remove(role, "Mia Security Engine: revoke dangerous permissions");
      removed.push(role.name);
    } catch (err) {
      console.error(`FIREWALL_REMOVE_ROLE_ERROR (${role.name}):`, err.message);
    }
  }
  return removed;
}
