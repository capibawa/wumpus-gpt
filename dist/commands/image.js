"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const discord_module_loader_1 = require("discord-module-loader");
const discord_js_1 = require("discord.js");
const openai_1 = require("../lib/openai");
const rate_limiter_1 = tslib_1.__importDefault(require("../lib/rate-limiter"));
const rateLimiter = new rate_limiter_1.default(1, 'minute');
exports.default = new discord_module_loader_1.DiscordCommand({
    command: {
        name: 'image',
        description: 'Create an image given a prompt!',
        options: [
            {
                type: discord_js_1.ApplicationCommandOptionType.String,
                name: 'prompt',
                description: 'A text description of the desired image.',
                maxLength: 1000,
                required: true,
            },
        ],
    },
    execute: async (interaction) => {
        if (!interaction.isChatInputCommand()) {
            return;
        }
        const prompt = interaction.options.getString('prompt')?.trim();
        if (!prompt || prompt.length === 0) {
            await interaction.reply({
                content: 'You must provide a prompt.',
                ephemeral: true,
            });
            return;
        }
        if (prompt.length > 1000) {
            await interaction.reply({
                content: 'Your prompt is too long, please try shortening it.',
                ephemeral: true,
            });
            return;
        }
        const executed = rateLimiter.attempt(interaction.user.id, async () => {
            await interaction.deferReply();
            const completion = await (0, openai_1.createImage)(prompt);
            const messageOptions = {};
            if (completion.status !== openai_1.CompletionStatus.Ok) {
                messageOptions.content = completion.message;
            }
            else {
                messageOptions.files = [
                    { attachment: completion.message, name: 'image.png' },
                ];
            }
            await interaction.editReply(messageOptions);
        });
        if (!executed) {
            await interaction.reply({
                content: 'You are currently being rate limited.',
                ephemeral: true,
            });
        }
    },
});
