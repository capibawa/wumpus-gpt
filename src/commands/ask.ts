import { Command } from '@biscxit/discord-module-loader';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

import { createErrorEmbed } from '@/lib/embeds';
import { buildContext } from '@/lib/helpers';
import { CompletionStatus, createChatCompletion } from '@/lib/openai';

export default new Command({
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask anything!')
    .addStringOption((option) =>
      option
        .setName('question')
        .setDescription('The question to ask the bot.')
        .setRequired(true)
        .setMaxLength(1024)
    )
    .addStringOption((option) =>
      option
        .setName('behavior')
        .setDescription('Specify how the bot should behave.')
        .setMaxLength(1024)
    )
    .addBooleanOption((option) =>
      option
        .setName('hidden')
        .setDescription('Whether or not the response should be shown.')
    ),
  rateLimiter: {
    points: 5,
    duration: 60,
  },
  execute: async (interaction: ChatInputCommandInteraction) => {
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

    await interaction.deferReply({ ephemeral: input.hidden });

    const completion = await createChatCompletion(
      buildContext([], input.question, input.behavior)
    );

    await interaction.editReply(
      completion.status === CompletionStatus.Ok
        ? { content: completion.message }
        : { embeds: [createErrorEmbed(completion.message)] }
    );
  },
});
