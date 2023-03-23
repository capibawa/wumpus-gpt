import { Event } from '@biscxit/discord-module-loader';
import { EmbedBuilder } from '@discordjs/builders';
import {
  ButtonInteraction,
  ChannelType,
  Client,
  Colors,
  Events,
  Interaction,
  Message,
  RESTJSONErrorCodes,
  ThreadChannel,
} from 'discord.js';
import { delay } from 'lodash';

import { createActionRow, createRegenerateButton } from '@/lib/buttons';
import { createErrorEmbed } from '@/lib/embeds';
import { buildThreadContext, isApiError } from '@/lib/helpers';
import { CompletionStatus, createChatCompletion } from '@/lib/openai';
import RateLimiter from '@/lib/rate-limiter';

const rateLimiter = new RateLimiter(3, 'minute');

async function handleRegenerateInteraction(
  interaction: ButtonInteraction,
  client: Client<true>,
  channel: ThreadChannel,
  message: Message
) {
  const members = await channel.members.fetch();

  if (!members.has(interaction.user.id)) {
    await interaction.reply({
      embeds: [
        createErrorEmbed(
          'You must be a member of this thread to regenerate responses.'
        ),
      ],
      ephemeral: true,
    });

    return;
  }

  const executed = rateLimiter.attempt(interaction.user.id, async () => {
    try {
      await message.edit({
        content: message.content,
        components: [createActionRow(createRegenerateButton(true))],
      });

      await interaction.deferUpdate();

      const messages = await channel.messages.fetch({ before: message.id });

      const previousMessage = messages.first();

      if (!previousMessage) {
        await handleFailedRequest(
          interaction,
          message,
          'Could not find any previous messages.'
        );

        return;
      }

      const completion = await createChatCompletion(
        buildThreadContext(
          messages.filter((message) => message.id !== previousMessage.id),
          previousMessage.content,
          client.user.id
        )
      );

      if (completion.status !== CompletionStatus.Ok) {
        await handleFailedRequest(
          interaction,
          message,
          completion.message,
          completion.status === CompletionStatus.UnexpectedError
        );

        return;
      }

      await interaction.editReply({
        content: completion.message,
        components: [createActionRow(createRegenerateButton())],
      });
    } catch (err) {
      if (
        !(isApiError(err) && err.code === RESTJSONErrorCodes.MissingPermissions)
      ) {
        console.error(err);
      }
    }
  });

  if (!executed) {
    await interaction.reply({
      embeds: [createErrorEmbed('You are currently being rate limited.')],
      ephemeral: true,
    });
  }
}

export default new Event({
  name: Events.InteractionCreate,
  execute: async (interaction: Interaction) => {
    if (!interaction.isButton()) {
      return;
    }

    const channel = interaction.channel;

    if (
      !channel ||
      (channel.type !== ChannelType.PublicThread &&
        channel.type !== ChannelType.PrivateThread)
    ) {
      return;
    }

    switch (interaction.customId) {
      case 'regenerate':
        await handleRegenerateInteraction(
          interaction,
          interaction.client,
          channel,
          interaction.message
        );
        break;
      default:
        return;
    }
  },
});

async function handleFailedRequest(
  interaction: ButtonInteraction,
  message: Message,
  error: string,
  queueDeletion = false
): Promise<void> {
  const embed = await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('Failed to regenerate a response')
        .setDescription(error),
    ],
  });

  const payload = {
    content: message.content,
    components: [createActionRow(createRegenerateButton())],
  };

  if (interaction.deferred) {
    await interaction.editReply(payload);
  } else {
    await interaction.update(payload);
  }

  if (queueDeletion) {
    delay(async () => {
      await embed.delete();
    }, 8000);
  }
}
