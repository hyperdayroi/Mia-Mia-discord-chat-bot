import { Client, GatewayIntentBits } from "discord.js";

export function createDiscordClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildEmojisAndStickers,
      GatewayIntentBits.GuildVoiceStates, // bắt buộc để bot join/nghe được voice channel
      GatewayIntentBits.GuildMembers // bắt buộc để nhận sự kiện member mới join (welcome)
    ]
  });
}
