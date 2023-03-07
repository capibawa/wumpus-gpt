import { DiscordEvent } from 'discord-module-loader';
import {
  Client,
  Colors,
  DMChannel,
  EmbedBuilder,
  Events,
  Message,
  MessageType,
  ThreadChannel,
} from 'discord.js';
import { delay, isEmpty, truncate } from 'lodash';

import {
  generateAllChatMessages,
  generateChatMessages,
  splitMessages,
  validateMessage,
} from '@/lib/helpers';
import { createChatCompletion } from '@/lib/openai';

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

  try {
    await validateMessage(message);
  } catch (err) {
    handleFailedRequest(channel, message, err as Error);

    return;
  }

  delay(async () => {
    if (isLastMessageStale(message, channel.lastMessage, client.user.id)) {
      return;
    }

    await channel.sendTyping();

    const messages = await channel.messages.fetch({ before: message.id });

    const response = await createChatCompletion(
      generateAllChatMessages(message, messages, client.user.id)
    );

    if (!response) {
      handleFailedRequest(
        channel,
        message,
        'An unexpected error has occurred.'
      );

      return;
    }

    if (isLastMessageStale(message, channel.lastMessage, client.user.id)) {
      return;
    }

    for (const message of splitMessages(response)) {
      await channel.send(message);
    }
  }, 2000);
}

// TODO: Retain previous messages with constraints (e.g. 10 messages max).
async function handleDirectMessage(
  client: Client<true>,
  channel: DMChannel,
  message: Message
) {
  try {
    await validateMessage(message);
  } catch (err) {
    await message.reply((err as Error).message);

    return;
  }

  await channel.sendTyping();

  const response = await createChatCompletion(generateChatMessages(message));

  if (!response) {
    await message.reply('There was an error while processing your response.');

    return;
  }

  for (const message of splitMessages(response)) {
    await channel.send(message);
  }
}

export default new DiscordEvent(
  Events.MessageCreate,
  async (message: Message) => {
    const client = message.client;

    if (
      message.author.id === client.user.id ||
      message.type !== MessageType.Default ||
      !message.content ||
      !isEmpty(message.embeds) ||
      !isEmpty(message.mentions.members)
    ) {
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

function isLastMessageStale(
  message: Message,
  lastMessage: Message | null,
  botId: string
): boolean {
  return (
    lastMessage !== null &&
    lastMessage.id !== message.id &&
    lastMessage.author.id !== botId
  );
}

async function handleFailedRequest(
  channel: ThreadChannel,
  message: Message,
  error: string | Error
): Promise<void> {
  const messageContent = truncate(message.content, { length: 100 });

  await message.delete();

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('Unable to complete your request')
        .setDescription(error instanceof Error ? error.message : error)
        .setFields({ name: 'Message', value: messageContent }),
    ],
  });
}
