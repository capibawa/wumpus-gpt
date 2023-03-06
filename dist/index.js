"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const discord_module_loader_1 = tslib_1.__importDefault(require("discord-module-loader"));
const discord_js_1 = require("discord.js");
const path_1 = tslib_1.__importDefault(require("path"));
const toad_scheduler_1 = require("toad-scheduler");
const config_1 = tslib_1.__importDefault(require("./config"));
const helpers_1 = require("./lib/helpers");
const prisma_1 = tslib_1.__importDefault(require("./lib/prisma"));
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.DirectMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
    ],
    partials: [discord_js_1.Partials.Channel],
});
const moduleLoader = new discord_module_loader_1.default(client);
const scheduler = new toad_scheduler_1.ToadScheduler();
client.on('ready', async () => {
    if (!client.user || !client.application) {
        return;
    }
    try {
        const isTsNode = process.argv[0].includes('ts-node');
        if (isTsNode) {
            require('./load-modules');
        }
        const modulesDir = isTsNode ? '.ts-node' : 'dist';
        const commandsPath = path_1.default.join(__dirname, `../${modulesDir}`, 'commands');
        const eventsPath = path_1.default.join(__dirname, `../${modulesDir}`, 'events');
        await moduleLoader.loadCommands(commandsPath);
        await moduleLoader.loadEvents(eventsPath);
        await moduleLoader.updateSlashCommands();
    }
    catch (err) {
        console.error(err);
        await prisma_1.default.$disconnect();
        process.exit(1);
    }
    const task = new toad_scheduler_1.AsyncTask('prune-conversations', async () => {
        try {
            const conversations = await prisma_1.default.conversation.findMany({
                where: {
                    expiresAt: {
                        lte: new Date(),
                    },
                },
            });
            for (const conversation of conversations) {
                const channel = await client.channels.cache.get(conversation.channelId);
                if (channel && channel.isThread()) {
                    const interaction = await channel.parent?.messages.fetch(conversation.interactionId);
                    if (interaction && interaction.embeds.length > 0) {
                        const embed = interaction.embeds[0];
                        await interaction.edit({
                            embeds: [
                                new discord_js_1.EmbedBuilder()
                                    .setColor(discord_js_1.Colors.Yellow)
                                    .setTitle('Conversation deleted due to inactivity.')
                                    .setDescription(embed.description)
                                    .setFields(embed.fields[0]),
                            ],
                        });
                    }
                    await (0, helpers_1.destroyThread)(channel);
                }
                await prisma_1.default.conversation.delete({
                    where: {
                        id: conversation.id,
                    },
                });
            }
            if (conversations.length > 0) {
                console.log(`Pruned ${conversations.length} expired conversations.`);
            }
        }
        catch (err) {
            console.error(err);
        }
    }, (err) => {
        console.error(err);
    });
    const job = new toad_scheduler_1.SimpleIntervalJob({
        minutes: 1,
        runImmediately: true,
    }, task);
    scheduler.addSimpleIntervalJob(job);
    console.log(`Logged in as ${client.user.tag}!`);
    console.log(`You can invite this bot with the following URL: ${config_1.default.bot.invite_url}\n`);
});
prisma_1.default
    .$connect()
    .then(async () => {
    await client.login(process.env.DISCORD_TOKEN);
})
    .catch((err) => {
    console.error(err);
});
