import { DiscordCommand } from 'discord-module-loader';
import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
} from 'discord.js';

import { getChatResponse } from '@/lib/completion';

export default new DiscordCommand({
  command: {
    name: 'say',
    description: 'Say or ask anything!',
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

    const response = await getChatResponse([
      { role: 'user', content: message },
    ]);

    await interaction.editReply(
      response || 'There was an error while processing a response!'
    );
  },
});
