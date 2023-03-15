import { DiscordEvent } from 'discord-module-loader';
import {
  ChannelType,
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

import config from '@/config';
import { createActionRow, createRegenerateButton } from '@/lib/buttons';
import {
  detachComponents,
  generateAllChatMessages,
  generateChatMessages,
} from '@/lib/helpers';
import { CompletionStatus, createChatCompletion } from '@/lib/openai';
import Conversation from '@/models/conversation';

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

  delay(async () => {
    if (isLastMessageStale(message, channel.lastMessage, client.user.id)) {
      return;
    }

    const messages = await channel.messages.fetch({ before: message.id });

    await channel.sendTyping();

    const completion = await createChatCompletion(
      generateAllChatMessages(message, messages, client.user.id)
    );

    if (completion.status !== CompletionStatus.Ok) {
      await handleFailedRequest(
        channel,
        message,
        completion.message,
        completion.status === CompletionStatus.UnexpectedError
      );

      return;
    }

    if (isLastMessageStale(message, channel.lastMessage, client.user.id)) {
      return;
    }

    await detachComponents(messages, client.user.id);

    await channel.send({
      content: completion.message,
      components: [createActionRow(createRegenerateButton())],
    });

    const pruneInterval = Number(config.bot.prune_interval);

    if (pruneInterval > 0) {
      try {
        await Conversation.update(
          {
            expiresAt: new Date(
              Date.now() + 3600000 * Math.ceil(pruneInterval)
            ),
          },
          {
            where: {
              channelId: channel.id,
            },
          }
        );
      } catch (err) {
        console.error(err);
      }
    }
  }, 2000);
}

async function handleDirectMessage(
  client: Client<true>,
  channel: DMChannel,
  message: Message
) {
  delay(async () => {
    if (isLastMessageStale(message, channel.lastMessage, client.user.id)) {
      return;
    }

    const messages = await channel.messages.fetch({ before: message.id });

    await channel.sendTyping();

    // TODO: Retain previous messages with constraints (e.g. 10 messages max).
    const completion = await createChatCompletion(
      generateChatMessages(message)
    );

    if (completion.status !== CompletionStatus.Ok) {
      await handleFailedRequest(
        channel,
        message,
        completion.message,
        completion.status === CompletionStatus.UnexpectedError
      );

      return;
    }

    if (isLastMessageStale(message, channel.lastMessage, client.user.id)) {
      return;
    }

    await detachComponents(messages, client.user.id);

    await channel.send({
      content: completion.message,
      components: [createActionRow(createRegenerateButton())],
    });
  }, 2000);
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

    switch (channel.type) {
      case ChannelType.DM:
        handleDirectMessage(
          client,
          channel.partial ? await channel.fetch() : channel,
          message
        );
        break;
      case ChannelType.PublicThread:
      case ChannelType.PrivateThread:
        handleThreadMessage(client, channel, message);
        break;
      default:
        return;
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
  channel: DMChannel | ThreadChannel,
  message: Message,
  error: string | Error,
  queueDeletion = true
): Promise<void> {
  // if (channel instanceof ThreadChannel) {
  //   try {
  //     await message.delete();
  //   } catch (err) {
  //     console.error(err);
  //   }
  // }

  const content = truncate(message.content, { length: 200 });

  const embed = await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('Failed to generate a response')
        .setDescription(error instanceof Error ? error.message : error)
        .setFields({ name: 'Message', value: content }),
    ],
  });

  if (queueDeletion) {
    delay(async () => {
      await embed.delete();
    }, 8000);
  }
}
