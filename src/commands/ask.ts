import { DiscordCommand } from 'discord-module-loader';
import { ApplicationCommandOptionType, Interaction } from 'discord.js';

import { exceedsTokenLimit } from '@/lib/helpers';
import { getChatResponse, isTextFlagged } from '@/lib/openai';
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

    const behavior = interaction.options.getString('behavior')?.trim();

    if (behavior && (await isTextFlagged(behavior))) {
      await interaction.reply({
        content: 'Your behavior has been blocked by moderation!',
        ephemeral: true,
      });

      return;
    }

    const executed = rateLimiter.attempt(interaction.user.id, async () => {
      await interaction.deferReply();

      try {
        const response = await getChatResponse(
          [{ role: 'user', content: message }],
          behavior
        );

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
