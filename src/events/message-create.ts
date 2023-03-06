import { DiscordEvent } from 'discord-module-loader';
import { Client, DMChannel, Events, Message, ThreadChannel } from 'discord.js';
import { ChatCompletionRequestMessage } from 'openai';

import { getChatResponse } from '@/lib/openai';

async function handleThreadMessage(
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

  const firstMessage = messages.last();
  const lastMessage = messages.first();

  // TODO: Improve behavior detection.
  const behavior = firstMessage?.content?.includes('Behavior: ')
    ? firstMessage.content.split('Behavior: ')[1]
    : undefined;

  const parsedMessages = messages
    .filter((message) => message.content)
    .map((message) => {
      return {
        role: message.author.id === client.user.id ? 'assistant' : 'user',
        content: message.content,
      };
    }) as Array<ChatCompletionRequestMessage>;

  if (behavior) {
    parsedMessages.pop();
  }

  try {
    const response = await getChatResponse(parsedMessages.reverse(), behavior);

    await channel.send(response);
  } catch (err) {
    if (err instanceof Error) {
      await lastMessage?.reply(err.message);

      if (err.message.includes('token')) {
        // Do something here because the token limit has been reached.
      }
    } else {
      await lastMessage?.reply(
        'There was an error while processing your response.'
      );
    }
  }
}

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
    await message.reply(
      err instanceof Error
        ? err.message
        : 'There was an error while processing your response.'
    );
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
      handleThreadMessage(client, channel, message);
    } else if (channel.isDMBased()) {
      handleDirectMessage(client, channel as DMChannel, message);
    }
  }
);
