import { encode } from 'gpt-3-encoder';
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai';

import config from '@/config';

const configuration = new Configuration({ apiKey: config.openai.api_key });
const openai = new OpenAIApi(configuration);

export async function getChatResponse(
  messages: ChatCompletionRequestMessage[]
): Promise<string | false> {
  try {
    const data = [
      { role: 'system', content: config.bot.instructions },
      ...messages,
    ];

    const input = data.map((message) => message.content).join('\n');

    // TODO: Better error handling
    if (encode(input).length > config.openai.max_tokens) {
      return 'The request has exceeded the token limit! Try again with a shorter message or start another conversation via the `/chat` command.';
    }

    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: data as ChatCompletionRequestMessage[],
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

  return false;
}
