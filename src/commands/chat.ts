import { Command } from '@biscxit/discord-module-loader';
import {
  ChannelType,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  PermissionsBitField,
  RESTJSONErrorCodes,
  SlashCommandBuilder,
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
  buildContext,
  destroyThread,
  getThreadPrefix,
  isApiError,
} from '@/lib/helpers';
import {
  CompletionStatus,
  createChatCompletion,
  generateTitle,
} from '@/lib/openai';
import Conversation from '@/models/conversation';

export default new Command({
  data: new SlashCommandBuilder()
    .setName('chat')
    .setDescription('Start a conversation!')
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('The message to start the conversation with.')
        .setRequired(true)
        .setMaxLength(1024)
    )
    .addStringOption((option) =>
      option
        .setName('behavior')
        .setDescription('Specify how the bot should behave.')
        .setMaxLength(1024)
    )
    .setDMPermission(false),
  botPermissions: [
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.SendMessagesInThreads,
    PermissionsBitField.Flags.CreatePublicThreads,
    PermissionsBitField.Flags.CreatePrivateThreads,
    // PermissionsBitField.Flags.ManageMessages,
    PermissionsBitField.Flags.ManageThreads,
    PermissionsBitField.Flags.ReadMessageHistory,
  ],
  rateLimiter: {
    points: 3,
    duration: 60,
  },
  execute: async (interaction: ChatInputCommandInteraction) => {
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

    try {
      await interaction.reply({
        embeds: [
          createThreadEmbed(interaction.user, input.message, input.behavior),
        ],
      });

      const completion = await createChatCompletion(
        buildContext([], input.message, input.behavior)
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

      const thread = await channel.threads.create({
        name: truncate(getThreadPrefix() + input.message, { length: 100 }),
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
            new EmbedBuilder()
              .setColor(Colors.Blue)
              .setFields([
                { name: 'Message', value: input.message },
                { name: 'Behavior', value: input.behavior || 'Default' },
              ])
              .setFooter({
                text: 'Deleting this message will break the conversation!',
              }),
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

      const title = await generateTitle(input.message, completion.message);

      if (title) {
        await thread.edit({ name: getThreadPrefix() + title });
      }
    } catch (err) {
      let error = undefined;

      if (isApiError(err)) {
        if (
          err.code === RESTJSONErrorCodes.MissingAccess ||
          err.code === RESTJSONErrorCodes.MissingPermissions
        ) {
          error =
            'Missing permissions. Make sure that the bot can create/manage threads, and send messages in threads.';
        }
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
  },
});
