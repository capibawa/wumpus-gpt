import { Colors, EmbedBuilder, ThreadChannel, User } from 'discord.js';
import { truncate } from 'lodash';

export function createErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle('An error has occurred')
    .setDescription(message);
}

export function createThreadEmbed(
  user: User,
  message: string,
  behavior?: string,
  thread?: ThreadChannel
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle(truncate(message, { length: 200 }))
    .setDescription(`<@${user.id}> has started a conversation!`)
    .setFields({ name: 'Behavior', value: behavior || 'Default' });

  if (thread) {
    embed.addFields({ name: 'Thread', value: thread.toString() });
  } else {
    embed.setFooter({ text: 'Generating response...' });
  }

  return embed;
}

export function createThreadErrorEmbed(
  user: User,
  message: string,
  behavior?: string,
  error?: string
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle(truncate(message, { length: 200 }))
    .setDescription(`<@${user.id}> has started a conversation!`)
    .setFields([
      { name: 'Behavior', value: behavior || 'Default' },
      { name: 'Error', value: error || 'Unknown' },
    ]);
}
