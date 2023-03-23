"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const discord_module_loader_1 = require("@biscxit/discord-module-loader");
const croner_1 = tslib_1.__importDefault(require("croner"));
const discord_js_1 = require("discord.js");
const config_1 = tslib_1.__importDefault(require("../config"));
const prune_threads_1 = tslib_1.__importDefault(require("../jobs/prune-threads"));
exports.default = new discord_module_loader_1.Event({
    name: discord_js_1.Events.ClientReady,
    once: true,
    execute: async (client) => {
        if (!client.user) {
            return;
        }
        process.on('uncaughtException', (err) => {
            console.error(err);
            if (!(err instanceof discord_js_1.DiscordAPIError)) {
                process.exit(1);
            }
        });
        process.on('unhandledRejection', (err) => {
            console.error(err);
            if (!(err instanceof discord_js_1.DiscordAPIError)) {
                process.exit(1);
            }
        });
        const job = (0, croner_1.default)('* * * * *', async () => {
            await (0, prune_threads_1.default)(client);
        });
        console.log(`\nLogged in as ${client.user.tag}!`);
        console.log(`You can invite this bot with the following URL: ${config_1.default.bot.invite_url}\n`);
        await job.trigger();
    },
});
