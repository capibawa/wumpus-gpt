import { Events } from 'discord.js';

import { getChatResponse } from '../lib/completion.js';

export const name = Events.MessageCreate;

export async function execute(message) {
  const client = message.client;

  if (message.author.id === client.user.id) {
    return;
  }

  const channel = message.channel;

  if (!channel.isThread()) {
    return;
  }

  const thread = channel;

  if (thread.ownerId !== client.user.id) {
    return;
  }

  if (thread.archived || thread.locked || !thread.name.startsWith('💬')) {
    return;
  }

  try {
    const messages = (await thread.messages.fetch())
      .filter((message) => message.content)
      .map((message) => {
        return {
          role: message.author.id === client.user.id ? 'assistant' : 'user',
          content: message.content,
        };
      })
      .reverse();

    await thread.sendTyping();

    const response = await getChatResponse(messages);

    await thread.send({ content: response });
  } catch (err) {
    console.error(err);
  }
}
