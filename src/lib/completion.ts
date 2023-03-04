import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai';

import config from '@/config';

const configuration = new Configuration({ apiKey: config.openai.api_key });
const openai = new OpenAIApi(configuration);

export async function getChatResponse(
  messages: ChatCompletionRequestMessage[]
): Promise<string | false> {
  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: config.bot.instructions },
        ...messages,
      ],
      temperature: 0.7,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
      max_tokens: 2048,
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
