"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_module_loader_1 = require("@biscxit/discord-module-loader");
const discord_js_1 = require("discord.js");
const embeds_1 = require("../lib/embeds");
const helpers_1 = require("../lib/helpers");
const openai_1 = require("../lib/openai");
exports.default = new discord_module_loader_1.Command({
    data: new discord_js_1.SlashCommandBuilder()
        .setName('ask')
        .setDescription('Ask anything!')
        .addStringOption((option) => option
        .setName('question')
        .setDescription('The question to ask the bot.')
        .setRequired(true)
        .setMaxLength(1024))
        .addStringOption((option) => option
        .setName('behavior')
        .setDescription('Specify how the bot should behave.')
        .setMaxLength(1024))
        .addBooleanOption((option) => option
        .setName('hidden')
        .setDescription('Whether or not the response should be shown.')),
    rateLimiter: {
        points: 5,
        duration: 60,
    },
    execute: async (interaction) => {
        const input = {
            question: interaction.options.getString('question') ?? '',
            behavior: interaction.options.getString('behavior') ?? '',
            hidden: interaction.options.getBoolean('hidden') ?? false,
        };
        if (!input.question) {
            await interaction.reply({
                embeds: [(0, embeds_1.createErrorEmbed)('You must provide a question.')],
                ephemeral: true,
            });
            return;
        }
        await interaction.deferReply({ ephemeral: input.hidden });
        const completion = await (0, openai_1.createChatCompletion)((0, helpers_1.buildContext)([], input.question, input.behavior));
        await interaction.editReply(completion.status === openai_1.CompletionStatus.Ok
            ? { content: completion.message }
            : { embeds: [(0, embeds_1.createErrorEmbed)(completion.message)] });
    },
});
