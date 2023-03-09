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
import truncate from 'lodash/truncate';

import config from '@/config';
import { createActionRow, createRegenerateButton } from '@/lib/buttons';
import {
  destroyThread,
  generateChatMessages,
  validateMessage,
} from '@/lib/helpers';
import { CompletionStatus, createChatCompletion } from '@/lib/openai';
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

    try {
      await validateMessage(message);
    } catch (err) {
      await interaction.reply({
        content: (err as Error).message,
        ephemeral: true,
      });

      return;
    }

    const behavior = interaction.options.getString('behavior')?.trim();

    if (behavior) {
      try {
        await validateMessage(behavior, 'behavior');
      } catch (err) {
        await interaction.reply({
          content: (err as Error).message,
          ephemeral: true,
        });

        return;
      }
    }

    const channel = interaction.channel;

    if (!channel || !(channel instanceof TextChannel)) {
      await interaction.reply({
        content: "You can't start a conversation here.",
        ephemeral: true,
      });

      return;
    }

    const executed = rateLimiter.attempt(interaction.user.id, async () => {
      await interaction.deferReply();

      await interaction.editReply({
        embeds: [getThreadCreatingEmbed(interaction.user, message!, behavior)],
      });

      const completion = await createChatCompletion(
        generateChatMessages(message!, behavior)
      );

      if (completion.status !== CompletionStatus.Ok) {
        await interaction.editReply({
          embeds: [
            getErrorEmbed(
              interaction.user,
              message!,
              behavior,
              completion.message
            ),
          ],
        });

        return;
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

        const pruneInterval = Math.ceil(Number(config.bot.prune_interval));

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

        await thread.send({
          embeds: [
            new EmbedBuilder().setColor(Colors.Blue).setFields([
              { name: 'Message', value: message! },
              { name: 'Behavior', value: behavior || 'Default' },
            ]),
          ],
        });

        await thread.members.add(interaction.user);

        await thread.send({
          content: completion.message,
          components: [createActionRow(createRegenerateButton())],
        });

        await interaction.editReply({
          embeds: [
            getThreadCreatedEmbed(thread, interaction.user, message!, behavior),
          ],
        });
      } catch (err) {
        console.error(err);

        await interaction.editReply({
          embeds: [getErrorEmbed(interaction.user, message!, behavior)],
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
  return new EmbedBuilder()
    .setColor(Colors.Green)
    .setDescription(`<@${user.id}> has started a conversation! 💬`)
    .setFields([
      { name: 'Message', value: message },
      { name: 'Behavior', value: behavior || 'Default' },
    ]);
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

function getErrorEmbed(
  user: User,
  message: string,
  behavior?: string,
  error?: string
): EmbedBuilder {
  return getBaseEmbed(user, message, behavior)
    .setColor(Colors.Red)
    .setTitle('There was an error while creating a thread')
    .addFields({ name: 'Error', value: error || 'Unknown' });
}
