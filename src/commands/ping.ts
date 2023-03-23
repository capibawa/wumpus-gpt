import { Command } from '@biscxit/discord-module-loader';
import {
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';

export default new Command({
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
  execute: async (interaction: ChatInputCommandInteraction) => {
    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle('Pong!')
      .setDescription('Measuring ping...');

    const message = await interaction.reply({
      embeds: [embed],
      fetchReply: true,
    });

    const ping = message.createdTimestamp - interaction.createdTimestamp;

    await interaction.editReply({
      embeds: [embed.setDescription(`Took ${ping} ms.`)],
    });
  },
});
