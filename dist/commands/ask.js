"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_module_loader_1 = require("discord-module-loader");
const discord_js_1 = require("discord.js");
const lodash_1 = require("lodash");
const helpers_1 = require("../lib/helpers");
const openai_1 = require("../lib/openai");
const rate_limiter_1 = require("../lib/rate-limiter");
const rateLimiter = new rate_limiter_1.RateLimiter(5, 'minute');
exports.default = new discord_module_loader_1.DiscordCommand({
    command: {
        name: 'ask',
        description: 'Ask anything!',
        options: [
            {
                type: discord_js_1.ApplicationCommandOptionType.String,
                name: 'message',
                description: 'The message to say to the bot.',
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
        const executed = rateLimiter.attempt(interaction.user.id, async () => {
            await interaction.deferReply();
            const completion = await (0, openai_1.createChatCompletion)((0, helpers_1.generateChatMessages)(message, behavior));
            await interaction.editReply(completion.status === openai_1.CompletionStatus.Ok
                ? (0, lodash_1.truncate)(completion.message, { length: 2000 })
                : completion.message);
        });
        if (!executed) {
            await interaction.reply({
                content: 'You are currently being rate limited.',
                ephemeral: true,
            });
        }
    },
});
