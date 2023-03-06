import format from 'date-fns/format';
import {
  ChatCompletionRequestMessage,
  Configuration,
  CreateModerationRequestInput,
  OpenAIApi,
} from 'openai';

import config from '@/config';
import { exceedsTokenLimit } from '@/lib/helpers';

const configuration = new Configuration({ apiKey: config.openai.api_key });
const openai = new OpenAIApi(configuration);

// TODO: Better error handling
export async function getChatResponse(
  messages: Array<ChatCompletionRequestMessage>
): Promise<string> {
  const latestMessage = messages.pop()!; // We are assuming the array is never empty.

  if (await isTextFlagged(latestMessage.content)) {
    throw new Error('Your message has been blocked by moderation.');
  }

  const systemMessage = {
    role: 'system',
    content:
      config.bot.instructions +
      ` The current date is ${format(new Date(), 'PPP')}.`,
  } as ChatCompletionRequestMessage;

  const moderatedMessages = await getModeratedChatMessages(messages);

  const chatMessages = [systemMessage, ...moderatedMessages, latestMessage];

  if (
    exceedsTokenLimit(chatMessages.map((message) => message.content).join('\n')) // Do we need to line break or add a space?
  ) {
    // We can go above and beyond by checking if `/chat` works in the current channel.
    throw new Error(
      'The request has exceeded the token limit! Try again with a shorter message or start another conversation via the `/chat` command.'
    );
  }

  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: chatMessages,
      temperature: config.openai.temperature as number,
      top_p: config.openai.top_p as number,
      frequency_penalty: config.openai.frequency_penalty as number,
      presence_penalty: config.openai.presence_penalty as number,
      max_tokens: config.openai.max_tokens as number,
    });

    const message = completion.data.choices[0].message;

    if (message) {
      return message.content;
    }
  } catch (err) {
    console.error(err);
  }

  throw new Error('There was an error while processing a response.');
}

export async function getModeratedChatMessages(
  messages: Array<ChatCompletionRequestMessage>
): Promise<Array<ChatCompletionRequestMessage>> {
  const moderatedMessages = [] as Array<ChatCompletionRequestMessage>;

  if (messages.length === 0) {
    return moderatedMessages;
  }

  const moderation = await openai.createModeration({
    input: messages.map((message) =>
      message.role === 'user' ? message.content : ''
    ),
  });

  moderation.data.results.forEach((result, index) => {
    const message = messages[index];

    if (message.role === 'user' && result.flagged) {
      return;
    }

    // TODO: Don't use a hardcoded string.
    if (
      message.role === 'assistant' &&
      message.content === 'Your message has been blocked by moderation.'
    ) {
      return;
    }

    moderatedMessages.push(message);
  });

  return moderatedMessages;
}

export async function isTextFlagged(
  input: CreateModerationRequestInput
): Promise<boolean> {
  try {
    const moderation = await openai.createModeration({
      input,
    });

    return moderation.data.results[0].flagged;
  } catch (err) {
    console.error(err);
  }

  return false;
}
