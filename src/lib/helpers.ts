import format from 'date-fns/format';
import { Client, Collection, Message, ThreadChannel } from 'discord.js';
import GPT3Tokenizer from 'gpt3-tokenizer';
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
      content: typeof message === 'string' ? message : message.content,
    },
  ];
}

export function generateAllChatMessages(
  client: Client<true>,
  message: string | Message,
  messages: Collection<string, Message<true>>
): Array<ChatCompletionRequestMessage> {
  if (messages.size === 0) {
    return generateChatMessages(message);
  }

  const firstMessage = messages.last();

  if (!firstMessage || firstMessage?.embeds.length === 0) {
    return generateChatMessages(message);
  }

  const prompt = firstMessage.embeds[0].fields?.[0].value;
  const behavior = firstMessage.embeds[0].fields?.[1].value;

  if (!prompt || !behavior) {
    return generateChatMessages(message);
  }

  return [
    getSystemMessage(behavior !== 'Default' ? behavior : undefined),
    { role: 'user', content: prompt },
    ...messages
      .filter((message) => message.content && message.embeds.length === 0)
      .map((message) => toChatMessage(client, message))
      .reverse(),
    typeof message === 'string'
      ? { role: 'user', content: message }
      : toChatMessage(client, message),
  ];
}

export function getSystemMessage(
  message?: string
): ChatCompletionRequestMessage {
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
  client: Client<true>,
  message: Message
): ChatCompletionRequestMessage {
  return {
    role:
      message.author.id === client.user.id
        ? ChatCompletionRequestMessageRoleEnum.Assistant
        : ChatCompletionRequestMessageRoleEnum.User,
    content: message.content,
  };
}

export async function validateMessage(
  message?: string | Message,
  alias: string = 'message'
): Promise<boolean> {
  message = typeof message === 'string' ? message : message?.content;

  if (!message || message.length === 0) {
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
  return text ? tokenizer.encode(text).bpe.length : 0;
}

export function exceedsTokenLimit(text: string): boolean {
  return getTokensFromText(text) > 4096 - Number(config.openai.max_tokens);
}
