import { DiscordCommand } from 'discord-module-loader';
import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
} from 'discord.js';

import { getChatResponse } from '@/lib/openai';

export default new DiscordCommand({
  command: {
    name: 'ask',
    description: 'Ask anything!',
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'message',
        description: 'The message to say to the bot.',
        required: true,
      },
    ],
  },
  execute: async (interaction: ChatInputCommandInteraction) => {
    const message = interaction.options.getString('message');

    if (!message || message.length === 0) {
      await interaction.reply({
        content: 'You must provide a message to start a conversation!',
        ephemeral: true,
      });

      return;
    }

    await interaction.deferReply();

    try {
      const response = await getChatResponse([
        { role: 'user', content: message },
      ]);

      await interaction.editReply(response);
    } catch (err) {
      if (err instanceof Error) {
        await interaction.editReply(err.message);
      }
    }
  },
});
