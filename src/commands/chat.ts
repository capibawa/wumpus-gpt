import { DiscordCommand } from 'discord-module-loader';
import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';

import config from '@/config';
import { limit } from '@/lib/helpers';
import { getChatResponse } from '@/lib/openai';
import Conversation from '@/models/conversation';

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
  execute: async (interaction: ChatInputCommandInteraction) => {
    const channel = interaction.channel as TextChannel;

    if (!channel) {
      await interaction.reply({
        content: 'There was an error while executing this command!',
        ephemeral: true,
      });

      return;
    }

    if (channel.isThread()) {
      await interaction.reply({
        content: "You can't start a conversation in a thread!",
        ephemeral: true,
      });

      return;
    } else if (channel.isDMBased()) {
      await interaction.reply({
        content: "You can't start a conversation in a DM!",
        ephemeral: true,
      });

      return;
    }

    const message = interaction.options.getString('message');

    if (!message || message.length === 0) {
      await interaction.reply({
        content: 'You must provide a message to start a conversation!',
        ephemeral: true,
      });

      return;
    }

    const user = interaction.user;

    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setDescription(`<@${user.id}> has started a conversation! 💬`)
      .setFields([
        { name: 'Message', value: message },
        { name: 'Thread', value: 'Creating...' },
      ]);

    await interaction.reply({ embeds: [embed] });

    let response = null;

    try {
      response = await getChatResponse([{ role: 'user', content: message }]);
    } catch (err) {
      if (err instanceof Error) {
        // TODO: Custom errors
        const isFlagged = err.message.includes('moderation');

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(isFlagged ? Colors.DarkRed : Colors.Orange)
              .setTitle(
                isFlagged
                  ? 'Your message has been blocked by moderation.'
                  : 'There was an error while creating a thread.'
              )
              .setDescription(`<@${user.id}> has started a conversation! 💬`)
              .addFields({
                name: 'Message',
                value: isFlagged ? 'REDACTED' : message,
              }),
          ],
        });
      }
    }

    if (!response) {
      return;
    }

    try {
      const thread = await channel.threads.create({
        name: `💬 ${user.username} - ${limit(message, 50)}`,
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
        await (await thread.fetchStarterMessage())?.delete();
        await thread.delete();

        throw err;
      }

      await thread.members.add(user);

      await thread.send(response);

      await interaction.editReply({
        embeds: [
          embed.setFields([
            { name: 'Message', value: message },
            { name: 'Thread', value: thread.toString() },
          ]),
        ],
      });
    } catch (err) {
      console.error(err);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('There was an error while creating a thread.')
            .setDescription(`<@${user.id}> has started a conversation! 💬`)
            .addFields({ name: 'Message', value: message }),
        ],
      });
    }
  },
});
