"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const discord_module_loader_1 = require("@biscxit/discord-module-loader");
const discord_js_1 = require("discord.js");
const config_1 = tslib_1.__importDefault(require("./config"));
const sequelize_1 = tslib_1.__importDefault(require("./lib/sequelize"));
const conversation_1 = tslib_1.__importDefault(require("./models/conversation"));
const isDev = process.argv.some((arg) => arg.includes('ts-node'));
const client = new discord_module_loader_1.Client({
    eventsDir: isDev ? 'src/events' : 'dist/events',
    commandsDir: isDev ? 'src/commands' : 'dist/commands',
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
    ],
});
sequelize_1.default
    .authenticate()
    .then(async () => {
    await conversation_1.default.sync();
    await client.initialize(config_1.default.discord.token);
})
    .catch((err) => {
    console.error(err);
});
