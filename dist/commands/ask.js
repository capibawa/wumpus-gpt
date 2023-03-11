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
        const executed = rateLimiter.attempt(interaction.user.id, async () => {
            await interaction.deferReply();
            const completion = await (0, openai_1.createChatCompletion)((0, helpers_1.generateChatMessages)(input.message, input.behavior));
            await interaction.editReply(completion.message);
        });
        if (!executed) {
            await interaction.reply({
                content: 'You are currently being rate limited.',
                ephemeral: true,
            });
        }
    },
});
