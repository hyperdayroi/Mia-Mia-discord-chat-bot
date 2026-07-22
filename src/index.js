import { ActivityType } from "discord.js";
import persona from "./personas/index.js";
import { DISCORD_TOKEN, AUTO_CHAT_ENABLED, AUTO_CHAT_INTERVAL, FAMILY_CHAT_MODE } from "./config/env.js";
import { createDiscordClient } from "./discord/client.js";
import { registerCommands } from "./discord/registerCommands.js";
import { registerInteractionHandlers } from "./discord/interactions.js";
import { registerMessageHandlers } from "./discord/messages.js";
import { startInternalServer } from "./family/server.js";
import { initConversationManager, scheduleAutonomousConversation } from "./family/conversationManager.js";

const client = createDiscordClient();

await registerCommands();

client.once("ready", () => {
  console.log(persona.texts.onlineLog(client.user.tag));
  client.user.setPresence({
    activities: [{ name: persona.presence.name, type: ActivityType.Playing }],
    status: "online"
  });
});

registerInteractionHandlers(client);
registerMessageHandlers(client);

initConversationManager(client);
startInternalServer();

if (AUTO_CHAT_ENABLED) {
  console.log(
    `Auto family-chat bật (mỗi ${AUTO_CHAT_INTERVAL}ms, chế độ ${FAMILY_CHAT_MODE.toUpperCase()}).`
  );
  scheduleAutonomousConversation(AUTO_CHAT_INTERVAL);
}

process.on("unhandledRejection", err => console.error("UNHANDLED_REJECTION:", err));
process.on("uncaughtException", err => console.error("UNCAUGHT_EXCEPTION:", err));

client.login(DISCORD_TOKEN);
