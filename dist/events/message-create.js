"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const discord_module_loader_1 = require("discord-module-loader");
const discord_js_1 = require("discord.js");
const lodash_1 = require("lodash");
const config_1 = tslib_1.__importDefault(require("../config"));
const buttons_1 = require("../lib/buttons");
const helpers_1 = require("../lib/helpers");
const openai_1 = require("../lib/openai");
const conversation_1 = tslib_1.__importDefault(require("../models/conversation"));
async function handleThreadMessage(client, channel, message) {
    if (channel.ownerId !== client.user.id) {
        return;
    }
    if (channel.archived || channel.locked || !channel.name.startsWith('💬')) {
        return;
    }
    (0, lodash_1.delay)(async () => {
        if (isLastMessageStale(message, channel.lastMessage, client.user.id)) {
            return;
        }
        const messages = await channel.messages.fetch({ before: message.id });
        await channel.sendTyping();
        const completion = await (0, openai_1.createChatCompletion)((0, helpers_1.generateAllChatMessages)(message, messages, client.user.id));
        if (completion.status !== openai_1.CompletionStatus.Ok) {
            await handleFailedRequest(channel, message, completion.message, completion.status === openai_1.CompletionStatus.UnexpectedError);
            return;
        }
        if (isLastMessageStale(message, channel.lastMessage, client.user.id)) {
            return;
        }
        await (0, helpers_1.detachComponents)(messages, client.user.id);
        await channel.send({
            content: completion.message,
            components: [(0, buttons_1.createActionRow)((0, buttons_1.createRegenerateButton)())],
        });
        const pruneInterval = Number(config_1.default.bot.prune_interval);
        if (pruneInterval > 0) {
            try {
                await conversation_1.default.update({
                    expiresAt: new Date(Date.now() + 3600000 * Math.ceil(pruneInterval)),
                }, { where: { channelId: channel.id } });
            }
            catch (err) {
                console.error(err);
            }
        }
    }, 2000);
}
async function handleDirectMessage(client, channel, message) {
    (0, lodash_1.delay)(async () => {
        if (isLastMessageStale(message, channel.lastMessage, client.user.id)) {
            return;
        }
        const messages = await channel.messages.fetch({ before: message.id });
        await channel.sendTyping();
        const completion = await (0, openai_1.createChatCompletion)((0, helpers_1.generateChatMessages)(message));
        if (completion.status !== openai_1.CompletionStatus.Ok) {
            await handleFailedRequest(channel, message, completion.message, completion.status === openai_1.CompletionStatus.UnexpectedError);
            return;
        }
        if (isLastMessageStale(message, channel.lastMessage, client.user.id)) {
            return;
        }
        await (0, helpers_1.detachComponents)(messages, client.user.id);
        await channel.send({
            content: completion.message,
            components: [(0, buttons_1.createActionRow)((0, buttons_1.createRegenerateButton)())],
        });
    }, 2000);
}
exports.default = new discord_module_loader_1.DiscordEvent(discord_js_1.Events.MessageCreate, async (message) => {
    const client = message.client;
    if (message.author.id === client.user.id ||
        message.type !== discord_js_1.MessageType.Default ||
        !message.content ||
        !(0, lodash_1.isEmpty)(message.embeds) ||
        !(0, lodash_1.isEmpty)(message.mentions.members)) {
        return;
    }
    const channel = message.channel;
    switch (channel.type) {
        case discord_js_1.ChannelType.DM:
            handleDirectMessage(client, channel.partial ? await channel.fetch() : channel, message);
            break;
        case discord_js_1.ChannelType.PublicThread:
        case discord_js_1.ChannelType.PrivateThread:
            handleThreadMessage(client, channel, message);
            break;
        default:
            return;
    }
});
function isLastMessageStale(message, lastMessage, botId) {
    return (lastMessage !== null &&
        lastMessage.id !== message.id &&
        lastMessage.author.id !== botId);
}
async function handleFailedRequest(channel, message, error, queueDeletion = true) {
    const content = (0, lodash_1.truncate)(message.content, { length: 200 });
    const embed = await channel.send({
        embeds: [
            new discord_js_1.EmbedBuilder()
                .setColor(discord_js_1.Colors.Red)
                .setTitle('Failed to generate a response')
                .setDescription(error instanceof Error ? error.message : error)
                .setFields({ name: 'Message', value: content }),
        ],
    });
    if (queueDeletion) {
        (0, lodash_1.delay)(async () => {
            await embed.delete();
        }, 8000);
    }
}
