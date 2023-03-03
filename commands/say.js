import { SlashCommandBuilder } from 'discord.js';

import { getChatResponse } from '../lib/completion.js';

export const data = new SlashCommandBuilder()
  .setName('say')
  .setDescription('Say or ask anything!')
  .addStringOption((option) =>
    option
      .setName('message')
      .setDescription('The message to say to the bot.')
      .setRequired(true)
  );

export async function execute(interaction) {
  const message = interaction.options.getString('message');

  await interaction.deferReply();

  const response = await getChatResponse([{ role: 'user', content: message }]);

  await interaction.editReply(response);
}
