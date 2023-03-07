"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const discord_module_loader_1 = require("discord-module-loader");
const discord_js_1 = require("discord.js");
const truncate_1 = tslib_1.__importDefault(require("lodash/truncate"));
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
    await channel.sendTyping();
    const messages = await channel.messages.fetch({ before: message.id });
    const response = await (0, openai_1.createChatCompletion)((0, helpers_1.generateAllChatMessages)(client, message, messages));
    if (!response) {
        handleFailedRequest(channel, message, 'An internal server error has occurred.');
        return;
    }
    await channel.send(response);
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
    await channel.send(response);
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
async function handleFailedRequest(channel, message, error) {
    const messageContent = (0, truncate_1.default)(message.content, { length: 100 });
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
