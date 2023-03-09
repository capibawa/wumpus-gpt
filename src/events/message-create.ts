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

import { createActionRow, createRegenerateButton } from '@/lib/buttons';
import {
  detachComponents,
  generateAllChatMessages,
  generateChatMessages,
  validateMessage,
} from '@/lib/helpers';
import { CompletionStatus, createChatCompletion } from '@/lib/openai';

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
    await handleFailedRequest(channel, message, err as Error);

    return;
  }

  delay(async () => {
    if (isLastMessageStale(message, channel.lastMessage, client.user.id)) {
      return;
    }

    await channel.sendTyping();

    const threadMessages = await channel.messages.fetch({ before: message.id });

    const completion = await createChatCompletion(
      generateAllChatMessages(message, threadMessages, client.user.id)
    );

    if (completion.status !== CompletionStatus.Ok) {
      await handleFailedRequest(channel, message, completion.message);

      return;
    }

    if (isLastMessageStale(message, channel.lastMessage, client.user.id)) {
      return;
    }

    await detachComponents(threadMessages);

    await channel.send({
      content: completion.message,
      components: [createActionRow(createRegenerateButton())],
    });
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

  const completion = await createChatCompletion(generateChatMessages(message));

  if (completion.status !== CompletionStatus.Ok) {
    await message.reply(completion.message);

    return;
  }

  await channel.send(completion.message);
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

  const embed = await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('Failed to generate a resposne')
        .setDescription(error instanceof Error ? error.message : error)
        .setFields({ name: 'Message', value: messageContent }),
    ],
  });

  delay(async () => {
    await embed.delete();
  }, 5000);
}
