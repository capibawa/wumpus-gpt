"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_module_loader_1 = require("discord-module-loader");
const discord_js_1 = require("discord.js");
const openai_1 = require("../lib/openai");
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
        ],
    },
    execute: async (interaction) => {
        const message = interaction.options.getString('message');
        if (!message || message.length === 0) {
            await interaction.reply({
                content: 'You must provide a message to start a conversation!',
                ephemeral: true,
            });
            return;
        }
        await interaction.deferReply();
        try {
            const response = await (0, openai_1.getChatResponse)([
                { role: 'user', content: message },
            ]);
            await interaction.editReply(response);
        }
        catch (err) {
            if (err instanceof Error) {
                await interaction.editReply(err.message);
            }
        }
    },
});
