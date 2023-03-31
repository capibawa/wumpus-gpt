"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_module_loader_1 = require("@biscxit/discord-module-loader");
const discord_js_1 = require("discord.js");
const embeds_1 = require("../lib/embeds");
const openai_1 = require("../lib/openai");
exports.default = new discord_module_loader_1.Command({
    data: new discord_js_1.SlashCommandBuilder()
        .setName('image')
        .setDescription('Create an image given a prompt!')
        .addStringOption((option) => option
        .setName('prompt')
        .setDescription('A text description of the desired image.')
        .setRequired(true)
        .setMaxLength(1000))
        .addBooleanOption((option) => option
        .setName('hidden')
        .setDescription('Whether or not the response should be shown.')),
    rateLimiter: {
        points: 3,
        duration: 60,
    },
    execute: async (interaction) => {
        const input = {
            prompt: interaction.options.getString('prompt') ?? '',
            hidden: interaction.options.getBoolean('hidden') ?? false,
        };
        if (!input.prompt) {
            await interaction.reply({
                embeds: [(0, embeds_1.createErrorEmbed)('You must provide a prompt.')],
                ephemeral: true,
            });
            return;
        }
        await interaction.deferReply({ ephemeral: input.hidden });
        const completion = await (0, openai_1.createImage)(input.prompt);
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
    },
});
