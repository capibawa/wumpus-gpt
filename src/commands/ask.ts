import { DiscordCommand } from 'discord-module-loader';
import { ApplicationCommandOptionType, Interaction } from 'discord.js';
import { truncate } from 'lodash';

import { generateChatMessages, validateMessage } from '@/lib/helpers';
import { CompletionStatus, createChatCompletion } from '@/lib/openai';
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

    try {
      await validateMessage(message);
    } catch (err) {
      await interaction.reply({
        content: (err as Error).message,
        ephemeral: true,
      });

      return;
    }

    const behavior = interaction.options.getString('behavior')?.trim();

    if (behavior) {
      try {
        await validateMessage(behavior, 'behavior');
      } catch (err) {
        await interaction.reply({
          content: (err as Error).message,
          ephemeral: true,
        });

        return;
      }
    }

    const executed = rateLimiter.attempt(interaction.user.id, async () => {
      await interaction.deferReply();

      const completion = await createChatCompletion(
        generateChatMessages(message!, behavior)
      );

      await interaction.editReply(
        completion.status === CompletionStatus.Ok
          ? truncate(completion.message!, { length: 2000 })
          : completion.message
      );
    });

    if (!executed) {
      await interaction.reply({
        content: 'You are currently being rate limited.',
        ephemeral: true,
      });
    }
  },
});
