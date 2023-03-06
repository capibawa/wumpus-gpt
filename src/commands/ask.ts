import { DiscordCommand } from 'discord-module-loader';
import { ApplicationCommandOptionType, Interaction } from 'discord.js';

import { exceedsTokenLimit } from '@/lib/helpers';
import { getChatResponse } from '@/lib/openai';
import { RateLimiter } from '@/lib/rate-limiter';

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

    if (exceedsTokenLimit(message)) {
      await interaction.reply({
        content: 'Your message is too long, try shortening it!',
        ephemeral: true,
      });

      return;
    }

    const executed = rateLimiter.attempt(interaction.user.id, async () => {
      await interaction.deferReply();

      try {
        const response = await getChatResponse([
          { role: 'user', content: message },
        ]);

        await interaction.editReply(response);
      } catch (err) {
        await interaction.editReply(
          err instanceof Error
            ? err.message
            : 'There was an error while processing your response.'
        );
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
