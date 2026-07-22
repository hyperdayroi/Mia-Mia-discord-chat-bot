export function emojiListText(guild) {
  if (!guild) return "";
  const list = guild.emojis.cache.map(e => e.toString()).slice(0, 40);
  if (!list.length) return "";
  return `\nEmoji server được phép dùng khi hợp ngữ cảnh (không lạm dụng, chỉ chèn 0-3 emoji/tin nhắn khi thật sự hợp): ${list.join(" ")}`;
}

export function stripThink(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export function splitMessage(text, max = 1900) {
  const parts = [];
  let buf = "";
  for (const line of text.split("\n")) {
    if ((buf + line).length > max) {
      parts.push(buf);
      buf = "";
    }
    buf += line + "\n";
  }
  if (buf) parts.push(buf);
  return parts;
}
