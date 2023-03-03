import { Events } from 'discord.js';

import config from '../config.js';

export const name = Events.ClientReady;
export const once = true;

export function execute(client) {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log(
    `You can invite this bot with the following URL: ${config.bot.invite_url}`
  );
}
