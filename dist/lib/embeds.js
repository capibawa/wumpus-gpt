"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createThreadErrorEmbed = exports.createThreadEmbed = exports.createErrorEmbed = void 0;
const discord_js_1 = require("discord.js");
const lodash_1 = require("lodash");
function createErrorEmbed(message) {
    return new discord_js_1.EmbedBuilder()
        .setColor(discord_js_1.Colors.Red)
        .setTitle('An error has occurred')
        .setDescription(message);
}
exports.createErrorEmbed = createErrorEmbed;
function createThreadEmbed(user, message, behavior, thread) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(discord_js_1.Colors.Green)
        .setTitle((0, lodash_1.truncate)(message, { length: 200 }))
        .setDescription(`<@${user.id}> has started a conversation!`)
        .setFields({ name: 'Behavior', value: behavior || 'Default' });
    if (thread) {
        embed.addFields({ name: 'Thread', value: thread.toString() });
    }
    else {
        embed.setFooter({ text: 'Creating...' });
    }
    return embed;
}
exports.createThreadEmbed = createThreadEmbed;
function createThreadErrorEmbed(user, message, behavior, error) {
    return new discord_js_1.EmbedBuilder()
        .setColor(discord_js_1.Colors.Red)
        .setTitle((0, lodash_1.truncate)(message, { length: 200 }))
        .setDescription(`<@${user.id}> has started a conversation!`)
        .setFields([
        { name: 'Behavior', value: behavior || 'Default' },
        { name: 'Error', value: error || 'Unknown' },
    ]);
}
exports.createThreadErrorEmbed = createThreadErrorEmbed;
