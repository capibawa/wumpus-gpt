"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_module_loader_1 = require("discord-module-loader");
const discord_js_1 = require("discord.js");
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
        if (!message || message.length === 0) {
            await interaction.reply({
                content: 'You must provide a message to start a conversation!',
                ephemeral: true,
            });
            return;
        }
        if ((0, helpers_1.exceedsTokenLimit)(message)) {
            await interaction.reply({
                content: 'Your message is too long, try shortening it!',
                ephemeral: true,
            });
            return;
        }
        const behavior = interaction.options.getString('behavior')?.trim();
        if (behavior && (await (0, openai_1.isTextFlagged)(behavior))) {
            await interaction.reply({
                content: 'Your behavior has been blocked by moderation!',
                ephemeral: true,
            });
            return;
        }
        const executed = rateLimiter.attempt(interaction.user.id, async () => {
            await interaction.deferReply();
            try {
                const response = await (0, openai_1.getChatResponse)([{ role: 'user', content: message }], behavior);
                await interaction.editReply(response);
            }
            catch (err) {
                await interaction.editReply(err instanceof Error
                    ? err.message
                    : 'There was an error while processing your response.');
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
