import format from 'date-fns/format';
import {
  BitFieldResolvable,
  Collection,
  DiscordAPIError,
  Message,
  MessageType,
  PermissionsBitField,
  PermissionsString,
  RESTJSONErrorCodes,
  ThreadChannel,
} from 'discord.js';
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
      role: ChatCompletionRequestMessageRoleEnum.User,
      content: isString(message) ? message : message.content,
    },
  ];
}

export function generateAllChatMessages(
  message: string | Message,
  messages: Collection<string, Message>,
  botId: string
): Array<ChatCompletionRequestMessage> {
  if (isEmpty(messages)) {
    return generateChatMessages(message);
  }

  const initialMessage = messages.last();

  if (
    !initialMessage ||
    initialMessage.embeds.length !== 1 ||
    initialMessage.embeds[0].fields.length !== 2
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
    { role: ChatCompletionRequestMessageRoleEnum.User, content: prompt },
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
      ? { role: ChatCompletionRequestMessageRoleEnum.User, content: message }
      : toChatMessage(message, botId),
  ];
}

export function getSystemMessage(
  message?: string
): ChatCompletionRequestMessage {
  if (!message || message === 'Default') {
    message = config.bot.instructions;
  }

  message = message.trim();

  if (!message.endsWith('.')) {
    message += '.';
  }

  return {
    role: ChatCompletionRequestMessageRoleEnum.System,
    content: message + ` The current date is ${format(new Date(), 'PPP')}.`,
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

export function validatePermissions(
  permissions: Readonly<PermissionsBitField> | undefined,
  bits: BitFieldResolvable<PermissionsString, bigint>
): { fails: boolean; message: string; permissions: Array<string> } {
  const requiredPermissions = new PermissionsBitField([
    bits,
    PermissionsBitField.Flags.UseApplicationCommands,
  ]);

  if (!permissions) {
    return {
      fails: true,
      message: 'Unable to fetch permissions.',
      permissions: requiredPermissions.toArray(),
    };
  }

  const missingPermissions = permissions.missing(requiredPermissions);

  if (missingPermissions.length > 0) {
    return {
      fails: true,
      message: `Missing permissions: ${missingPermissions.join(', ')}.`,
      permissions: requiredPermissions.toArray(),
    };
  }

  return {
    fails: false,
    message: '',
    permissions: requiredPermissions.toArray(),
  };
}

export async function detachComponents(
  messages: Collection<string, Message>,
  botId: string
): Promise<void> {
  try {
    await Promise.all(
      messages.map((message) => {
        if (message.author.id === botId && message.components.length > 0) {
          return message.edit({ components: [] });
        }
      })
    );
  } catch (err) {
    console.error(err);
  }
}

export async function destroyThread(channel: ThreadChannel): Promise<void> {
  try {
    await channel.delete();

    const starterMessage = await channel.fetchStarterMessage();

    if (starterMessage) {
      await starterMessage.delete();
    }
  } catch (err) {
    if (
      err instanceof DiscordAPIError &&
      err.code !== RESTJSONErrorCodes.UnknownChannel &&
      err.code !== RESTJSONErrorCodes.UnknownMessage
    ) {
      console.error(err);
    }
  }
}

export function getTokensFromText(text?: string): number {
  // Add 1 to account for the role (user) being 4 characters.
  return text ? tokenizer.encode(text).bpe.length + 1 : 0;
}

export function exceedsTokenLimit(text: string): boolean {
  return getTokensFromText(text) > 4096 - Number(config.openai.max_tokens);
}
