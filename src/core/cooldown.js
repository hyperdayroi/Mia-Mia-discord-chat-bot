import { COOLDOWN_MS } from "../config/env.js";

const lastUsed = {}; // `${type}:${uid}` -> timestamp

export function checkCooldown(type, uid) {
  const key = `${type}:${uid}`;
  const now = Date.now();
  const wait = COOLDOWN_MS[type] - (now - (lastUsed[key] || 0));
  if (wait > 0) return wait;
  lastUsed[key] = now;
  return 0;
}
