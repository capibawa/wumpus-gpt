import ModuleLoader from '@biscxit/discord-module-loader';
import {
  Client,
  Colors,
  EmbedBuilder,
  GatewayIntentBits,
  Snowflake,
  ThreadChannel,
} from 'discord.js';
import { Op } from 'sequelize';
import { AsyncTask, SimpleIntervalJob, ToadScheduler } from 'toad-scheduler';

import config from '@/config';
import sequelize from '@/lib/sequelize';
import Conversation from '@/models/conversation';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const moduleLoader = new ModuleLoader(client);

const scheduler = new ToadScheduler();

client.on('ready', async () => {
  if (!client.user || !client.application) {
    return;
  }

  try {
    await sequelize.authenticate();

    await Conversation.sync();
  } catch (err) {
    console.error('Unable to connect to the database:', err);

    process.exit(1);
  }

  try {
    await moduleLoader.loadEvents('src/events');
    await moduleLoader.loadCommands('src/commands');
    await moduleLoader.updateSlashCommands();
  } catch (err) {
    console.error(err);

    process.exit(1);
  }

  const task = new AsyncTask(
    'prune-conversations',
    async () => {
      try {
        const conversations = await Conversation.findAll({
          where: {
            expiresAt: {
              [Op.ne]: null,
              [Op.lt]: new Date(),
            },
          },
        });

        conversations.forEach(async (conversation) => {
          const thread = (await client.channels.fetch(
            conversation.get('threadId') as Snowflake
          )) as ThreadChannel;

          if (thread) {
            const interaction = await thread.parent?.messages.fetch(
              conversation.get('interactionId') as Snowflake
            );

            if (interaction && interaction.embeds.length > 0) {
              const embed = interaction.embeds[0];

              await interaction?.edit({
                embeds: [
                  new EmbedBuilder()
                    .setColor(Colors.Yellow)
                    .setTitle('Conversation deleted due to inactivity.')
                    .setDescription(embed.description)
                    .addFields(embed.fields),
                ],
              });
            }

            await (await thread.fetchStarterMessage())?.delete();
            await thread.delete();
          }

          await conversation.destroy();
        });

        console.log(`Pruned ${conversations.length} expired conversations.`);
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

client.login(config.discord.token);
