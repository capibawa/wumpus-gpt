import axios from 'axios';
import {
  ChatCompletionRequestMessage,
  Configuration,
  CreateModerationRequestInput,
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
  message?: string;
  statusMessage?: string;
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

  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages,
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
        message: message.content.trim(),
      };
    }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.data?.error?.code === 'context_length_exceeded') {
        return {
          status: CompletionStatus.ContextLengthExceeded,
          statusMessage:
            'The request has exceeded the token limit. Try again with a shorter message or start another conversation.',
        };
      } else if (err.response?.data?.error?.type === 'invalid_request_error') {
        logError(err);

        const error = err.response.data.error;

        return {
          status: CompletionStatus.InvalidRequest,
          statusMessage: error.message,
        };
      }
    } else {
      logError(err);

      return {
        status: CompletionStatus.UnexpectedError,
        statusMessage:
          err instanceof Error
            ? err.message
            : (err as string) ||
              'There was an unexpected error processing your request.',
      };
    }
  }

  return {
    status: CompletionStatus.UnexpectedError,
    statusMessage: 'There was an unexpected error processing your request.',
  };
}

export async function createImage(prompt: string): Promise<string> {
  let imageUrl = '';

  try {
    const image = await openai.createImage({
      prompt,
    });

    imageUrl = image.data.data[0].url || '';
  } catch (err) {
    logError(err);
  }

  return imageUrl;
}

export async function isTextFlagged(
  input: CreateModerationRequestInput
): Promise<boolean> {
  let flagged = false;

  try {
    const moderation = await openai.createModeration({
      input,
    });

    flagged = moderation.data.results[0].flagged;
  } catch (err) {
    logError(err);
  }

  return flagged;
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
