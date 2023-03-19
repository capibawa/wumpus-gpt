import { EmbedBuilder } from '@discordjs/builders';
import { DiscordEvent } from 'discord-module-loader';
import {
  ButtonInteraction,
  ChannelType,
  Client,
  Colors,
  DiscordAPIError,
  DMChannel,
  Events,
  Interaction,
  Message,
  RESTJSONErrorCodes,
  TextChannel,
  ThreadChannel,
} from 'discord.js';
import { delay } from 'lodash';

import { createActionRow, createRegenerateButton } from '@/lib/buttons';
import { createErrorEmbed } from '@/lib/embeds';
import { generateAllChatMessages, generateChatMessages } from '@/lib/helpers';
import {
  CompletionResponse,
  CompletionStatus,
  createChatCompletion,
} from '@/lib/openai';
import RateLimiter from '@/lib/rate-limiter';

const rateLimiter = new RateLimiter(3, 'minute');

async function handleRegenerateInteraction(
  interaction: ButtonInteraction,
  client: Client<true>,
  channel: DMChannel | TextChannel | ThreadChannel,
  message: Message
) {
  if (
    channel.type === ChannelType.PublicThread ||
    channel.type === ChannelType.PrivateThread
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
        !(
          err instanceof DiscordAPIError &&
          err.code === RESTJSONErrorCodes.MissingPermissions
        )
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

export default new DiscordEvent(
  Events.InteractionCreate,
  async (interaction: Interaction) => {
    if (!interaction.isButton()) {
      return;
    }

    const channel = interaction.channel;

    if (
      !channel ||
      (channel.type !== ChannelType.GuildText &&
        channel.type !== ChannelType.DM &&
        channel.type !== ChannelType.PublicThread &&
        channel.type !== ChannelType.PrivateThread)
    ) {
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
