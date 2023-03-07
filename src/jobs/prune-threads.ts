import { Client, Colors, EmbedBuilder } from 'discord.js';

import { destroyThread } from '@/lib/helpers';
import prisma from '@/lib/prisma';

export default async function pruneThreads(
  client: Client<boolean>
): Promise<void> {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        expiresAt: {
          lte: new Date(),
        },
      },
    });

    for (const conversation of conversations) {
      const channel = client.channels.cache.get(conversation.channelId);

      if (channel && channel.isThread()) {
        const message = await channel.parent?.messages.fetch(
          conversation.interactionId
        );

        if (message && message.embeds.length > 0) {
          const embed = message.embeds[0];

          await message.edit({
            embeds: [
              new EmbedBuilder()
                .setColor(Colors.Yellow)
                .setTitle('Conversation deleted due to inactivity')
                .setDescription(embed.description)
                .setFields(embed.fields[0]),
            ],
          });
        }

        await destroyThread(channel);
      }

      await prisma.conversation.delete({
        where: {
          id: conversation.id,
        },
      });
    }

    if (conversations.length > 0) {
      console.log(`Pruned ${conversations.length} expired conversations.`);
    }
  } catch (err) {
    console.error(err);
  }
}
