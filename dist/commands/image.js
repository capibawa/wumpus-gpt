"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_module_loader_1 = require("discord-module-loader");
const discord_js_1 = require("discord.js");
const openai_1 = require("../lib/openai");
const rate_limiter_1 = require("../lib/rate-limiter");
const rateLimiter = new rate_limiter_1.RateLimiter(1, 'minute');
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
                content: 'You must provide a prompt to create an image!',
                ephemeral: true,
            });
            return;
        }
        if (prompt.length > 1000) {
            await interaction.reply({
                content: 'Your prompt is too long, try shortening it!',
                ephemeral: true,
            });
            return;
        }
        if (await (0, openai_1.isTextFlagged)(prompt)) {
            await interaction.reply({
                content: 'Your prompt has been blocked by moderation!',
                ephemeral: true,
            });
            return;
        }
        const executed = rateLimiter.attempt(interaction.user.id, async () => {
            await interaction.deferReply();
            const imageUrl = await (0, openai_1.createImage)(prompt);
            if (!imageUrl) {
                await interaction.editReply('There was an error while processing your response.');
                return;
            }
            await interaction.editReply({
                files: [
                    {
                        attachment: imageUrl,
                        name: 'image.png',
                    },
                ],
            });
        });
        if (!executed) {
            await interaction.reply({
                content: 'You are currently being rate limited.',
                ephemeral: true,
            });
        }
    },
});
