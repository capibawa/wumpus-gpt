import { DiscordCommand } from 'discord-module-loader';
import {
  APIEmbedField,
  ApplicationCommandOptionType,
  Colors,
  EmbedBuilder,
  Interaction,
  TextChannel,
  ThreadChannel,
  User,
} from 'discord.js';
import truncate from 'lodash/truncate';

import config from '@/config';
import { destroyThread, exceedsTokenLimit } from '@/lib/helpers';
import { getChatResponse, isTextFlagged } from '@/lib/openai';
import prisma from '@/lib/prisma';
import { RateLimiter } from '@/lib/rate-limiter';

// Limited to 5 executions per 15 minutes.
const rateLimiter = new RateLimiter(5, 900000);

export default new DiscordCommand({
  command: {
    name: 'chat',
    description: 'Start a conversation!',
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'message',
        description: 'The message to start the conversation with.',
        required: true,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: 'behavior',
        description: 'Specify how the bot should behave.',
      },
    ],
  },
  execute: async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const message = interaction.options.getString('message')?.trim();

    if (!message || message.length === 0) {
      await interaction.reply({
        content: 'You must provide a message to start a conversation!',
        ephemeral: true,
      });

      return;
    }

    if (exceedsTokenLimit(message)) {
      await interaction.reply({
        content: 'Your message is too long, try shortening it!',
        ephemeral: true,
      });

      return;
    }

    const behavior = interaction.options.getString('behavior')?.trim();

    if (behavior && (await isTextFlagged(behavior))) {
      await interaction.reply({
        content: 'Your behavior has been blocked by moderation!',
        ephemeral: true,
      });

      return;
    }

    const channel = interaction.channel;

    if (!channel) {
      await interaction.reply({
        content: 'There was an error while executing this command!',
        ephemeral: true,
      });

      return;
    }

    if (!(channel instanceof TextChannel)) {
      await interaction.reply({
        content: "You can't start a conversation here!",
        ephemeral: true,
      });

      return;
    }

    const executed = rateLimiter.attempt(interaction.user.id, async () => {
      await interaction.reply({
        embeds: [getThreadCreatingEmbed(interaction.user, message, behavior)],
      });

      let response = null;

      try {
        // TODO: Proper error handling.
        response = await getChatResponse(
          [{ role: 'user', content: message }],
          behavior
        );
      } catch (err) {
        if (err instanceof Error) {
          // We wouldn't need to do this if `getChatResponse` had proper error handling.
          const isModerated = err.message.includes('moderation');

          await interaction.editReply({
            embeds: [
              isModerated
                ? getModeratedEmbed(interaction.user, message, behavior)
                : getErrorEmbed(interaction.user, message, behavior),
            ],
          });

          return;
        }

        throw err;
      }

      try {
        const thread = await channel.threads.create({
          name: truncate(`💬 ${interaction.user.username} - ${message}`, {
            length: 100,
          }),
          autoArchiveDuration: 60,
          reason: config.bot.name,
          rateLimitPerUser: 1,
        });

        const pruneInterval = Math.ceil(config.bot.prune_interval as number);

        if (pruneInterval > 0) {
          try {
            await prisma.conversation.create({
              data: {
                interactionId: (await interaction.fetchReply()).id,
                channelId: thread.id,
                expiresAt: new Date(Date.now() + 3600000 * pruneInterval),
              },
            });
          } catch (err) {
            await destroyThread(thread);

            throw err;
          }
        }

        if (behavior) {
          await thread.send(`Behavior: ${behavior}`);
        }

        // Note: This also sends a message to the thread.
        await thread.members.add(interaction.user);

        await thread.send(response);

        await interaction.editReply({
          embeds: [
            getThreadCreatedEmbed(thread, interaction.user, message, behavior),
          ],
        });
      } catch (err) {
        console.error(err);

        await interaction.editReply({
          embeds: [getErrorEmbed(interaction.user, message, behavior)],
        });
      }
    });

    if (!executed) {
      await interaction.reply({
        content: 'You are currently being rate limited.',
        ephemeral: true,
      });
    }
  },
});

function getBaseEmbed(
  user: User,
  message: string,
  behavior?: string
): EmbedBuilder {
  const fields: Array<APIEmbedField> = [{ name: 'Message', value: message }];

  if (behavior) {
    fields.push({ name: 'Behavior', value: behavior });
  }

  return new EmbedBuilder()
    .setColor(Colors.Green)
    .setDescription(`<@${user.id}> has started a conversation! 💬`)
    .setFields(fields);
}

function getThreadCreatingEmbed(
  user: User,
  message: string,
  behavior?: string
): EmbedBuilder {
  return getBaseEmbed(user, message, behavior).addFields({
    name: 'Thread',
    value: 'Creating...',
  });
}

function getThreadCreatedEmbed(
  thread: ThreadChannel,
  user: User,
  message: string,
  behavior?: string
): EmbedBuilder {
  return getBaseEmbed(user, message, behavior).addFields({
    name: 'Thread',
    value: thread.toString(),
  });
}

function getModeratedEmbed(
  user: User,
  message: string,
  behavior?: string
): EmbedBuilder {
  return getBaseEmbed(user, message, behavior)
    .setColor(Colors.DarkRed)
    .setTitle('Your message has been blocked by moderation');
}

function getErrorEmbed(
  user: User,
  message: string,
  behavior?: string
): EmbedBuilder {
  return getBaseEmbed(user, message, behavior)
    .setColor(Colors.Red)
    .setTitle('There was an error while creating a thread');
}
