import { DiscordCommand } from '@biscxit/discord-module-loader';
import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';

import config from '@/config';
import { getChatResponse } from '@/lib/completion';
import { limit } from '@/lib/helpers';

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
      .addFields({ name: 'Message', value: message });

    await interaction.reply({ embeds: [embed] });

    const thread = await channel.threads.create({
      name: `💬 ${user.username} - ${limit(message, 50)}`,
      autoArchiveDuration: 60,
      reason: config.bot.name,
      rateLimitPerUser: 1,
    });

    await thread.members.add(user);

    await thread.sendTyping();

    const response = await getChatResponse([
      { role: 'user', content: message },
    ]);

    if (!response) {
      await interaction.reply({
        content: 'There was an error while processing a response!',
        ephemeral: true,
      });

      return;
    }

    await thread.send(response);
  },
});
