import { Colors, EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import config from '../config.js';
import { getChatResponse } from '../lib/completion.js';
import { limit } from '../lib/string.js';

export const data = new SlashCommandBuilder()
  .setName('chat')
  .setDescription('Start a conversation!')
  .addStringOption((option) =>
    option
      .setName('message')
      .setDescription('The message to start the conversation with.')
      .setRequired(true)
  );

export async function execute(interaction) {
  const channel = interaction.channel;

  if (channel.isThread()) {
    await interaction.reply({
      content: "You can't start a conversation in a thread!",
      ephemeral: true,
    });

    return;
  }

  const user = interaction.user;
  const message = interaction.options.getString('message');

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setDescription(`<@${user.id}> has started a conversation! 💬`)
    .addFields({ name: 'Message', value: message });

  await interaction.reply({ embeds: [embed] });

  const thread = await channel.threads.create({
    name: `💬 ${user.username} - ${limit(message, 50)}`,
    autoArchiveDuration: 60,
    reason: config.bot.name,
    rateLimitPerUser: 1,
  });

  await thread.members.add(user);

  await thread.sendTyping();

  const response = await getChatResponse([{ role: 'user', content: message }]);

  await thread.send({ content: response });
}
