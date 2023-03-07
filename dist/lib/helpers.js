"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exceedsTokenLimit = exports.getTokensFromText = exports.destroyThread = exports.validateMessage = exports.toChatMessage = exports.getSystemMessage = exports.generateAllChatMessages = exports.generateChatMessages = void 0;
const tslib_1 = require("tslib");
const format_1 = tslib_1.__importDefault(require("date-fns/format"));
const gpt3_tokenizer_1 = tslib_1.__importDefault(require("gpt3-tokenizer"));
const openai_1 = require("openai");
const config_1 = tslib_1.__importDefault(require("../config"));
const tokenizer = new gpt3_tokenizer_1.default({ type: 'gpt3' });
function generateChatMessages(message, behavior) {
    return [
        getSystemMessage(behavior),
        {
            role: 'user',
            content: typeof message === 'string' ? message : message.content,
        },
    ];
}
exports.generateChatMessages = generateChatMessages;
function generateAllChatMessages(client, message, messages) {
    if (messages.size === 0) {
        return generateChatMessages(message);
    }
    const firstMessage = messages.last();
    if (!firstMessage || firstMessage?.embeds.length === 0) {
        return generateChatMessages(message);
    }
    const prompt = firstMessage.embeds[0].fields?.[0].value;
    const behavior = firstMessage.embeds[0].fields?.[1].value;
    if (!prompt || !behavior) {
        return generateChatMessages(message);
    }
    return [
        getSystemMessage(behavior !== 'Default' ? behavior : undefined),
        { role: 'user', content: prompt },
        ...messages
            .filter((message) => message.content && message.embeds.length === 0)
            .map((message) => toChatMessage(client, message))
            .reverse(),
        typeof message === 'string'
            ? { role: 'user', content: message }
            : toChatMessage(client, message),
    ];
}
exports.generateAllChatMessages = generateAllChatMessages;
function getSystemMessage(message) {
    if (message && message.slice(-1) !== '.') {
        message += '.';
    }
    return {
        role: openai_1.ChatCompletionRequestMessageRoleEnum.System,
        content: (message || config_1.default.bot.instructions) +
            ` The current date is ${(0, format_1.default)(new Date(), 'PPP')}.`,
    };
}
exports.getSystemMessage = getSystemMessage;
function toChatMessage(client, message) {
    return {
        role: message.author.id === client.user.id
            ? openai_1.ChatCompletionRequestMessageRoleEnum.Assistant
            : openai_1.ChatCompletionRequestMessageRoleEnum.User,
        content: message.content,
    };
}
exports.toChatMessage = toChatMessage;
async function validateMessage(message, alias = 'message') {
    message = typeof message === 'string' ? message : message?.content;
    if (!message || message.length === 0) {
        throw new Error(`There was an error processing your ${alias}.`);
    }
    if (exceedsTokenLimit(message)) {
        throw new Error(`Your ${alias} is too long, please try shortening it.`);
    }
    return true;
}
exports.validateMessage = validateMessage;
async function destroyThread(channel) {
    await channel.delete();
    const starterMessage = await channel.fetchStarterMessage();
    if (starterMessage) {
        await starterMessage.delete();
    }
}
exports.destroyThread = destroyThread;
function getTokensFromText(text) {
    return text ? tokenizer.encode(text).bpe.length : 0;
}
exports.getTokensFromText = getTokensFromText;
function exceedsTokenLimit(text) {
    return getTokensFromText(text) > config_1.default.openai.max_tokens;
}
exports.exceedsTokenLimit = exceedsTokenLimit;
