import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageActionRowComponentBuilder,
  RestOrArray,
} from 'discord.js';

export function createActionRow(
  ...components: RestOrArray<MessageActionRowComponentBuilder>
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    ...components
  );
}

export function createRegenerateButton(loading = false): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId('regenerate')
    .setLabel(!loading ? 'Regenerate' : 'Regenerating...')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(loading);
}
