import { DiscordCommand } from 'discord-module-loader';
import {
  ApplicationCommandOptionType,
  Interaction,
  InteractionEditReplyOptions,
} from 'discord.js';

import { CompletionStatus, createImage } from '@/lib/openai';
import RateLimiter from '@/lib/rate-limiter';

const rateLimiter = new RateLimiter(1, 'minute');

export default new DiscordCommand({
  command: {
    name: 'image',
    description: 'Create an image given a prompt!',
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'prompt',
        description: 'A text description of the desired image.',
        required: true,
        maxLength: 1000,
      },
    ],
  },
  execute: async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const prompt = interaction.options.getString('prompt');

    if (!prompt) {
      await interaction.reply({
        content: 'You must provide a prompt.',
        ephemeral: true,
      });

      return;
    }

    const executed = rateLimiter.attempt(interaction.user.id, async () => {
      await interaction.deferReply();

      const completion = await createImage(prompt);

      const messageOptions: InteractionEditReplyOptions = {};

      if (completion.status !== CompletionStatus.Ok) {
        messageOptions.content = completion.message;
      } else {
        messageOptions.files = [
          { attachment: completion.message, name: 'image.png' },
        ];
      }

      await interaction.editReply(messageOptions);
    });

    if (!executed) {
      await interaction.reply({
        content: 'You are currently being rate limited.',
        ephemeral: true,
      });
    }
  },
});
