"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const discord_module_loader_1 = require("discord-module-loader");
const discord_js_1 = require("discord.js");
const truncate_1 = tslib_1.__importDefault(require("lodash/truncate"));
const config_1 = tslib_1.__importDefault(require("../config"));
const buttons_1 = require("../lib/buttons");
const embeds_1 = require("../lib/embeds");
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
        const validator = (0, helpers_1.validatePermissions)(interaction.guild?.members.me?.permissions, [
            discord_js_1.PermissionsBitField.Flags.SendMessages,
            discord_js_1.PermissionsBitField.Flags.SendMessagesInThreads,
            discord_js_1.PermissionsBitField.Flags.CreatePublicThreads,
            discord_js_1.PermissionsBitField.Flags.CreatePrivateThreads,
            discord_js_1.PermissionsBitField.Flags.ManageThreads,
            discord_js_1.PermissionsBitField.Flags.ReadMessageHistory,
        ]);
        if (validator.fails) {
            await interaction.reply({
                embeds: [(0, embeds_1.createErrorEmbed)(validator.message)],
            });
            return;
        }
        const input = {
            message: interaction.options.getString('message') ?? '',
            behavior: interaction.options.getString('behavior') ?? '',
        };
        if (!input.message) {
            await interaction.reply({
                embeds: [(0, embeds_1.createErrorEmbed)('You must provide a message.')],
                ephemeral: true,
            });
            return;
        }
        const channel = interaction.channel;
        if (!channel || channel.type !== discord_js_1.ChannelType.GuildText) {
            await interaction.reply({
                embeds: [(0, embeds_1.createErrorEmbed)("You can't start a conversation here.")],
                ephemeral: true,
            });
            return;
        }
        const executed = rateLimiter.attempt(interaction.user.id, async () => {
            await interaction.reply({
                embeds: [
                    (0, embeds_1.createThreadEmbed)(interaction.user, input.message, input.behavior),
                ],
            });
            const completion = await (0, openai_1.createChatCompletion)((0, helpers_1.generateChatMessages)(input.message, input.behavior));
            if (completion.status !== openai_1.CompletionStatus.Ok) {
                await interaction.editReply({
                    embeds: [
                        (0, embeds_1.createThreadErrorEmbed)(interaction.user, input.message, input.behavior, completion.message),
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
                    rateLimitPerUser: 3,
                });
                try {
                    const pruneInterval = Number(config_1.default.bot.prune_interval);
                    await conversation_1.default.create({
                        channelId: thread.id,
                        messageId: (await interaction.fetchReply()).id,
                        expiresAt: pruneInterval > 0
                            ? new Date(Date.now() + 3600000 * Math.ceil(pruneInterval))
                            : null,
                    });
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
                            (0, embeds_1.createThreadEmbed)(interaction.user, input.message, input.behavior, thread),
                        ],
                    });
                }
                catch (err) {
                    await (0, helpers_1.destroyThread)(thread);
                    throw err;
                }
            }
            catch (err) {
                let error = undefined;
                if (err instanceof discord_js_1.DiscordAPIError &&
                    (err.code === discord_js_1.RESTJSONErrorCodes.MissingAccess ||
                        err.code === discord_js_1.RESTJSONErrorCodes.MissingPermissions)) {
                    error =
                        'Missing permissions. Ensure that the bot has the following: ' +
                            `${validator.permissions.join(', ')}.`;
                }
                else {
                    console.error(err);
                }
                await interaction.editReply({
                    embeds: [
                        (0, embeds_1.createThreadErrorEmbed)(interaction.user, input.message, input.behavior, error),
                    ],
                });
            }
        });
        if (!executed) {
            await interaction.reply({
                embeds: [(0, embeds_1.createErrorEmbed)('You are currently being rate limited.')],
                ephemeral: true,
            });
        }
    },
});
