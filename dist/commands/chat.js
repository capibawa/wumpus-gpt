"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const discord_module_loader_1 = require("discord-module-loader");
const discord_js_1 = require("discord.js");
const truncate_1 = tslib_1.__importDefault(require("lodash/truncate"));
const config_1 = tslib_1.__importDefault(require("../config"));
const buttons_1 = require("../lib/buttons");
const helpers_1 = require("../lib/helpers");
const openai_1 = require("../lib/openai");
const rate_limiter_1 = tslib_1.__importDefault(require("../lib/rate-limiter"));
const conversation_1 = tslib_1.__importDefault(require("../models/conversation"));
const rateLimiter = new rate_limiter_1.default(5, 900000);
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
                maxLength: 1024,
            },
            {
                type: discord_js_1.ApplicationCommandOptionType.String,
                name: 'behavior',
                description: 'Specify how the bot should behave.',
                maxLength: 1024,
            },
        ],
    },
    execute: async (interaction) => {
        if (!interaction.isChatInputCommand()) {
            return;
        }
        const input = {
            message: interaction.options.getString('message')?.trim() ?? '',
            behavior: interaction.options.getString('behavior')?.trim() ?? '',
        };
        if (!input.message) {
            await interaction.reply({
                content: 'You must provide a message.',
                ephemeral: true,
            });
            return;
        }
        const channel = interaction.channel;
        if (!channel || channel.type !== discord_js_1.ChannelType.GuildText) {
            await interaction.reply({
                content: "You can't start a conversation here.",
                ephemeral: true,
            });
            return;
        }
        const executed = rateLimiter.attempt(interaction.user.id, async () => {
            await interaction.deferReply();
            await interaction.editReply({
                embeds: [
                    getThreadCreatingEmbed(interaction.user, input.message, input.behavior),
                ],
            });
            const completion = await (0, openai_1.createChatCompletion)((0, helpers_1.generateChatMessages)(input.message, input.behavior));
            if (completion.status !== openai_1.CompletionStatus.Ok) {
                await interaction.editReply({
                    embeds: [
                        getErrorEmbed(interaction.user, input.message, input.behavior, completion.message),
                    ],
                });
                return;
            }
            try {
                const thread = await channel.threads.create({
                    name: (0, truncate_1.default)(`💬 ${interaction.user.username} - ${input.message}`, {
                        length: 100,
                    }),
                    autoArchiveDuration: 60,
                    reason: config_1.default.bot.name,
                    rateLimitPerUser: 1,
                });
                const pruneInterval = Number(config_1.default.bot.prune_interval);
                if (pruneInterval > 0) {
                    try {
                        await conversation_1.default.create({
                            interactionId: (await interaction.fetchReply()).id,
                            channelId: thread.id,
                            expiresAt: new Date(Date.now() + 3600000 * Math.ceil(pruneInterval)),
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
                            { name: 'Message', value: input.message },
                            { name: 'Behavior', value: input.behavior || 'Default' },
                        ]),
                    ],
                });
                await thread.members.add(interaction.user);
                await thread.send({
                    content: completion.message,
                    components: [(0, buttons_1.createActionRow)((0, buttons_1.createRegenerateButton)())],
                });
                await interaction.editReply({
                    embeds: [
                        getThreadCreatedEmbed(thread, interaction.user, input.message, input.behavior),
                    ],
                });
            }
            catch (err) {
                let error = undefined;
                if (err.code === 50001) {
                    error = 'Missing permissions to create threads.';
                }
                else {
                    console.error(err);
                }
                await interaction.editReply({
                    embeds: [
                        getErrorEmbed(interaction.user, input.message, input.behavior, error),
                    ],
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
    message = (0, truncate_1.default)(message, { length: 200 });
    behavior = behavior ? (0, truncate_1.default)(behavior, { length: 200 }) : undefined;
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
function getErrorEmbed(user, message, behavior, error) {
    return getBaseEmbed(user, message, behavior)
        .setColor(discord_js_1.Colors.Red)
        .setTitle('There was an error while creating a thread')
        .addFields({ name: 'Error', value: error || 'Unknown' });
}
