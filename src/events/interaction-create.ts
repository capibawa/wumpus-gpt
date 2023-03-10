import { EmbedBuilder } from '@discordjs/builders';
import { DiscordEvent } from 'discord-module-loader';
import {
  ButtonInteraction,
  ChannelType,
  Client,
  Colors,
  DMChannel,
  Events,
  Interaction,
  Message,
  TextChannel,
  ThreadChannel,
} from 'discord.js';
import { delay, truncate } from 'lodash';

import { createActionRow, createRegenerateButton } from '@/lib/buttons';
import { generateAllChatMessages, generateChatMessages } from '@/lib/helpers';
import {
  CompletionResponse,
  CompletionStatus,
  createChatCompletion,
} from '@/lib/openai';
import { RateLimiter } from '@/lib/rate-limiter';

const rateLimiter = new RateLimiter(5, 'minute');

async function handleRegenerateInteraction(
  interaction: ButtonInteraction,
  client: Client<true>,
  channel: DMChannel | TextChannel | ThreadChannel,
  message: Message
) {
  if (
    channel.type !== ChannelType.GuildText &&
    channel.type !== ChannelType.DM &&
    channel.type !== ChannelType.PublicThread &&
    channel.type !== ChannelType.PrivateThread
  ) {
    return;
  }

  const executed = rateLimiter.attempt(interaction.user.id, async () => {
    await message.edit({
      content: message.content,
      components: [
        createActionRow(
          createRegenerateButton().setLabel('Regenerating...').setDisabled(true)
        ),
      ],
    });

    await interaction.deferUpdate();

    const messages = await channel.messages.fetch({ before: message.id });

    const previousMessage = messages.first();

    if (!previousMessage) {
      await handleFailedRequest(
        interaction,
        channel,
        message,
        'Could not find any previous messages.'
      );

      return;
    }

    let completion: CompletionResponse;

    if (
      channel.type === ChannelType.PublicThread ||
      channel.type === ChannelType.PrivateThread
    ) {
      completion = await createChatCompletion(
        generateAllChatMessages(
          previousMessage.content,
          messages,
          client.user.id
        )
      );
    } else {
      completion = await createChatCompletion(
        generateChatMessages(previousMessage.content)
      );
    }

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

    switch (interaction.customId) {
      case 'regenerate':
        await handleRegenerateInteraction(
          interaction,
          interaction.client,
          channel.partial
            ? await channel.fetch()
            : (channel as DMChannel | TextChannel | ThreadChannel),
          interaction.message
        );
        break;
      default:
        return;
    }
  }
);

async function handleFailedRequest(
  interaction: ButtonInteraction,
  channel: DMChannel | TextChannel | ThreadChannel,
  message: Message,
  error: string | Error
): Promise<void> {
  const content = truncate(message.content, { length: 100 });

  const embed = await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('Failed to regenerate a response')
        .setDescription(error instanceof Error ? error.message : error)
        .setFields({ name: 'Message', value: content }),
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
