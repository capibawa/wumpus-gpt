import { DiscordEvent } from 'discord-module-loader';
import { Client, DMChannel, Events, Message, ThreadChannel } from 'discord.js';
import { ChatCompletionRequestMessage } from 'openai';

import config from '@/config';
import { getChatResponse } from '@/lib/openai';
import Conversation from '@/models/conversation';

// TODO: Retain previous messages with constraints (e.g. 10 messages max).
async function handleDirectMessage(
  client: Client<true>,
  channel: DMChannel,
  message: Message
) {
  await channel.sendTyping();

  try {
    const response = await getChatResponse([
      { role: 'user', content: message.content },
    ]);

    await channel.send(response);
  } catch (err) {
    if (err instanceof Error) {
      await message.reply(err.message);
    }
  }
}

async function handleChatMessage(
  client: Client<true>,
  channel: ThreadChannel,
  message: Message
) {
  if (channel.ownerId !== client.user.id) {
    return;
  }

  if (channel.archived || channel.locked || !channel.name.startsWith('💬')) {
    return;
  }

  await channel.sendTyping();

  const messages = await channel.messages.fetch();

  const parsedMessages = messages
    .filter((message) => message.content)
    .map((message) => {
      return {
        role: message.author.id === client.user.id ? 'assistant' : 'user',
        content: message.content,
      };
    })
    .reverse();

  try {
    const response = await getChatResponse(
      parsedMessages as Array<ChatCompletionRequestMessage>
    );

    await channel.send(response);
  } catch (err) {
    if (err instanceof Error) {
      await messages.first()?.reply(err.message);

      // Mark conversation as expired if the error is due to token limits.
      const pruneInterval = Math.ceil(config.bot.prune_interval as number);

      if (err.message.includes('token') && pruneInterval > 0) {
        const conversation = await Conversation.findOne({
          where: { threadId: channel.id },
        });

        if (!conversation || conversation.get('expiresAt')) {
          return;
        }

        await conversation.update({
          expiresAt: new Date(Date.now() + 3600000 * pruneInterval),
        });
      }
    }
  }
}

export default new DiscordEvent(
  Events.MessageCreate,
  async (message: Message) => {
    const client = message.client;

    if (message.author.id === client.user.id) {
      return;
    }

    const channel = message.channel;

    if (channel.isThread()) {
      handleChatMessage(client, channel, message);
    } else if (channel.isDMBased()) {
      handleDirectMessage(client, channel as DMChannel, message);
    }
  }
);
