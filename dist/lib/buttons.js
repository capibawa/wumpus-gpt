"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRegenerateButton = exports.createActionRow = void 0;
const discord_js_1 = require("discord.js");
function createActionRow(...components) {
    return new discord_js_1.ActionRowBuilder().addComponents(...components);
}
exports.createActionRow = createActionRow;
function createRegenerateButton() {
    return new discord_js_1.ButtonBuilder()
        .setCustomId('regenerate')
        .setLabel('Regenerate')
        .setStyle(discord_js_1.ButtonStyle.Secondary);
}
exports.createRegenerateButton = createRegenerateButton;
