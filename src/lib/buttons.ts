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

export function createRegenerateButton(): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId('regenerate')
    .setLabel('Regenerate')
    .setStyle(ButtonStyle.Secondary);
}
