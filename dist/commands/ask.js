"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const discord_module_loader_1 = require("discord-module-loader");
const discord_js_1 = require("discord.js");
const embeds_1 = require("../lib/embeds");
const helpers_1 = require("../lib/helpers");
const openai_1 = require("../lib/openai");
const rate_limiter_1 = tslib_1.__importDefault(require("../lib/rate-limiter"));
const rateLimiter = new rate_limiter_1.default(3, 'minute');
exports.default = new discord_module_loader_1.DiscordCommand({
    command: {
        name: 'ask',
        description: 'Ask anything!',
        options: [
            {
                type: discord_js_1.ApplicationCommandOptionType.String,
                name: 'question',
                description: 'The question to ask the bot.',
                required: true,
                maxLength: 1024,
            },
            {
                type: discord_js_1.ApplicationCommandOptionType.String,
                name: 'behavior',
                description: 'Specify how the bot should behave.',
                maxLength: 1024,
            },
            {
                type: discord_js_1.ApplicationCommandOptionType.Boolean,
                name: 'hidden',
                description: 'Whether or not the response should be shown.',
            },
        ],
    },
    execute: async (interaction) => {
        if (!interaction.isChatInputCommand()) {
            return;
        }
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
        const executed = rateLimiter.attempt(interaction.user.id, async () => {
            await interaction.deferReply({ ephemeral: input.hidden });
            const completion = await (0, openai_1.createChatCompletion)((0, helpers_1.generateChatMessages)(input.question, input.behavior));
            await interaction.editReply(completion.status === openai_1.CompletionStatus.Ok
                ? { content: completion.message }
                : { embeds: [(0, embeds_1.createErrorEmbed)(completion.message)] });
        });
        if (!executed) {
            await interaction.reply({
                embeds: [(0, embeds_1.createErrorEmbed)('You are currently being rate limited.')],
                ephemeral: true,
            });
        }
    },
});
