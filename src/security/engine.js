// ========= MIA SECURITY ENGINE — FACADE =========
// index.js chỉ cần: attachSecurityEngine(client, { ownerId }) rồi dùng .commandJSON / .handleInteraction

import { getGuildState, pruneAll } from "./store.js";
import { registerAntiNuke } from "./detectors/antiNuke.js";
import { registerAntiRaid } from "./detectors/antiRaid.js";
import { registerAntiBot } from "./detectors/antiBot.js";
import { securityCommandJSON, handleSecurityInteraction } from "./commands/security.js";
import { scanMessageSecurity } from "./messagePipeline.js";

const PRUNE_INTERVAL_MS = 10 * 60 * 1000;

export function attachSecurityEngine(client, { ownerId }) {
  function getCtx(guild) {
    return { client, guild, guildState: getGuildState(guild.id), ownerId };
  }

  registerAntiNuke(client, getCtx);
  registerAntiRaid(client, getCtx);
  registerAntiBot(client, getCtx);

  setInterval(pruneAll, PRUNE_INTERVAL_MS).unref?.();

  return {
    commandJSON: securityCommandJSON,
    handleInteraction: interaction => handleSecurityInteraction(interaction, getCtx),
    scanMessage: message => scanMessageSecurity(getCtx, message)
  };
}
