"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const builders_1 = require("@discordjs/builders");
const discord_module_loader_1 = require("discord-module-loader");
const discord_js_1 = require("discord.js");
const lodash_1 = require("lodash");
const buttons_1 = require("../lib/buttons");
const helpers_1 = require("../lib/helpers");
const openai_1 = require("../lib/openai");
const rate_limiter_1 = tslib_1.__importDefault(require("../lib/rate-limiter"));
const rateLimiter = new rate_limiter_1.default(3, 'minute');
async function handleRegenerateInteraction(interaction, client, channel, message) {
    if (channel.type !== discord_js_1.ChannelType.GuildText &&
        channel.type !== discord_js_1.ChannelType.DM &&
        channel.type !== discord_js_1.ChannelType.PublicThread &&
        channel.type !== discord_js_1.ChannelType.PrivateThread) {
        return;
    }
    const executed = rateLimiter.attempt(interaction.user.id, async () => {
        await message.edit({
            content: message.content,
            components: [
                (0, buttons_1.createActionRow)((0, buttons_1.createRegenerateButton)().setLabel('Regenerating...').setDisabled(true)),
            ],
        });
        await interaction.deferUpdate();
        const messages = await channel.messages.fetch({ before: message.id });
        const previousMessage = messages.first();
        if (!previousMessage) {
            await handleFailedRequest(interaction, channel, message, 'Could not find any previous messages.');
            return;
        }
        let completion;
        if (channel.type === discord_js_1.ChannelType.PublicThread ||
            channel.type === discord_js_1.ChannelType.PrivateThread) {
            completion = await (0, openai_1.createChatCompletion)((0, helpers_1.generateAllChatMessages)(previousMessage.content, messages, client.user.id));
        }
        else {
            completion = await (0, openai_1.createChatCompletion)((0, helpers_1.generateChatMessages)(previousMessage.content));
        }
        if (completion.status !== openai_1.CompletionStatus.Ok) {
            await handleFailedRequest(interaction, channel, message, completion.message, completion.status === openai_1.CompletionStatus.UnexpectedError);
            return;
        }
        await interaction.editReply({
            content: completion.message,
            components: [(0, buttons_1.createActionRow)((0, buttons_1.createRegenerateButton)())],
        });
    });
    if (!executed) {
        await handleFailedRequest(interaction, channel, message, 'You are currently being rate limited.');
    }
}
exports.default = new discord_module_loader_1.DiscordEvent(discord_js_1.Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) {
        return;
    }
    const channel = interaction.channel;
    if (!channel) {
        return;
    }
    switch (interaction.customId) {
        case 'regenerate':
            await handleRegenerateInteraction(interaction, interaction.client, channel.partial
                ? await channel.fetch()
                : channel, interaction.message);
            break;
        default:
            return;
    }
});
async function handleFailedRequest(interaction, channel, message, error, queueDeletion = true) {
    const embed = await channel.send({
        embeds: [
            new builders_1.EmbedBuilder()
                .setColor(discord_js_1.Colors.Red)
                .setTitle('Failed to regenerate a response')
                .setDescription(error instanceof Error ? error.message : error)
                .setFields({
                name: 'Message',
                value: (0, lodash_1.truncate)(message.content, { length: 200 }),
            }),
        ],
    });
    const payload = {
        content: message.content,
        components: [(0, buttons_1.createActionRow)((0, buttons_1.createRegenerateButton)())],
    };
    if (interaction.deferred) {
        await interaction.editReply(payload);
    }
    else {
        await interaction.update(payload);
    }
    if (queueDeletion) {
        (0, lodash_1.delay)(async () => {
            await embed.delete();
        }, 8000);
    }
}
