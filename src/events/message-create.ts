import { DiscordEvent } from 'discord-module-loader';
import { Events, Message } from 'discord.js';
import { ChatCompletionRequestMessage } from 'openai';

import { getChatResponse } from '@/lib/completion';

export default new DiscordEvent(
  Events.MessageCreate,
  async (message: Message) => {
    const client = message.client;

    if (message.author.id === client.user.id) {
      return;
    }

    const channel = message.channel;

    if (!channel.isThread()) {
      return;
    }

    if (channel.ownerId !== client.user.id) {
      return;
    }

    if (channel.archived || channel.locked || !channel.name.startsWith('💬')) {
      return;
    }

    await channel.sendTyping();

    const messages = await channel.messages.fetch();

    const parsedMessages = messages
      .filter((message) => message.content)
      .map((message) => {
        return {
          role: message.author.id === client.user.id ? 'assistant' : 'user',
          content: message.content,
        } as ChatCompletionRequestMessage;
      })
      .reverse();

    const response = await getChatResponse(parsedMessages);

    if (!response) {
      await messages
        .first()
        ?.reply('There was an error while processing a response!');

      return;
    }

    await channel.send(response);
  }
);
