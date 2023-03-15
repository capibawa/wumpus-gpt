import { DiscordCommand } from 'discord-module-loader';
import { Interaction } from 'discord.js';

export default new DiscordCommand({
  command: {
    name: 'ping',
    description: 'Replies with Pong!',
  },
  execute: async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const ping = Math.abs(Date.now() - interaction.createdTimestamp);

    await interaction.reply(`Pong! \`Took ${ping}ms\``);
  },
});
