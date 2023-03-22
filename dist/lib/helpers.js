"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getThreadPrefix = exports.destroyThread = exports.detachComponents = exports.validatePermissions = exports.buildThreadContext = exports.buildContext = void 0;
const tslib_1 = require("tslib");
const format_1 = tslib_1.__importDefault(require("date-fns/format"));
const discord_js_1 = require("discord.js");
const gpt3_tokenizer_1 = tslib_1.__importDefault(require("gpt3-tokenizer"));
const openai_1 = require("openai");
const config_1 = tslib_1.__importDefault(require("../config"));
function buildContext(messages, userMessage, instruction) {
    if (!instruction || instruction === 'Default') {
        instruction = config_1.default.bot.instruction;
    }
    instruction = instruction.trim();
    if (!instruction.endsWith('.')) {
        instruction += '.';
    }
    const systemMessageContext = {
        role: openai_1.ChatCompletionRequestMessageRoleEnum.System,
        content: instruction + ` The current date is ${(0, format_1.default)(new Date(), 'PPP')}.`,
    };
    const userMessageContext = {
        role: openai_1.ChatCompletionRequestMessageRoleEnum.User,
        content: userMessage,
    };
    if (messages.length === 0) {
        return [systemMessageContext, userMessageContext];
    }
    let tokenCount = 0;
    const contexts = [];
    const maxTokens = Number(config_1.default.openai.max_tokens) * messages.length;
    const tokenizer = new gpt3_tokenizer_1.default({ type: 'gpt3' });
    for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        const content = message.content;
        const encoded = tokenizer.encode(content);
        tokenCount += encoded.text.length;
        if (tokenCount > maxTokens) {
            contexts.push({
                role: message.role,
                content: content.slice(0, tokenCount - maxTokens),
            });
            break;
        }
        contexts.push({
            role: message.role,
            content,
        });
    }
    return [systemMessageContext, ...contexts, userMessageContext];
}
exports.buildContext = buildContext;
function buildThreadContext(messages, userMessage, botId) {
    if (messages.size === 0) {
        return buildContext([], userMessage);
    }
    const initialMessage = messages.last();
    if (!initialMessage ||
        initialMessage.embeds.length !== 1 ||
        initialMessage.embeds[0].fields.length !== 2) {
        return buildContext([], userMessage);
    }
    const embed = initialMessage.embeds[0];
    const prompt = embed.fields[0].name === 'Message' ? embed.fields[0].value : '';
    const behavior = embed.fields[1].name === 'Behavior' ? embed.fields[1].value : '';
    if (!prompt || !behavior) {
        return buildContext([], userMessage);
    }
    const context = [
        { role: openai_1.ChatCompletionRequestMessageRoleEnum.User, content: prompt },
        ...messages
            .filter((message) => message.type === discord_js_1.MessageType.Default &&
            message.content &&
            message.embeds.length === 0 &&
            (message.mentions.members?.size ?? 0) === 0)
            .map((message) => {
            return {
                role: message.author.id === botId
                    ? openai_1.ChatCompletionRequestMessageRoleEnum.Assistant
                    : openai_1.ChatCompletionRequestMessageRoleEnum.User,
                content: message.content,
            };
        })
            .reverse(),
    ];
    return buildContext(context, userMessage, behavior);
}
exports.buildThreadContext = buildThreadContext;
function validatePermissions(permissions, bits) {
    const requiredPermissions = new discord_js_1.PermissionsBitField([
        bits,
        discord_js_1.PermissionsBitField.Flags.UseApplicationCommands,
    ]);
    if (!permissions) {
        return {
            fails: true,
            message: 'Unable to fetch permissions.',
            permissions: requiredPermissions.toArray(),
        };
    }
    const missingPermissions = permissions.missing(requiredPermissions);
    if (missingPermissions.length > 0) {
        return {
            fails: true,
            message: `Missing permissions: ${missingPermissions.join(', ')}.`,
            permissions: requiredPermissions.toArray(),
        };
    }
    return {
        fails: false,
        message: '',
        permissions: requiredPermissions.toArray(),
    };
}
exports.validatePermissions = validatePermissions;
async function detachComponents(messages, botId) {
    try {
        await Promise.all(messages.map((message) => {
            if (message.author.id === botId && message.components.length > 0) {
                return message.edit({ components: [] });
            }
        }));
    }
    catch (err) {
        console.error(err);
    }
}
exports.detachComponents = detachComponents;
async function destroyThread(channel) {
    try {
        await channel.delete();
        const starterMessage = await channel.fetchStarterMessage();
        if (starterMessage) {
            await starterMessage.delete();
        }
    }
    catch (err) {
        if (err instanceof discord_js_1.DiscordAPIError &&
            err.code !== discord_js_1.RESTJSONErrorCodes.UnknownChannel &&
            err.code !== discord_js_1.RESTJSONErrorCodes.UnknownMessage) {
            console.error(err);
        }
    }
}
exports.destroyThread = destroyThread;
function getThreadPrefix() {
    return config_1.default.bot.thread_prefix ? config_1.default.bot.thread_prefix + ' ' : '';
}
exports.getThreadPrefix = getThreadPrefix;
