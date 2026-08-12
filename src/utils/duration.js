const UNIT_MS = { s: 1000, m: 60000, h: 3600000, d: 86400000 };

/**
 * Parse chuỗi kiểu "1h30m", "2d", "45s" thành số mili giây.
 * @param {string} input
 * @returns {number|null} null nếu không parse được gì cả.
 */
export function parseDuration(input) {
  if (!input) return null;

  const regex = /(\d+)\s*(d|h|m|s)/gi;
  let match;
  let totalMs = 0;
  let found = false;

  while ((match = regex.exec(input))) {
    found = true;
    totalMs += Number(match[1]) * UNIT_MS[match[2].toLowerCase()];
  }

  return found ? totalMs : null;
}

/** @param {number} ms */
export function formatDuration(ms) {
  let remaining = Math.max(ms, 0);
  const days = Math.floor(remaining / UNIT_MS.d);
  remaining %= UNIT_MS.d;
  const hours = Math.floor(remaining / UNIT_MS.h);
  remaining %= UNIT_MS.h;
  const minutes = Math.floor(remaining / UNIT_MS.m);

  const parts = [];
  if (days) parts.push(`${days} ngày`);
  if (hours) parts.push(`${hours} giờ`);
  if (minutes) parts.push(`${minutes} phút`);
  return parts.join(" ") || "< 1 phút";
}
