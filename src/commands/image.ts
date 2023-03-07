import { DiscordCommand } from 'discord-module-loader';
import { ApplicationCommandOptionType, Interaction } from 'discord.js';

import { createImage } from '@/lib/openai';
import { RateLimiter } from '@/lib/rate-limiter';

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
        maxLength: 1000,
        required: true,
      },
    ],
  },
  execute: async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const prompt = interaction.options.getString('prompt')?.trim();

    if (!prompt || prompt.length === 0) {
      await interaction.reply({
        content: 'You must provide a prompt to create an image!',
        ephemeral: true,
      });

      return;
    }

    if (prompt.length > 1000) {
      await interaction.reply({
        content: 'Your prompt is too long, try shortening it!',
        ephemeral: true,
      });

      return;
    }

    // if (await isTextFlagged(prompt)) {
    //   await interaction.reply({
    //     content: 'Your prompt has been blocked by moderation!',
    //     ephemeral: true,
    //   });

    //   return;
    // }

    const executed = rateLimiter.attempt(interaction.user.id, async () => {
      await interaction.deferReply();

      const imageUrl = await createImage(prompt);

      if (!imageUrl) {
        await interaction.editReply(
          'There was an error while processing your response.'
        );

        return;
      }

      await interaction.editReply({
        files: [
          {
            attachment: imageUrl,
            name: 'image.png',
          },
        ],
      });
    });

    if (!executed) {
      await interaction.reply({
        content: 'You are currently being rate limited.',
        ephemeral: true,
      });
    }
  },
});
