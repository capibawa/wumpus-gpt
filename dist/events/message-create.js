"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const discord_module_loader_1 = require("discord-module-loader");
const discord_js_1 = require("discord.js");
const config_1 = tslib_1.__importDefault(require("../config"));
const openai_1 = require("../lib/openai");
const conversation_1 = tslib_1.__importDefault(require("../models/conversation"));
async function handleDirectMessage(client, channel, message) {
    await channel.sendTyping();
    try {
        const response = await (0, openai_1.getChatResponse)([
            { role: 'user', content: message.content },
        ]);
        await channel.send(response);
    }
    catch (err) {
        if (err instanceof Error) {
            await message.reply(err.message);
        }
    }
}
async function handleChatMessage(client, channel, message) {
    if (channel.ownerId !== client.user.id) {
        return;
    }
    if (channel.archived || channel.locked || !channel.name.startsWith('💬')) {
        return;
    }
    await channel.sendTyping();
    const messages = await channel.messages.fetch();
    const parsedMessages = messages
        .filter((message) => message.content)
        .map((message) => {
        return {
            role: message.author.id === client.user.id ? 'assistant' : 'user',
            content: message.content,
        };
    })
        .reverse();
    try {
        const response = await (0, openai_1.getChatResponse)(parsedMessages);
        await channel.send(response);
    }
    catch (err) {
        if (err instanceof Error) {
            await messages.first()?.reply(err.message);
            const pruneInterval = Math.ceil(config_1.default.bot.prune_interval);
            if (err.message.includes('token') && pruneInterval > 0) {
                const conversation = await conversation_1.default.findOne({
                    where: { threadId: channel.id },
                });
                if (!conversation || conversation.get('expiresAt')) {
                    return;
                }
                await conversation.update({
                    expiresAt: new Date(Date.now() + 3600000 * pruneInterval),
                });
            }
        }
    }
}
exports.default = new discord_module_loader_1.DiscordEvent(discord_js_1.Events.MessageCreate, async (message) => {
    const client = message.client;
    if (message.author.id === client.user.id) {
        return;
    }
    const channel = message.channel;
    if (channel.isThread()) {
        handleChatMessage(client, channel, message);
    }
    else if (channel.isDMBased()) {
        handleDirectMessage(client, channel, message);
    }
});
