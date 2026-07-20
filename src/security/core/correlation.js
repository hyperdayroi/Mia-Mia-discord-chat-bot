// ========= EVENT COLLECTOR + CORRELATION (Parts 4, 5, 6) =========
// Không xử lý từng action riêng lẻ — xét cả tốc độ (velocity) và tổ hợp (combo) theo executor.

import {
  VELOCITY_THRESHOLDS,
  COMBO_WINDOW_MS,
  COMBO_MIN_DISTINCT_ACTIONS,
  DESTRUCTIVE_ACTIONS
} from "../constants.js";

// Normalize + lưu 1 Security Event (Part 4). Việc cắt bớt mảng do store.pruneAll() lo định kỳ.
export function recordEvent(guildState, event) {
  guildState.events.push({ ...event, timestamp: event.timestamp || Date.now() });
}

function recentByExecutor(guildState, executorId, windowMs, actionFilter) {
  const now = Date.now();
  return guildState.events.filter(
    e => e.executorId === executorId && now - e.timestamp <= windowMs && (!actionFilter || actionFilter(e.action))
  );
}

// Tốc độ hành động (Part 6): loại action này của executor này có đang xảy ra bất thường nhanh không?
export function checkVelocity(guildState, executorId, action) {
  const threshold = VELOCITY_THRESHOLDS[action];
  if (!threshold) return { breached: false, count: 0 };
  const [limit, windowMs] = threshold;
  const count = recentByExecutor(guildState, executorId, windowMs, a => a === action).length;
  return { breached: count >= limit, count, limit, windowMs };
}

// Combo nhiều LOẠI hành động phá hoại khác nhau trong thời gian ngắn = nuke pattern (Part 5)
export function checkNukeCombo(guildState, executorId) {
  const recent = recentByExecutor(guildState, executorId, COMBO_WINDOW_MS, a => DESTRUCTIVE_ACTIONS.includes(a));
  const distinctActions = [...new Set(recent.map(e => e.action))];
  return { matched: distinctActions.length >= COMBO_MIN_DISTINCT_ACTIONS, distinctActions, events: recent };
}

export function recentEvents(guildState, limit = 15) {
  return guildState.events.slice(-limit).reverse();
}
