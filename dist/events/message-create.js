"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_module_loader_1 = require("discord-module-loader");
const discord_js_1 = require("discord.js");
const lodash_1 = require("lodash");
const buttons_1 = require("../lib/buttons");
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
        await handleFailedRequest(channel, message, err);
        return;
    }
    (0, lodash_1.delay)(async () => {
        if (isLastMessageStale(message, channel.lastMessage, client.user.id)) {
            return;
        }
        await channel.sendTyping();
        const threadMessages = await channel.messages.fetch({ before: message.id });
        const completion = await (0, openai_1.createChatCompletion)((0, helpers_1.generateAllChatMessages)(message, threadMessages, client.user.id));
        if (completion.status !== openai_1.CompletionStatus.Ok) {
            await handleFailedRequest(channel, message, completion.message);
            return;
        }
        if (isLastMessageStale(message, channel.lastMessage, client.user.id)) {
            return;
        }
        await (0, helpers_1.detachComponents)(threadMessages);
        await channel.send({
            content: completion.message,
            components: [(0, buttons_1.createActionRow)((0, buttons_1.createRegenerateButton)())],
        });
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
    const completion = await (0, openai_1.createChatCompletion)((0, helpers_1.generateChatMessages)(message));
    if (completion.status !== openai_1.CompletionStatus.Ok) {
        await message.reply(completion.message);
        return;
    }
    await channel.send(completion.message);
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
    const embed = await channel.send({
        embeds: [
            new discord_js_1.EmbedBuilder()
                .setColor(discord_js_1.Colors.Red)
                .setTitle('Failed to generate a resposne')
                .setDescription(error instanceof Error ? error.message : error)
                .setFields({ name: 'Message', value: messageContent }),
        ],
    });
    (0, lodash_1.delay)(async () => {
        await embed.delete();
    }, 5000);
}
