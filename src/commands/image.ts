import { Command } from '@biscxit/discord-module-loader';
import {
  ChatInputCommandInteraction,
  InteractionEditReplyOptions,
  SlashCommandBuilder,
} from 'discord.js';

import { createErrorEmbed } from '@/lib/embeds';
import { CompletionStatus, createImage } from '@/lib/openai';

export default new Command({
  data: new SlashCommandBuilder()
    .setName('image')
    .setDescription('Create an image given a prompt!')
    .addStringOption((option) =>
      option
        .setName('prompt')
        .setDescription('A text description of the desired image.')
        .setRequired(true)
        .setMaxLength(1000)
    )
    .addBooleanOption((option) =>
      option
        .setName('hidden')
        .setDescription('Whether or not the response should be shown.')
    ),
  rateLimiter: {
    points: 3,
    duration: 60,
  },
  execute: async (interaction: ChatInputCommandInteraction) => {
    const input = {
      prompt: interaction.options.getString('prompt') ?? '',
      hidden: interaction.options.getBoolean('hidden') ?? false,
    };

    if (!input.prompt) {
      await interaction.reply({
        embeds: [createErrorEmbed('You must provide a prompt.')],
        ephemeral: true,
      });

      return;
    }

    await interaction.deferReply({ ephemeral: input.hidden });

    const completion = await createImage(input.prompt);

    const messageOptions: InteractionEditReplyOptions = {};

    if (completion.status !== CompletionStatus.Ok) {
      messageOptions.content = completion.message;
    } else {
      messageOptions.files = [
        { attachment: completion.message, name: 'image.png' },
      ];
    }

    await interaction.editReply(messageOptions);
  },
});
