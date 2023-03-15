import { DiscordCommand } from 'discord-module-loader';
import { ApplicationCommandOptionType, Interaction } from 'discord.js';

import { generateChatMessages } from '@/lib/helpers';
import { createChatCompletion } from '@/lib/openai';
import RateLimiter from '@/lib/rate-limiter';

const rateLimiter = new RateLimiter(5, 'minute');

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
      message: interaction.options.getString('message') ?? '',
      behavior: interaction.options.getString('behavior') ?? '',
    };

    if (!input.message) {
      await interaction.reply({
        content: 'You must provide a message.',
        ephemeral: true,
      });

      return;
    }

    const executed = rateLimiter.attempt(interaction.user.id, async () => {
      await interaction.deferReply();

      const completion = await createChatCompletion(
        generateChatMessages(input.message, input.behavior)
      );

      await interaction.editReply(completion.message);
    });

    if (!executed) {
      await interaction.reply({
        content: 'You are currently being rate limited.',
        ephemeral: true,
      });
    }
  },
});
