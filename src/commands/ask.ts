import { DiscordCommand } from 'discord-module-loader';
import { ApplicationCommandOptionType, Interaction } from 'discord.js';

import { createErrorEmbed } from '@/lib/embeds';
import { generateChatMessages } from '@/lib/helpers';
import { CompletionStatus, createChatCompletion } from '@/lib/openai';
import RateLimiter from '@/lib/rate-limiter';

const rateLimiter = new RateLimiter(3, 'minute');

export default new DiscordCommand({
  command: {
    name: 'ask',
    description: 'Ask anything!',
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'question',
        description: 'The question to ask the bot.',
        required: true,
        maxLength: 1024,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: 'behavior',
        description: 'Specify how the bot should behave.',
        maxLength: 1024,
      },
      {
        type: ApplicationCommandOptionType.Boolean,
        name: 'hidden',
        description: 'Whether or not the response should be shown.',
      },
    ],
  },
  execute: async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const input = {
      question: interaction.options.getString('question') ?? '',
      behavior: interaction.options.getString('behavior') ?? '',
      hidden: interaction.options.getBoolean('hidden') ?? false,
    };

    if (!input.question) {
      await interaction.reply({
        embeds: [createErrorEmbed('You must provide a question.')],
        ephemeral: true,
      });

      return;
    }

    const executed = rateLimiter.attempt(interaction.user.id, async () => {
      await interaction.deferReply({ ephemeral: input.hidden });

      const completion = await createChatCompletion(
        generateChatMessages(input.question, input.behavior)
      );

      await interaction.editReply(
        completion.status === CompletionStatus.Ok
          ? { content: completion.message }
          : { embeds: [createErrorEmbed(completion.message)] }
      );
    });

    if (!executed) {
      await interaction.reply({
        embeds: [createErrorEmbed('You are currently being rate limited.')],
        ephemeral: true,
      });
    }
  },
});
