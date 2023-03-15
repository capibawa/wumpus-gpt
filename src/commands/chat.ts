import { DiscordCommand } from 'discord-module-loader';
import {
  ApplicationCommandOptionType,
  ChannelType,
  Colors,
  DiscordAPIError,
  EmbedBuilder,
  Interaction,
  ThreadChannel,
  User,
} from 'discord.js';
import truncate from 'lodash/truncate';

import config from '@/config';
import { createActionRow, createRegenerateButton } from '@/lib/buttons';
import { destroyThread, generateChatMessages } from '@/lib/helpers';
import { CompletionStatus, createChatCompletion } from '@/lib/openai';
import RateLimiter from '@/lib/rate-limiter';
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
        maxLength: 1024,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: 'behavior',
        description: 'Specify how the bot should behave.',
        maxLength: 1024,
      },
    ],
  },
  execute: async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const input = {
      message: interaction.options.getString('message')?.trim() ?? '',
      behavior: interaction.options.getString('behavior')?.trim() ?? '',
    };

    if (!input.message) {
      await interaction.reply({
        content: 'You must provide a message.',
        ephemeral: true,
      });

      return;
    }

    const channel = interaction.channel;

    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: "You can't start a conversation here.",
        ephemeral: true,
      });

      return;
    }

    const executed = rateLimiter.attempt(interaction.user.id, async () => {
      await interaction.deferReply();

      await interaction.editReply({
        embeds: [
          getThreadCreatingEmbed(
            interaction.user,
            input.message,
            input.behavior
          ),
        ],
      });

      const completion = await createChatCompletion(
        generateChatMessages(input.message, input.behavior)
      );

      if (completion.status !== CompletionStatus.Ok) {
        await interaction.editReply({
          embeds: [
            getErrorEmbed(
              interaction.user,
              input.message,
              input.behavior,
              completion.message
            ),
          ],
        });

        return;
      }

      try {
        const thread = await channel.threads.create({
          name: truncate(`💬 ${interaction.user.username} - ${input.message}`, {
            length: 100,
          }),
          autoArchiveDuration: 60,
          reason: config.bot.name,
          rateLimitPerUser: 1,
        });

        const pruneInterval = Number(config.bot.prune_interval);

        if (pruneInterval > 0) {
          try {
            await Conversation.create({
              interactionId: (await interaction.fetchReply()).id,
              channelId: thread.id,
              expiresAt: new Date(
                Date.now() + 3600000 * Math.ceil(pruneInterval)
              ),
            });
          } catch (err) {
            await destroyThread(thread);

            throw err;
          }
        }

        await thread.send({
          embeds: [
            new EmbedBuilder().setColor(Colors.Blue).setFields([
              { name: 'Message', value: input.message },
              { name: 'Behavior', value: input.behavior || 'Default' },
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
            getThreadCreatedEmbed(
              thread,
              interaction.user,
              input.message,
              input.behavior
            ),
          ],
        });
      } catch (err) {
        let error = undefined;

        // Missing Access
        if ((err as DiscordAPIError).code === 50001) {
          error = 'Missing permissions to create threads.';
        } else {
          console.error(err);
        }

        await interaction.editReply({
          embeds: [
            getErrorEmbed(
              interaction.user,
              input.message,
              input.behavior,
              error
            ),
          ],
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
  message = truncate(message, { length: 200 });
  behavior = behavior ? truncate(behavior, { length: 200 }) : undefined;

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
