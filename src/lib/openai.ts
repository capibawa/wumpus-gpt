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

export async function createChatCompletion(
  messages: Array<ChatCompletionRequestMessage>
): Promise<string | false> {
  // const tokens = messages.reduce((total, message) => {
  //   return (
  //     total +
  //     getTokensFromText(message.role) +
  //     getTokensFromText(message.content) +
  //     getTokensFromText(message.name)
  //   );
  // }, 0);

  // if (tokens > config.openai.max_tokens) {
  //   throw new Error(
  //     'The request has exceeded the token limit. Try again with a shorter message or start another conversation.'
  //   );
  // }

  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages,
      temperature: +config.openai.temperature,
      top_p: +config.openai.top_p,
      frequency_penalty: +config.openai.frequency_penalty,
      presence_penalty: +config.openai.presence_penalty,
      max_tokens: +config.openai.max_tokens,
    });

    const message = completion.data.choices[0].message;

    if (message) {
      return message.content;
    }
  } catch (err) {
    logError(err);
  }

  return false;
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
