"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const builders_1 = require("@discordjs/builders");
const discord_module_loader_1 = require("discord-module-loader");
const discord_js_1 = require("discord.js");
const lodash_1 = require("lodash");
const buttons_1 = require("../lib/buttons");
const embeds_1 = require("../lib/embeds");
const helpers_1 = require("../lib/helpers");
const openai_1 = require("../lib/openai");
const rate_limiter_1 = tslib_1.__importDefault(require("../lib/rate-limiter"));
const rateLimiter = new rate_limiter_1.default(3, 'minute');
async function handleRegenerateInteraction(interaction, client, channel, message) {
    const members = await channel.members.fetch();
    if (!members.has(interaction.user.id)) {
        await interaction.reply({
            embeds: [
                (0, embeds_1.createErrorEmbed)('You must be a member of this thread to regenerate responses.'),
            ],
            ephemeral: true,
        });
        return;
    }
    const executed = rateLimiter.attempt(interaction.user.id, async () => {
        try {
            await message.edit({
                content: message.content,
                components: [(0, buttons_1.createActionRow)((0, buttons_1.createRegenerateButton)(true))],
            });
            await interaction.deferUpdate();
            const messages = await channel.messages.fetch({ before: message.id });
            const previousMessage = messages.first();
            if (!previousMessage) {
                await handleFailedRequest(interaction, message, 'Could not find any previous messages.');
                return;
            }
            const completion = await (0, openai_1.createChatCompletion)((0, helpers_1.buildThreadContext)(messages.filter((message) => message.id !== previousMessage.id), previousMessage.content, client.user.id));
            if (completion.status !== openai_1.CompletionStatus.Ok) {
                await handleFailedRequest(interaction, message, completion.message, completion.status === openai_1.CompletionStatus.UnexpectedError);
                return;
            }
            await interaction.editReply({
                content: completion.message,
                components: [(0, buttons_1.createActionRow)((0, buttons_1.createRegenerateButton)())],
            });
        }
        catch (err) {
            if (!(err instanceof discord_js_1.DiscordAPIError &&
                err.code === discord_js_1.RESTJSONErrorCodes.MissingPermissions)) {
                console.error(err);
            }
        }
    });
    if (!executed) {
        await interaction.reply({
            embeds: [(0, embeds_1.createErrorEmbed)('You are currently being rate limited.')],
            ephemeral: true,
        });
    }
}
exports.default = new discord_module_loader_1.DiscordEvent(discord_js_1.Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) {
        return;
    }
    const channel = interaction.channel;
    if (!channel ||
        (channel.type !== discord_js_1.ChannelType.PublicThread &&
            channel.type !== discord_js_1.ChannelType.PrivateThread)) {
        return;
    }
    switch (interaction.customId) {
        case 'regenerate':
            await handleRegenerateInteraction(interaction, interaction.client, channel, interaction.message);
            break;
        default:
            return;
    }
});
async function handleFailedRequest(interaction, message, error, queueDeletion = false) {
    const embed = await message.reply({
        embeds: [
            new builders_1.EmbedBuilder()
                .setColor(discord_js_1.Colors.Red)
                .setTitle('Failed to regenerate a response')
                .setDescription(error),
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
