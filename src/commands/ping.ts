import { DiscordCommand } from '@biscxit/discord-module-loader';
import { ChatInputCommandInteraction } from 'discord.js';

export default new DiscordCommand({
  command: {
    name: 'ping',
    description: 'Replies with Pong!',
  },
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.reply('Pong!');
  },
});
