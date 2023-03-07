"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const discord_module_loader_1 = require("discord-module-loader");
const discord_js_1 = require("discord.js");
const truncate_1 = tslib_1.__importDefault(require("lodash/truncate"));
const config_1 = tslib_1.__importDefault(require("../config"));
const helpers_1 = require("../lib/helpers");
const openai_1 = require("../lib/openai");
const prisma_1 = tslib_1.__importDefault(require("../lib/prisma"));
const rate_limiter_1 = require("../lib/rate-limiter");
const rateLimiter = new rate_limiter_1.RateLimiter(5, 900000);
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
            {
                type: discord_js_1.ApplicationCommandOptionType.String,
                name: 'behavior',
                description: 'Specify how the bot should behave.',
            },
        ],
    },
    execute: async (interaction) => {
        if (!interaction.isChatInputCommand()) {
            return;
        }
        const message = interaction.options.getString('message')?.trim();
        try {
            await (0, helpers_1.validateMessage)(message);
        }
        catch (err) {
            await interaction.reply({
                content: err.message,
                ephemeral: true,
            });
            return;
        }
        const behavior = interaction.options.getString('behavior')?.trim();
        if (behavior) {
            try {
                await (0, helpers_1.validateMessage)(behavior, 'behavior');
            }
            catch (err) {
                await interaction.reply({
                    content: err.message,
                    ephemeral: true,
                });
                return;
            }
        }
        const channel = interaction.channel;
        if (!channel || !(channel instanceof discord_js_1.TextChannel)) {
            await interaction.reply({
                content: "You can't start a conversation here!",
                ephemeral: true,
            });
            return;
        }
        const executed = rateLimiter.attempt(interaction.user.id, async () => {
            await interaction.deferReply();
            await interaction.editReply({
                embeds: [getThreadCreatingEmbed(interaction.user, message, behavior)],
            });
            const response = await (0, openai_1.createChatCompletion)((0, helpers_1.generateChatMessages)(message, behavior));
            if (!response) {
                await interaction.editReply({
                    embeds: [getErrorEmbed(interaction.user, message, behavior)],
                });
                return;
            }
            try {
                const thread = await channel.threads.create({
                    name: (0, truncate_1.default)(`💬 ${interaction.user.username} - ${message}`, {
                        length: 100,
                    }),
                    autoArchiveDuration: 60,
                    reason: config_1.default.bot.name,
                    rateLimitPerUser: 1,
                });
                const pruneInterval = Math.ceil(config_1.default.bot.prune_interval);
                if (pruneInterval > 0) {
                    try {
                        await prisma_1.default.conversation.create({
                            data: {
                                interactionId: (await interaction.fetchReply()).id,
                                channelId: thread.id,
                                expiresAt: new Date(Date.now() + 3600000 * pruneInterval),
                            },
                        });
                    }
                    catch (err) {
                        await (0, helpers_1.destroyThread)(thread);
                        throw err;
                    }
                }
                await thread.send({
                    embeds: [
                        new discord_js_1.EmbedBuilder().setColor(discord_js_1.Colors.Blue).setFields([
                            { name: 'Message', value: message },
                            { name: 'Behavior', value: behavior || 'Default' },
                        ]),
                    ],
                });
                await thread.members.add(interaction.user);
                await thread.send(response);
                await interaction.editReply({
                    embeds: [
                        getThreadCreatedEmbed(thread, interaction.user, message, behavior),
                    ],
                });
            }
            catch (err) {
                console.error(err);
                await interaction.editReply({
                    embeds: [getErrorEmbed(interaction.user, message, behavior)],
                });
            }
        });
        if (!executed) {
            await interaction.reply({
                content: 'You are currently being rate limited.',
                ephemeral: true,
            });
        }
    },
});
function getBaseEmbed(user, message, behavior) {
    return new discord_js_1.EmbedBuilder()
        .setColor(discord_js_1.Colors.Green)
        .setDescription(`<@${user.id}> has started a conversation! 💬`)
        .setFields([
        { name: 'Message', value: message },
        { name: 'Behavior', value: behavior || 'Default' },
    ]);
}
function getThreadCreatingEmbed(user, message, behavior) {
    return getBaseEmbed(user, message, behavior).addFields({
        name: 'Thread',
        value: 'Creating...',
    });
}
function getThreadCreatedEmbed(thread, user, message, behavior) {
    return getBaseEmbed(user, message, behavior).addFields({
        name: 'Thread',
        value: thread.toString(),
    });
}
function getErrorEmbed(user, message, behavior) {
    return getBaseEmbed(user, message, behavior)
        .setColor(discord_js_1.Colors.Red)
        .setTitle('There was an error while creating a thread');
}
