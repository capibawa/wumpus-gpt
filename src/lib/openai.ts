import axios from 'axios';
import { truncate } from 'lodash';
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
  Configuration,
  OpenAIApi,
} from 'openai';

import config from '@/config';

const configuration = new Configuration({ apiKey: config.openai.api_key });
const openai = new OpenAIApi(configuration);

export enum CompletionStatus {
  Ok = 0,
  Moderated = 1,
  ContextLengthExceeded = 2,
  InvalidRequest = 3,
  UnexpectedError = 4,
}

export interface CompletionResponse {
  status: CompletionStatus;
  message: string;
}

export async function createChatCompletion(
  messages: Array<ChatCompletionRequestMessage>
): Promise<CompletionResponse> {
  // const tokens = messages.reduce((total, message) => {
  //   return (
  //     total +
  //     getTokensFromText(message.role) +
  //     getTokensFromText(message.content) +
  //     getTokensFromText(message.name)
  //   );
  // }, config.openai.max_tokens);

  // if (tokens > 4096) {
  //   throw new Error(
  //     'The request has exceeded the token limit. Try again with a shorter message or start another conversation.'
  //   );
  // }

  const safeMessages = [];

  try {
    const moderation = await openai.createModeration({
      input: messages
        .filter((message) => message.role === 'user')
        .map((message) => message.content),
    });

    const results = moderation.data.results;

    // If the latest message is flagged, return a message to the user.
    if (results[results.length - 1].flagged) {
      return {
        status: CompletionStatus.Moderated,
        message: 'Your message has been blocked by moderation.',
      };
    }

    // Otherwise, filter out any flagged messages.
    let userIndex = 0;

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      if (message.role === 'user' && results[userIndex++].flagged) {
        continue;
      }

      safeMessages.push(message);
    }

    const completion = await openai.createChatCompletion({
      messages: safeMessages,
      model: config.openai.model,
      temperature: Number(config.openai.temperature),
      top_p: Number(config.openai.top_p),
      frequency_penalty: Number(config.openai.frequency_penalty),
      presence_penalty: Number(config.openai.presence_penalty),
      max_tokens: Number(config.openai.max_tokens),
    });

    const message = completion.data.choices[0].message;

    if (message) {
      return {
        status: CompletionStatus.Ok,
        message: truncate(message.content.trim(), { length: 2000 }),
      };
    }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const error = err.response?.data?.error;

      if (error && error.code === 'context_length_exceeded') {
        return {
          status: CompletionStatus.ContextLengthExceeded,
          message:
            'The request has exceeded the context limit. Try again with a shorter message or start another conversation.',
        };
      } else if (error && error.type === 'invalid_request_error') {
        logError(err);

        return {
          status: CompletionStatus.InvalidRequest,
          message: error.message,
        };
      }
    } else {
      logError(err);

      return {
        status: CompletionStatus.UnexpectedError,
        message: err instanceof Error ? err.message : (err as string),
      };
    }
  }

  return {
    status: CompletionStatus.UnexpectedError,
    message: 'There was an unexpected error while processing your request.',
  };
}

export async function createImage(prompt: string): Promise<CompletionResponse> {
  try {
    const moderation = await openai.createModeration({
      input: prompt,
    });

    const result = moderation.data.results[0];

    if (result.flagged) {
      return {
        status: CompletionStatus.Moderated,
        message: 'Your prompt has been blocked by moderation.',
      };
    }

    const image = await openai.createImage({
      prompt,
    });

    const imageUrl = image.data.data[0].url;

    if (imageUrl) {
      return {
        status: CompletionStatus.Ok,
        message: imageUrl,
      };
    }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const error = err.response?.data?.error;

      if (error && error.code === 'context_length_exceeded') {
        return {
          status: CompletionStatus.ContextLengthExceeded,
          message:
            'The request has exceeded the token limit. Try again with a shorter message or start another conversation.',
        };
      } else if (error && error.type === 'invalid_request_error') {
        logError(err);

        return {
          status: CompletionStatus.InvalidRequest,
          message: error.message,
        };
      }
    } else {
      logError(err);

      return {
        status: CompletionStatus.UnexpectedError,
        message: err instanceof Error ? err.message : (err as string),
      };
    }
  }

  return {
    status: CompletionStatus.UnexpectedError,
    message: 'There was an unexpected error processing your request.',
  };
}

export async function createTitleFromMessages(
  userMessage: string,
  assistantMessage: string
): Promise<string> {
  const messages = [
    {
      role: ChatCompletionRequestMessageRoleEnum.User,
      content: userMessage,
    },
    {
      role: ChatCompletionRequestMessageRoleEnum.Assistant,
      content: assistantMessage,
    },
    {
      role: ChatCompletionRequestMessageRoleEnum.User,
      content:
        'Describe the nature of our previous messages in less than 6 words.',
    },
  ];

  try {
    const completion = await openai.createChatCompletion({
      messages,
      model: config.openai.model,
    });

    const message = completion.data.choices[0].message;

    if (message) {
      let title = message.content.trim();

      if (title.startsWith('"') && title.endsWith('"')) {
        title = title.slice(1, -1);
      }

      while (title.endsWith('.')) {
        title = title.slice(0, -1);
      }

      return title;
    }
  } catch (err) {}

  return '';
}

function logError(err: unknown): void {
  if (axios.isAxiosError(err)) {
    if (err.response) {
      console.log(err.response.status);
      console.log(err.response.data);
    } else {
      console.log(err.message);
    }
  } else {
    console.log(err);
  }
}
