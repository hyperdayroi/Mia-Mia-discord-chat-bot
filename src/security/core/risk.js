// ========= RISK SCORING ENGINE (Part 7) =========

import { RISK_DECAY_PER_MINUTE, RISK_MAX, MAX_RISK_REASONS, getThreatLevel } from "../constants.js";

function applyDecay(entry) {
  const now = Date.now();
  const minutesPassed = (now - entry.updatedAt) / 60_000;
  if (minutesPassed > 0) {
    entry.score = Math.max(0, entry.score - minutesPassed * RISK_DECAY_PER_MINUTE);
  }
  entry.updatedAt = now;
  return entry;
}

export function addRisk(guildState, userId, points, reason) {
  if (!guildState.risk[userId]) {
    guildState.risk[userId] = { score: 0, updatedAt: Date.now(), reasons: [] };
  }
  const entry = applyDecay(guildState.risk[userId]);
  entry.score = Math.min(RISK_MAX, entry.score + points);
  entry.reasons.push({ reason, points, ts: Date.now() });
  if (entry.reasons.length > MAX_RISK_REASONS) entry.reasons.shift();
  return { score: Math.round(entry.score), level: getThreatLevel(entry.score), reasons: entry.reasons };
}

export function getRisk(guildState, userId) {
  if (!guildState.risk[userId]) return { score: 0, level: "NORMAL", reasons: [] };
  const entry = applyDecay(guildState.risk[userId]);
  return { score: Math.round(entry.score), level: getThreatLevel(entry.score), reasons: entry.reasons };
}
