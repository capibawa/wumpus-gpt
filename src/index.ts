import ModuleLoader from 'discord-module-loader';
import {
  Client,
  Colors,
  EmbedBuilder,
  GatewayIntentBits,
  Partials,
} from 'discord.js';
import path from 'path';
import { AsyncTask, SimpleIntervalJob, ToadScheduler } from 'toad-scheduler';

import config from '@/config';
import { destroyThread } from '@/lib/helpers';
import prisma from '@/lib/prisma';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    // GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const moduleLoader = new ModuleLoader(client);

const scheduler = new ToadScheduler();

client.on('ready', async () => {
  if (!client.user || !client.application) {
    return;
  }

  try {
    const isTsNode = process.argv[0].includes('ts-node');

    if (isTsNode) {
      require('./load-modules');
    }

    const modulesDir = isTsNode ? '.ts-node' : 'dist';

    const commandsPath = path.join(__dirname, `../${modulesDir}`, 'commands');
    const eventsPath = path.join(__dirname, `../${modulesDir}`, 'events');

    await moduleLoader.loadCommands(commandsPath);
    await moduleLoader.loadEvents(eventsPath);

    await moduleLoader.updateSlashCommands();
  } catch (err) {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }

  const task = new AsyncTask(
    'prune-conversations',
    async () => {
      try {
        const conversations = await prisma.conversation.findMany({
          where: {
            expiresAt: {
              lte: new Date(),
            },
          },
        });

        for (const conversation of conversations) {
          const channel = await client.channels.cache.get(
            conversation.channelId
          );

          if (channel && channel.isThread()) {
            const interaction = await channel.parent?.messages.fetch(
              conversation.interactionId
            );

            if (interaction && interaction.embeds.length > 0) {
              const embed = interaction.embeds[0];

              await interaction.edit({
                embeds: [
                  new EmbedBuilder()
                    .setColor(Colors.Yellow)
                    .setTitle('Conversation deleted due to inactivity.')
                    .setDescription(embed.description)
                    .setFields(embed.fields[0]),
                ],
              });
            }

            await destroyThread(channel);
          }

          await prisma.conversation.delete({
            where: {
              id: conversation.id,
            },
          });
        }

        if (conversations.length > 0) {
          console.log(`Pruned ${conversations.length} expired conversations.`);
        }
      } catch (err) {
        console.error(err);
      }
    },
    (err) => {
      console.error(err);
    }
  );

  const job = new SimpleIntervalJob(
    {
      minutes: 1,
      runImmediately: true,
    },
    task
  );

  scheduler.addSimpleIntervalJob(job);

  console.log(`Logged in as ${client.user.tag}!`);
  console.log(
    `You can invite this bot with the following URL: ${config.bot.invite_url}\n`
  );
});

prisma
  .$connect()
  .then(async () => {
    await client.login(process.env.DISCORD_TOKEN);
  })
  .catch((err) => {
    console.error(err);
  });
