import ModuleLoader from '@biscxit/discord-module-loader';
import { Client, GatewayIntentBits } from 'discord.js';

import config from '@/config';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const moduleLoader = new ModuleLoader(client);

client.on('ready', async () => {
  if (!client.user || !client.application) {
    return;
  }

  try {
    await moduleLoader.loadEvents('src/events');
    await moduleLoader.loadCommands('src/commands');
    await moduleLoader.updateSlashCommands();
  } catch (err) {
    console.error(err);
  }

  console.log(`Logged in as ${client.user.tag}!`);
  console.log(
    `You can invite this bot with the following URL: ${config.bot.invite_url}`
  );
});

client.login(config.discord.token);
