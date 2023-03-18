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
      prompt: interaction.options.getString('prompt') ?? '',
      hidden: interaction.options.getBoolean('hidden') ?? false,
    };

    if (!input.prompt) {
      await interaction.reply({
        content: 'You must provide a prompt.',
        ephemeral: true,
      });

      return;
    }

    const executed = rateLimiter.attempt(interaction.user.id, async () => {
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
    });

    if (!executed) {
      await interaction.reply({
        content: 'You are currently being rate limited.',
        ephemeral: true,
      });
    }
  },
});
