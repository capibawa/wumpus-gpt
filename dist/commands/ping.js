"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_module_loader_1 = require("@biscxit/discord-module-loader");
const discord_js_1 = require("discord.js");
exports.default = new discord_module_loader_1.Command({
    data: new discord_js_1.SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
    execute: async (interaction) => {
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(discord_js_1.Colors.Green)
            .setTitle('Pong!')
            .setDescription('Measuring ping...');
        const message = await interaction.reply({
            embeds: [embed],
            fetchReply: true,
        });
        const ping = message.createdTimestamp - interaction.createdTimestamp;
        await interaction.editReply({
            embeds: [embed.setDescription(`Took ${ping} ms.`)],
        });
    },
});
