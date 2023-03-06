"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_module_loader_1 = require("discord-module-loader");
const discord_js_1 = require("discord.js");
const openai_1 = require("../lib/openai");
async function handleThreadMessage(client, channel, message) {
    if (channel.ownerId !== client.user.id) {
        return;
    }
    if (channel.archived || channel.locked || !channel.name.startsWith('💬')) {
        return;
    }
    await channel.sendTyping();
    const messages = await channel.messages.fetch();
    const firstMessage = messages.last();
    const lastMessage = messages.first();
    const behavior = firstMessage?.content?.includes('Behavior: ')
        ? firstMessage.content.split('Behavior: ')[1]
        : undefined;
    const parsedMessages = messages
        .filter((message) => message.content)
        .map((message) => {
        return {
            role: message.author.id === client.user.id ? 'assistant' : 'user',
            content: message.content,
        };
    });
    if (behavior) {
        parsedMessages.pop();
    }
    try {
        const response = await (0, openai_1.getChatResponse)(parsedMessages.reverse(), behavior);
        await channel.send(response);
    }
    catch (err) {
        if (err instanceof Error) {
            await lastMessage?.reply(err.message);
            if (err.message.includes('token')) {
            }
        }
        else {
            await lastMessage?.reply('There was an error while processing your response.');
        }
    }
}
async function handleDirectMessage(client, channel, message) {
    await channel.sendTyping();
    try {
        const response = await (0, openai_1.getChatResponse)([
            { role: 'user', content: message.content },
        ]);
        await channel.send(response);
    }
    catch (err) {
        await message.reply(err instanceof Error
            ? err.message
            : 'There was an error while processing your response.');
    }
}
exports.default = new discord_module_loader_1.DiscordEvent(discord_js_1.Events.MessageCreate, async (message) => {
    const client = message.client;
    if (message.author.id === client.user.id) {
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
