// ========= WHITELIST / TRUST SYSTEM (Part 8) =========
// Luôn whitelist theo ID (user/role/bot), KHÔNG bao giờ theo username.

export function isBotOwner(userId, ownerId) {
  return userId === ownerId;
}

export function isServerOwner(guild, userId) {
  return guild?.ownerId === userId;
}

export function isTrustedUser(guildState, userId) {
  return guildState.config.whitelist.users.includes(userId);
}

export function isTrustedRole(guildState, member) {
  if (!member?.roles?.cache) return false;
  return guildState.config.whitelist.roles.some(rid => member.roles.cache.has(rid));
}

export function isTrustedBot(guildState, userId) {
  return guildState.config.whitelist.bots.includes(userId);
}

// Tổng hợp: member này có nên được "bảo vệ" khỏi phản ứng tự động của Security Engine không?
// Lưu ý: hành động nguy hiểm của họ vẫn được GHI LOG (Part 8), chỉ là không tự động revoke/kick/ban/lockdown nhắm vào họ.
export function isProtectedMember(guild, guildState, member, ownerId) {
  if (!member) return false;
  const userId = member.id ?? member.user?.id;
  if (isBotOwner(userId, ownerId)) return true;
  if (isServerOwner(guild, userId)) return true;
  if (member.user?.bot ? isTrustedBot(guildState, userId) : isTrustedUser(guildState, userId)) return true;
  if (isTrustedRole(guildState, member)) return true;
  return false;
}

export function addToWhitelist(guildState, type, id) {
  const list = guildState.config.whitelist[type];
  if (!list.includes(id)) list.push(id);
}

export function removeFromWhitelist(guildState, type, id) {
  guildState.config.whitelist[type] = guildState.config.whitelist[type].filter(x => x !== id);
}
