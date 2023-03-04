"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const discord_module_loader_1 = require("discord-module-loader");
const discord_js_1 = require("discord.js");
const config_1 = tslib_1.__importDefault(require("../config"));
const completion_1 = require("../lib/completion");
const helpers_1 = require("../lib/helpers");
const conversation_1 = tslib_1.__importDefault(require("../models/conversation"));
exports.default = new discord_module_loader_1.DiscordCommand({
    command: {
        name: 'chat',
        description: 'Start a conversation!',
        options: [
            {
                type: discord_js_1.ApplicationCommandOptionType.String,
                name: 'message',
                description: 'The message to start the conversation with.',
                required: true,
            },
        ],
    },
    execute: async (interaction) => {
        const channel = interaction.channel;
        if (!channel) {
            await interaction.reply({
                content: 'There was an error while executing this command!',
                ephemeral: true,
            });
            return;
        }
        if (channel.isThread()) {
            await interaction.reply({
                content: "You can't start a conversation in a thread!",
                ephemeral: true,
            });
            return;
        }
        const message = interaction.options.getString('message');
        if (!message || message.length === 0) {
            await interaction.reply({
                content: 'You must provide a message to start a conversation!',
                ephemeral: true,
            });
            return;
        }
        const user = interaction.user;
        await interaction.reply({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setColor(discord_js_1.Colors.Green)
                    .setDescription(`<@${user.id}> has started a conversation! 💬`)
                    .addFields({ name: 'Message', value: message }),
            ],
        });
        try {
            const thread = await channel.threads.create({
                name: `💬 ${user.username} - ${(0, helpers_1.limit)(message, 50)}`,
                autoArchiveDuration: 60,
                reason: config_1.default.bot.name,
                rateLimitPerUser: 1,
            });
            try {
                const pruneInterval = Math.ceil(config_1.default.bot.prune_interval);
                await conversation_1.default.create({
                    interactionId: (await interaction.fetchReply()).id,
                    threadId: thread.id,
                    expiresAt: pruneInterval > 0
                        ? new Date(Date.now() + 3600000 * pruneInterval)
                        : null,
                });
            }
            catch (err) {
                await (await thread.fetchStarterMessage())?.delete();
                await thread.delete();
                throw err;
            }
            await thread.members.add(user);
            await thread.sendTyping();
            const response = await (0, completion_1.getChatResponse)([
                { role: 'user', content: message },
            ]);
            await thread.send(response || 'There was an error while processing a response!');
        }
        catch (err) {
            console.error(err);
            await interaction.editReply({
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setColor(discord_js_1.Colors.Red)
                        .setTitle('There was an error while creating a thread.')
                        .setDescription(`<@${user.id}> has started a conversation! 💬`)
                        .addFields({ name: 'Message', value: message }),
                ],
            });
        }
    },
});
