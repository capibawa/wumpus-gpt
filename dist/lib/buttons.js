"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRegenerateButton = exports.createActionRow = void 0;
const discord_js_1 = require("discord.js");
function createActionRow(...components) {
    return new discord_js_1.ActionRowBuilder().addComponents(...components);
}
exports.createActionRow = createActionRow;
function createRegenerateButton(loading = false) {
    return new discord_js_1.ButtonBuilder()
        .setCustomId('regenerate')
        .setLabel(!loading ? 'Regenerate' : 'Regenerating...')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setDisabled(loading);
}
exports.createRegenerateButton = createRegenerateButton;
