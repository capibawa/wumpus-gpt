"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const croner_1 = tslib_1.__importDefault(require("croner"));
const discord_module_loader_1 = tslib_1.__importDefault(require("discord-module-loader"));
const discord_js_1 = require("discord.js");
const path_1 = tslib_1.__importDefault(require("path"));
const config_1 = tslib_1.__importDefault(require("./config"));
const prune_threads_1 = tslib_1.__importDefault(require("./jobs/prune-threads"));
const sequelize_1 = tslib_1.__importDefault(require("./lib/sequelize"));
const conversation_1 = tslib_1.__importDefault(require("./models/conversation"));
const isDev = process.argv[0].includes('ts-node');
const modulesDir = isDev ? '../.ts-node' : '../dist';
if (isDev) {
    require('@/load-modules');
}
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
    ],
});
client.on('ready', async () => {
    if (!client.user || !client.application) {
        return;
    }
    const moduleLoader = new discord_module_loader_1.default(client);
    const commands = await moduleLoader.loadCommands(path_1.default.join(__dirname, modulesDir, 'commands'));
    if (commands.length > 0) {
        console.log(`Loaded ${commands.length} commands:`, commands.map((command) => command[0]));
    }
    else {
        console.warn('No commands were found.');
    }
    const events = await moduleLoader.loadEvents(path_1.default.join(__dirname, modulesDir, 'events'));
    if (events.length > 0) {
        console.log(`Loaded ${events.length} events:`, events.map((event) => event[0]));
    }
    else {
        console.warn('No events were found.');
    }
    await moduleLoader.updateSlashCommands();
    const job = (0, croner_1.default)('* * * * *', async () => {
        await (0, prune_threads_1.default)(client);
    });
    console.log(`\nLogged in as ${client.user.tag}!`);
    console.log(`You can invite this bot with the following URL: ${config_1.default.bot.invite_url}\n`);
    await job.trigger();
});
sequelize_1.default
    .authenticate()
    .then(async () => {
    await conversation_1.default.sync();
    await client.login(config_1.default.discord.token);
})
    .catch((err) => {
    console.error('Unable to connect to the database:', err);
});
