"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_module_loader_1 = require("discord-module-loader");
exports.default = new discord_module_loader_1.DiscordCommand({
    command: {
        name: 'ping',
        description: 'Replies with Pong!',
    },
    execute: async (interaction) => {
        if (!interaction.isChatInputCommand()) {
            return;
        }
        const ping = Math.abs(Date.now() - interaction.createdTimestamp);
        await interaction.reply(`Pong! \`Took ${ping}ms\``);
    },
});
