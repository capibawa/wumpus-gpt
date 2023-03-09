import { EmbedBuilder } from '@discordjs/builders';
import { DiscordEvent } from 'discord-module-loader';
import {
  ButtonInteraction,
  Colors,
  Events,
  Interaction,
  Message,
  TextChannel,
  ThreadChannel,
} from 'discord.js';
import { delay, truncate } from 'lodash';

import { createActionRow, createRegenerateButton } from '@/lib/buttons';
import { generateAllChatMessages, generateChatMessages } from '@/lib/helpers';
import { CompletionStatus, createChatCompletion } from '@/lib/openai';
import { RateLimiter } from '@/lib/rate-limiter';

const rateLimiter = new RateLimiter(5, 'minute');

export default new DiscordEvent(
  Events.InteractionCreate,
  async (interaction: Interaction) => {
    if (!interaction.isButton()) {
      return;
    }

    const channel = interaction.channel;

    if (!channel) {
      return;
    }

    const client = interaction.client;
    const message = interaction.message;

    if (interaction.customId === 'regenerate' && channel?.isThread()) {
      const executed = rateLimiter.attempt(interaction.id, async () => {
        await message.edit({
          content: message.content,
          components: [
            createActionRow(
              createRegenerateButton()
                .setLabel('Regenerating...')
                .setDisabled(true)
            ),
          ],
        });

        await interaction.deferUpdate();

        const threadMessages = await channel.messages.fetch({
          before: message.id,
        });

        const previousMessage = threadMessages.first();

        if (!previousMessage) {
          await handleFailedRequest(
            interaction,
            channel,
            message,
            'Could not find any previous messages.'
          );

          return;
        }

        const completion = await createChatCompletion(
          generateAllChatMessages(
            previousMessage.content,
            threadMessages,
            client.user.id
          )
        );

        if (completion.status !== CompletionStatus.Ok) {
          await handleFailedRequest(
            interaction,
            channel,
            message,
            completion.message
          );

          return;
        }

        await interaction.editReply({
          content: completion.message,
          components: [createActionRow(createRegenerateButton())],
        });
      });

      if (!executed) {
        await handleFailedRequest(
          interaction,
          channel,
          message,
          'You are currently being rate limited.'
        );
      }
    }
  }
);

async function handleFailedRequest(
  interaction: ButtonInteraction,
  channel: TextChannel | ThreadChannel,
  message: Message,
  error: string | Error
): Promise<void> {
  const messageContent = truncate(message.content, { length: 100 });

  const embed = await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('Failed to regenerate a response')
        .setDescription(error instanceof Error ? error.message : error)
        .setFields({ name: 'Message', value: messageContent }),
    ],
  });

  if (!interaction.deferred) {
    await interaction.update({
      content: message.content,
      components: [createActionRow(createRegenerateButton())],
    });
  } else {
    await interaction.editReply({
      content: message.content,
      components: [createActionRow(createRegenerateButton())],
    });
  }

  delay(async () => {
    await embed.delete();
  }, 5000);
}
