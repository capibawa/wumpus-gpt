"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const discord_js_1 = require("discord.js");
const sequelize_1 = require("sequelize");
const helpers_1 = require("../lib/helpers");
const conversation_1 = tslib_1.__importDefault(require("../models/conversation"));
async function pruneThreads(client) {
    try {
        const conversations = await conversation_1.default.findAll({
            where: {
                expiresAt: {
                    [sequelize_1.Op.lte]: new Date(),
                },
            },
        });
        for (const conversation of conversations) {
            let channel = null;
            try {
                channel = await client.channels.fetch(conversation.channelId);
            }
            catch (err) {
            }
            if (channel && channel.isThread()) {
                let message = null;
                try {
                    message = await channel.parent?.messages.fetch(conversation.messageId);
                }
                catch (err) {
                }
                if (message && message.embeds.length > 0) {
                    const embed = message.embeds[0];
                    await message.edit({
                        embeds: [
                            new discord_js_1.EmbedBuilder()
                                .setColor(discord_js_1.Colors.Yellow)
                                .setTitle(embed.title)
                                .setDescription('Conversation deleted due to inactivity.')
                                .setFields(embed.fields.filter((field) => field.name !== 'Thread')),
                        ],
                    });
                }
                await (0, helpers_1.destroyThread)(channel);
            }
            await conversation.destroy();
        }
        if (conversations.length > 0) {
            console.log(`Pruned ${conversations.length} expired conversations.`);
        }
    }
    catch (err) {
        console.error(err);
    }
}
exports.default = pruneThreads;
