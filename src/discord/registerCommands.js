import { REST, Routes } from "discord.js";
import { DISCORD_TOKEN, CLIENT_ID } from "../config/env.js";
import { commands } from "./commands.js";

export async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
}
