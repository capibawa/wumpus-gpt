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
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
} from 'openai';

import config from '@/config';

export function buildContext(
  messages: Array<ChatCompletionRequestMessage>,
  userMessage: string,
  instruction?: string
): Array<ChatCompletionRequestMessage> {
  if (!instruction || instruction === 'Default') {
    instruction = config.bot.instruction;
  }

  instruction = instruction.trim();

  if (!instruction.endsWith('.')) {
    instruction += '.';
  }

  const systemMessageContext = {
    role: ChatCompletionRequestMessageRoleEnum.System,
    content: instruction + ` The current date is ${format(new Date(), 'PPP')}.`,
  };

  const userMessageContext = {
    role: ChatCompletionRequestMessageRoleEnum.User,
    content: userMessage,
  };

  if (messages.length === 0) {
    return [systemMessageContext, userMessageContext];
  }

  let tokenCount = 0;

  const contexts = [];
  const maxTokens = Number(config.openai.max_tokens) * messages.length;
  const tokenizer = new GPT3Tokenizer({ type: 'gpt3' });

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const content = message.content;
    const encoded = tokenizer.encode(content);

    tokenCount += encoded.text.length;

    if (tokenCount > maxTokens) {
      contexts.push({
        role: message.role,
        content: content.slice(0, tokenCount - maxTokens),
      });

      break;
    }

    contexts.push({
      role: message.role,
      content,
    });
  }

  return [systemMessageContext, ...contexts, userMessageContext];
}

export function buildThreadContext(
  messages: Collection<string, Message>,
  userMessage: string,
  botId: string
): Array<ChatCompletionRequestMessage> {
  if (messages.size === 0) {
    return buildContext([], userMessage);
  }

  const initialMessage = messages.last();

  if (
    !initialMessage ||
    initialMessage.embeds.length !== 1 ||
    initialMessage.embeds[0].fields.length !== 2
  ) {
    return buildContext([], userMessage);
  }

  const embed = initialMessage.embeds[0];

  const prompt =
    embed.fields[0].name === 'Message' ? embed.fields[0].value : '';

  const behavior =
    embed.fields[1].name === 'Behavior' ? embed.fields[1].value : '';

  if (!prompt || !behavior) {
    return buildContext([], userMessage);
  }

  const context = [
    { role: ChatCompletionRequestMessageRoleEnum.User, content: prompt },
    ...messages
      .filter(
        (message) =>
          message.type === MessageType.Default &&
          message.content &&
          message.embeds.length === 0 &&
          (message.mentions.members?.size ?? 0) === 0
      )
      .map((message) => {
        return {
          role:
            message.author.id === botId
              ? ChatCompletionRequestMessageRoleEnum.Assistant
              : ChatCompletionRequestMessageRoleEnum.User,
          content: message.content,
        };
      })
      .reverse(),
  ];

  return buildContext(context, userMessage, behavior);
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

  const missingPermissions = permissions.missing(requiredPermissions.valueOf());

  if (missingPermissions.length > 0) {
    return {
      fails: true,
      message: `Missing permissions: ${missingPermissions.join(', ')}`,
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

export function getThreadPrefix(): string {
  return config.bot.thread_prefix ? config.bot.thread_prefix + ' ' : '';
}
