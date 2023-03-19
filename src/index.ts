import Cron from 'croner';
import ModuleLoader from 'discord-module-loader';
import { Client, GatewayIntentBits } from 'discord.js';
import path from 'path';

import config from '@/config';
import pruneThreads from '@/jobs/prune-threads';
import sequelize from '@/lib/sequelize';
import Conversation from '@/models/conversation';

const isDev = process.argv[0].includes('ts-node');
const modulesDir = isDev ? '../.ts-node' : '../dist';

if (isDev) {
  // Force modules to be emitted during development, as the
  // current module loader does not detect TypeScript files.
  require('@/load-modules');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    // GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  // partials: [Partials.Channel],
});

client.on('ready', async () => {
  if (!client.user || !client.application) {
    return;
  }

  const moduleLoader = new ModuleLoader(client);

  const commands = await moduleLoader.loadCommands(
    path.join(__dirname, modulesDir, 'commands')
  );

  if (commands.length > 0) {
    console.log(
      `Loaded ${commands.length} commands:`,
      commands.map((command) => command[0])
    );
  } else {
    console.warn('No commands were found.');
  }

  const events = await moduleLoader.loadEvents(
    path.join(__dirname, modulesDir, 'events')
  );

  if (events.length > 0) {
    console.log(
      `Loaded ${events.length} events:`,
      events.map((event) => event[0])
    );
  } else {
    console.warn('No events were found.');
  }

  await moduleLoader.updateSlashCommands();

  const job = Cron('* * * * *', async () => {
    await pruneThreads(client);
  });

  console.log(`\nLogged in as ${client.user.tag}!`);
  console.log(
    `You can invite this bot with the following URL: ${config.bot.invite_url}\n`
  );

  await job.trigger();
});

sequelize
  .authenticate()
  .then(async () => {
    await Conversation.sync();

    await client.login(config.discord.token);
  })
  .catch((err) => {
    console.error('Unable to connect to the database:', err);
  });
