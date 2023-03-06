import { DiscordCommand } from 'discord-module-loader';
import {
  ApplicationCommandOptionType,
  Colors,
  EmbedBuilder,
  Interaction,
  TextChannel,
  ThreadChannel,
  User,
} from 'discord.js';

import config from '@/config';
import { destroyThread, limit } from '@/lib/helpers';
import { getChatResponse } from '@/lib/openai';
import { RateLimiter } from '@/lib/rate-limiter';
import Conversation from '@/models/conversation';

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
        embeds: [getThreadCreatingEmbed(interaction.user, message)],
      });

      let response = null;

      try {
        // TODO: Proper error handling.
        response = await getChatResponse([{ role: 'user', content: message }]);
      } catch (err) {
        if (err instanceof Error) {
          // We wouldn't need to do this if `getChatResponse` had proper error handling.
          const isModerated = err.message.includes('moderation');

          await interaction.editReply({
            embeds: [
              isModerated
                ? getModeratedEmbed(interaction.user, message)
                : getErrorEmbed(interaction.user, message),
            ],
          });

          return;
        }

        throw err;
      }

      try {
        const thread = await channel.threads.create({
          name: `💬 ${interaction.user.username} - ${limit(message, 50)}`,
          autoArchiveDuration: 60,
          reason: config.bot.name,
          rateLimitPerUser: 1,
        });

        try {
          const pruneInterval = Math.ceil(config.bot.prune_interval as number);

          await Conversation.create({
            interactionId: (await interaction.fetchReply()).id,
            threadId: thread.id,
            expiresAt:
              pruneInterval > 0
                ? new Date(Date.now() + 3600000 * pruneInterval)
                : null,
          });
        } catch (err) {
          await destroyThread(thread);

          throw err;
        }

        await thread.members.add(interaction.user);

        await thread.send(response);

        await interaction.editReply({
          embeds: [getThreadCreatedEmbed(interaction.user, message, thread)],
        });
      } catch (err) {
        console.error(err);

        await interaction.editReply({
          embeds: [getErrorEmbed(interaction.user, message)],
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

function getBaseEmbed(user: User, message: string) {
  return new EmbedBuilder()
    .setColor(Colors.Green)
    .setDescription(`<@${user.id}> has started a conversation! 💬`)
    .setFields({ name: 'Message', value: message });
}

function getThreadCreatingEmbed(user: User, message: string): EmbedBuilder {
  return getBaseEmbed(user, message).addFields({
    name: 'Thread',
    value: 'Creating...',
  });
}

function getThreadCreatedEmbed(
  user: User,
  message: string,
  thread: ThreadChannel
): EmbedBuilder {
  return getBaseEmbed(user, message).addFields({
    name: 'Thread',
    value: thread.toString(),
  });
}

function getModeratedEmbed(user: User, message: string): EmbedBuilder {
  return getBaseEmbed(user, message)
    .setColor(Colors.DarkRed)
    .setTitle('Your message has been blocked by moderation.')
    .setFields({ name: 'Message', value: 'REDACTED' });
}

function getErrorEmbed(user: User, message: string): EmbedBuilder {
  return getBaseEmbed(user, message)
    .setColor(Colors.Red)
    .setTitle('There was an error while creating a thread.');
}
