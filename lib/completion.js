import { Configuration, OpenAIApi } from 'openai';

import config from '../config.js';

const configuration = new Configuration({
  apiKey: config.openai.api_key,
});

const openai = new OpenAIApi(configuration);

export async function getChatResponse(messages) {
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

    return completion.data.choices[0].message.content;
  } catch (err) {
    console.error(err);
  }
}

export async function convertMessageToTitle(input) {
  try {
    const completion = await openai.createEdit({
      model: 'text-davinci-edit-001',
      input,
      instruction: 'Rewrite as a short title. No 1st person words.',
      temperature: 0.1,
      top_p: 1.0,
    });

    return completion.data.choices[0].text;
  } catch (err) {
    console.error(err);
  }
}
