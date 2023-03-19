import { DiscordCommand } from 'discord-module-loader';
import {
  ApplicationCommandOptionType,
  ChannelType,
  Colors,
  DiscordAPIError,
  EmbedBuilder,
  Interaction,
  PermissionsBitField,
  RESTJSONErrorCodes,
  ThreadAutoArchiveDuration,
} from 'discord.js';
import { truncate } from 'lodash';

import config from '@/config';
import { createActionRow, createRegenerateButton } from '@/lib/buttons';
import {
  createErrorEmbed,
  createThreadEmbed,
  createThreadErrorEmbed,
} from '@/lib/embeds';
import {
  destroyThread,
  generateChatMessages,
  validatePermissions,
} from '@/lib/helpers';
import {
  CompletionStatus,
  createChatCompletion,
  createTitleFromMessages,
} from '@/lib/openai';
import RateLimiter from '@/lib/rate-limiter';
import Conversation from '@/models/conversation';

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

    const validator = validatePermissions(
      interaction.guild?.members.me?.permissions,
      [
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.SendMessagesInThreads,
        PermissionsBitField.Flags.CreatePublicThreads,
        PermissionsBitField.Flags.CreatePrivateThreads,
        // PermissionsBitField.Flags.ManageMessages,
        PermissionsBitField.Flags.ManageThreads,
        PermissionsBitField.Flags.ReadMessageHistory,
      ]
    );

    if (validator.fails) {
      await interaction.reply({
        embeds: [createErrorEmbed(validator.message)],
      });

      return;
    }

    const input = {
      message: interaction.options.getString('message') ?? '',
      behavior: interaction.options.getString('behavior') ?? '',
    };

    if (!input.message) {
      await interaction.reply({
        embeds: [createErrorEmbed('You must provide a message.')],
        ephemeral: true,
      });

      return;
    }

    const channel = interaction.channel;

    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({
        embeds: [createErrorEmbed("You can't start a conversation here.")],
        ephemeral: true,
      });

      return;
    }

    const executed = rateLimiter.attempt(interaction.user.id, async () => {
      await interaction.reply({
        embeds: [
          createThreadEmbed(interaction.user, input.message, input.behavior),
        ],
      });

      const completion = await createChatCompletion(
        generateChatMessages(input.message, input.behavior)
      );

      if (completion.status !== CompletionStatus.Ok) {
        await interaction.editReply({
          embeds: [
            createThreadErrorEmbed(
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
          name: truncate(`💬 ${input.message}`, { length: 100 }),
          autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
          reason: config.bot.name,
          rateLimitPerUser: 3,
        });

        try {
          const pruneInterval = Number(config.bot.prune_interval);

          await Conversation.create({
            channelId: thread.id,
            messageId: (await interaction.fetchReply()).id,
            expiresAt:
              pruneInterval > 0
                ? new Date(Date.now() + 3600000 * Math.ceil(pruneInterval))
                : null,
          });

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
              createThreadEmbed(
                interaction.user,
                input.message,
                input.behavior,
                thread
              ),
            ],
          });
        } catch (err) {
          await destroyThread(thread);

          throw err;
        }

        const title = await createTitleFromMessages(
          input.message,
          completion.message
        );

        if (title) {
          await thread.edit({ name: title });
        }
      } catch (err) {
        let error = undefined;

        if (
          err instanceof DiscordAPIError &&
          (err.code === RESTJSONErrorCodes.MissingAccess ||
            err.code === RESTJSONErrorCodes.MissingPermissions)
        ) {
          error =
            'Missing permissions. Ensure that the bot has the following: ' +
            `${validator.permissions.join(', ')}.`;
        } else {
          console.error(err);
        }

        await interaction.editReply({
          embeds: [
            createThreadErrorEmbed(
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
        embeds: [createErrorEmbed('You are currently being rate limited.')],
        ephemeral: true,
      });
    }
  },
});
