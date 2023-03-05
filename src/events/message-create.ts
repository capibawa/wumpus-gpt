import { DiscordEvent } from 'discord-module-loader';
import { Client, DMChannel, Events, Message, ThreadChannel } from 'discord.js';
import { ChatCompletionRequestMessage } from 'openai';

import { getChatResponse } from '@/lib/openai';

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
