"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const discord_module_loader_1 = require("discord-module-loader");
const discord_js_1 = require("discord.js");
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
        ],
    },
    execute: async (interaction) => {
        if (!interaction.isChatInputCommand()) {
            return;
        }
        const message = interaction.options.getString('message')?.trim();
        if (!message || message.length === 0) {
            await interaction.reply({
                content: 'You must provide a message to start a conversation!',
                ephemeral: true,
            });
            return;
        }
        const channel = interaction.channel;
        if (!channel) {
            await interaction.reply({
                content: 'There was an error while executing this command!',
                ephemeral: true,
            });
            return;
        }
        if (!(channel instanceof discord_js_1.TextChannel)) {
            await interaction.reply({
                content: "You can't start a conversation here!",
                ephemeral: true,
            });
            return;
        }
        const executed = rateLimiter.attempt(interaction.user.id, async () => {
            await interaction.reply({
                embeds: [getThreadCreatingEmbed(interaction.user, message)],
            });
            let response = null;
            try {
                response = await (0, openai_1.getChatResponse)([{ role: 'user', content: message }]);
            }
            catch (err) {
                if (err instanceof Error) {
                    const isModerated = err.message.includes('moderation');
                    await interaction.editReply({
                        embeds: [
                            isModerated
                                ? getModeratedEmbed(interaction.user, message)
                                : getErrorEmbed(interaction.user, message),
                        ],
                    });
                    return;
                }
                throw err;
            }
            try {
                const thread = await channel.threads.create({
                    name: `💬 ${interaction.user.username} - ${(0, helpers_1.limit)(message, 50)}`,
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
                await thread.members.add(interaction.user);
                await thread.send(response);
                await interaction.editReply({
                    embeds: [getThreadCreatedEmbed(interaction.user, message, thread)],
                });
            }
            catch (err) {
                console.error(err);
                await interaction.editReply({
                    embeds: [getErrorEmbed(interaction.user, message)],
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
function getBaseEmbed(user, message) {
    return new discord_js_1.EmbedBuilder()
        .setColor(discord_js_1.Colors.Green)
        .setDescription(`<@${user.id}> has started a conversation! 💬`)
        .setFields({ name: 'Message', value: message });
}
function getThreadCreatingEmbed(user, message) {
    return getBaseEmbed(user, message).addFields({
        name: 'Thread',
        value: 'Creating...',
    });
}
function getThreadCreatedEmbed(user, message, thread) {
    return getBaseEmbed(user, message).addFields({
        name: 'Thread',
        value: thread.toString(),
    });
}
function getModeratedEmbed(user, message) {
    return getBaseEmbed(user, message)
        .setColor(discord_js_1.Colors.DarkRed)
        .setTitle('Your message has been blocked by moderation.')
        .setFields({ name: 'Message', value: 'REDACTED' });
}
function getErrorEmbed(user, message) {
    return getBaseEmbed(user, message)
        .setColor(discord_js_1.Colors.Red)
        .setTitle('There was an error while creating a thread.');
}
