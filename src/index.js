import ffmpegPath from "ffmpeg-static";
process.env.FFMPEG_PATH = ffmpegPath;

import { ActivityType } from "discord.js";
import persona from "./personas/index.js";
import {
  DISCORD_TOKEN,
  AUTO_CHAT_ENABLED,
  AUTO_CHAT_INTERVAL,
  FAMILY_CHAT_MODE,
  GOOD_MORNING_ENABLED,
  GOOD_NIGHT_ENABLED,
  TATTLE_ENABLED
} from "./config/env.js";
import { createDiscordClient } from "./discord/client.js";
import { registerCommands } from "./discord/registerCommands.js";
import { registerInteractionHandlers } from "./discord/interactions.js";
import { registerMessageHandlers } from "./discord/messages.js";
import { startInternalServer } from "./family/server.js";
import { initConversationManager, scheduleAutonomousConversation } from "./family/conversationManager.js";
import { scheduleGreetings } from "./family/greetings.js";
import { scheduleTattle } from "./family/tattle.js";
import { initGiveawayManager } from "./giveaway/manager.js";

const client = createDiscordClient();

await registerCommands();

client.once("ready", () => {
  console.log(persona.texts.onlineLog(client.user.tag));
  client.user.setPresence({
    activities: [{ name: persona.presence.name, type: ActivityType.Playing }],
    status: "online"
  });
  initGiveawayManager(client);
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

if (GOOD_MORNING_ENABLED || GOOD_NIGHT_ENABLED) {
  console.log("Good morning/night greeting bật.");
  scheduleGreetings();
}

if (TATTLE_ENABLED) {
  console.log("Random tattle (mách lẻo) bật.");
  scheduleTattle();
}

process.on("unhandledRejection", err => console.error("UNHANDLED_REJECTION:", err));
process.on("uncaughtException", err => console.error("UNCAUGHT_EXCEPTION:", err));

client.login(DISCORD_TOKEN);
