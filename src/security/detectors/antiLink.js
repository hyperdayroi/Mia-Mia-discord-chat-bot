// ========= ANTI-LINK / SUSPICIOUS URL DETECTION (Part 13) =========
// KHÔNG bao giờ gọi network để "kiểm tra" URL — chỉ so khớp chuỗi/domain.
// Cơ chế đáng tin cậy nhất vẫn là blockedDomains do chủ server tự thêm qua /security link block-add.

import { applyMessagePenalty } from "../core/messagePenalty.js";
import {
  RISK_POINTS,
  IMPERSONATION_KEYWORDS,
  KNOWN_SAFE_DOMAINS,
  SUSPICIOUS_TLDS,
  SCAM_KEYWORDS
} from "../constants.js";

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;

function extractHostnames(content) {
  const matches = content.match(URL_REGEX) || [];
  const hosts = [];
  for (const raw of matches) {
    try {
      hosts.push({ raw, hostname: new URL(raw).hostname.toLowerCase() });
    } catch {
      // URL không hợp lệ — bỏ qua, không đoán mò
    }
  }
  return hosts;
}

function isKnownSafe(hostname) {
  return KNOWN_SAFE_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`));
}

function matchesBlocklist(hostname, blockedDomains) {
  return blockedDomains.some(d => hostname === d || hostname.endsWith(`.${d}`));
}

// Heuristic best-effort — luôn có thể sai, chỉ dùng làm tín hiệu bổ sung bên cạnh blockedDomains.
function looksLikePhishing(raw, hostname) {
  if (isKnownSafe(hostname)) return false;

  const impersonates = IMPERSONATION_KEYWORDS.some(k => hostname.includes(k));
  if (impersonates) return true;

  const suspiciousTld = SUSPICIOUS_TLDS.some(tld => hostname.endsWith(tld));
  const scamKeyword = SCAM_KEYWORDS.some(k => raw.toLowerCase().includes(k));
  return suspiciousTld && scamKeyword;
}

export async function scanLinks(ctx, message) {
  const { blockedDomains } = ctx.guildState.config.linkPolicy;
  const hosts = extractHostnames(message.content);
  if (!hosts.length) return false;

  for (const { raw, hostname } of hosts) {
    const blocked = matchesBlocklist(hostname, blockedDomains);
    const suspicious = !blocked && looksLikePhishing(raw, hostname);

    if (blocked || suspicious) {
      return applyMessagePenalty(ctx, message, {
        points: RISK_POINTS.SUSPICIOUS_LINK,
        reason: blocked ? `Link nằm trong blocklist (${hostname})` : `Link nghi ngờ phishing (${hostname})`,
        logType: "SUSPICIOUS_LINK",
        title: "🔗 Phát hiện link đáng ngờ",
        description: `<@${message.author.id}> đã gửi 1 link ${blocked ? "bị chặn" : "nghi ngờ"}: \`${hostname}\``
      });
    }
  }

  return false;
}
