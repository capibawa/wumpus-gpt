"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_module_loader_1 = require("discord-module-loader");
const discord_js_1 = require("discord.js");
const completion_1 = require("../lib/completion");
exports.default = new discord_module_loader_1.DiscordEvent(discord_js_1.Events.MessageCreate, async (message) => {
    const client = message.client;
    if (message.author.id === client.user.id) {
        return;
    }
    const channel = message.channel;
    if (!channel.isThread()) {
        return;
    }
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
    const response = await (0, completion_1.getChatResponse)(parsedMessages);
    if (!response) {
        await messages
            .first()
            ?.reply('There was an error while processing a response!');
        return;
    }
    await channel.send(response);
});
