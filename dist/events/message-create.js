"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_module_loader_1 = require("discord-module-loader");
const discord_js_1 = require("discord.js");
const lodash_1 = require("lodash");
const helpers_1 = require("../lib/helpers");
const openai_1 = require("../lib/openai");
async function handleThreadMessage(client, channel, message) {
    if (channel.ownerId !== client.user.id) {
        return;
    }
    if (channel.archived || channel.locked || !channel.name.startsWith('💬')) {
        return;
    }
    try {
        await (0, helpers_1.validateMessage)(message);
    }
    catch (err) {
        handleFailedRequest(channel, message, err);
        return;
    }
    (0, lodash_1.delay)(async () => {
        if (isLastMessageStale(message, channel.lastMessage, client.user.id)) {
            return;
        }
        await channel.sendTyping();
        const messages = await channel.messages.fetch({ before: message.id });
        const response = await (0, openai_1.createChatCompletion)((0, helpers_1.generateAllChatMessages)(message, messages, client.user.id));
        if (!response) {
            handleFailedRequest(channel, message, 'An unexpected error has occurred.');
            return;
        }
        if (isLastMessageStale(message, channel.lastMessage, client.user.id)) {
            return;
        }
        for (const message of (0, helpers_1.splitMessages)(response)) {
            await channel.send(message);
        }
    }, 2000);
}
async function handleDirectMessage(client, channel, message) {
    try {
        await (0, helpers_1.validateMessage)(message);
    }
    catch (err) {
        await message.reply(err.message);
        return;
    }
    await channel.sendTyping();
    const response = await (0, openai_1.createChatCompletion)((0, helpers_1.generateChatMessages)(message));
    if (!response) {
        await message.reply('There was an error while processing your response.');
        return;
    }
    for (const message of (0, helpers_1.splitMessages)(response)) {
        await channel.send(message);
    }
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
    if (channel.isThread()) {
        handleThreadMessage(client, channel, message);
    }
    else if (channel.isDMBased()) {
        handleDirectMessage(client, channel, message);
    }
});
function isLastMessageStale(message, lastMessage, botId) {
    return (lastMessage !== null &&
        lastMessage.id !== message.id &&
        lastMessage.author.id !== botId);
}
async function handleFailedRequest(channel, message, error) {
    const messageContent = (0, lodash_1.truncate)(message.content, { length: 100 });
    await message.delete();
    await channel.send({
        embeds: [
            new discord_js_1.EmbedBuilder()
                .setColor(discord_js_1.Colors.Red)
                .setTitle('Unable to complete your request')
                .setDescription(error instanceof Error ? error.message : error)
                .setFields({ name: 'Message', value: messageContent }),
        ],
    });
}
