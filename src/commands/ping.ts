import { DiscordCommand } from 'discord-module-loader';
import { Colors, EmbedBuilder, Interaction } from 'discord.js';

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

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle('Pong!')
          .setDescription(`Took ${ping} ms`),
      ],
    });
  },
});
