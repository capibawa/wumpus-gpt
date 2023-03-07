import format from 'date-fns/format';
import { Collection, Message, MessageType, ThreadChannel } from 'discord.js';
import GPT3Tokenizer from 'gpt3-tokenizer';
import { isEmpty, isString } from 'lodash';
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
} from 'openai';

import config from '@/config';

const tokenizer = new GPT3Tokenizer({ type: 'gpt3' });

export function generateChatMessages(
  message: string | Message,
  behavior?: string
): Array<ChatCompletionRequestMessage> {
  return [
    getSystemMessage(behavior),
    {
      role: 'user',
      content: isString(message) ? message : message.content,
    },
  ];
}

export function generateAllChatMessages(
  message: string | Message,
  messages: Collection<string, Message<true>>,
  botId: string
): Array<ChatCompletionRequestMessage> {
  if (isEmpty(messages)) {
    return generateChatMessages(message);
  }

  const initialMessage = messages.last();

  if (
    !initialMessage ||
    isEmpty(initialMessage.embeds) ||
    isEmpty(initialMessage.embeds[0].fields)
  ) {
    return generateChatMessages(message);
  }

  const embed = initialMessage.embeds[0];

  const prompt =
    embed.fields[0].name === 'Message' ? embed.fields[0].value : '';

  const behavior =
    embed.fields[1].name === 'Behavior' ? embed.fields[1].value : '';

  if (!prompt || !behavior) {
    return generateChatMessages(message);
  }

  return [
    getSystemMessage(behavior),
    { role: 'user', content: prompt },
    ...messages
      .filter(
        (message) =>
          message.type === MessageType.Default &&
          message.content &&
          isEmpty(message.embeds) &&
          isEmpty(message.mentions.members)
      )
      .map((message) => toChatMessage(message, botId))
      .reverse(),
    isString(message)
      ? { role: 'user', content: message }
      : toChatMessage(message, botId),
  ];
}

export function getSystemMessage(
  message?: string
): ChatCompletionRequestMessage {
  if (message === 'Default') {
    message = undefined;
  }

  if (message && message.slice(-1) !== '.') {
    message += '.';
  }

  return {
    role: ChatCompletionRequestMessageRoleEnum.System,
    content:
      (message || config.bot.instructions) +
      ` The current date is ${format(new Date(), 'PPP')}.`,
  };
}

export function toChatMessage(
  message: Message,
  botId: string
): ChatCompletionRequestMessage {
  return {
    role:
      message.author.id === botId
        ? ChatCompletionRequestMessageRoleEnum.Assistant
        : ChatCompletionRequestMessageRoleEnum.User,
    content: message.content,
  };
}

export async function validateMessage(
  message?: string | Message,
  alias: string = 'message'
): Promise<boolean> {
  message = isString(message) ? message : message?.content;

  if (!message) {
    throw new Error(`There was an error processing your ${alias}.`);
  }

  if (exceedsTokenLimit(message)) {
    throw new Error(`Your ${alias} is too long, please try shortening it.`);
  }

  // if (await isTextFlagged(message)) {
  //   throw new Error(`Your ${alias} has been blocked by moderation.`);
  // }

  return true;
}

export async function destroyThread(channel: ThreadChannel): Promise<void> {
  await channel.delete();

  const starterMessage = await channel.fetchStarterMessage();

  if (starterMessage) {
    await starterMessage.delete();
  }
}

export function getTokensFromText(text?: string): number {
  // Add 1 to account for the role (user) being 4 characters.
  return text ? tokenizer.encode(text).bpe.length + 1 : 0;
}

export function exceedsTokenLimit(text: string): boolean {
  return getTokensFromText(text) > 4096 - Number(config.openai.max_tokens);
}
