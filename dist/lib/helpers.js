"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitMessages = exports.exceedsTokenLimit = exports.getTokensFromText = exports.destroyThread = exports.validateMessage = exports.toChatMessage = exports.getSystemMessage = exports.generateAllChatMessages = exports.generateChatMessages = void 0;
const tslib_1 = require("tslib");
const format_1 = tslib_1.__importDefault(require("date-fns/format"));
const discord_js_1 = require("discord.js");
const gpt3_tokenizer_1 = tslib_1.__importDefault(require("gpt3-tokenizer"));
const lodash_1 = require("lodash");
const openai_1 = require("openai");
const config_1 = tslib_1.__importDefault(require("../config"));
const tokenizer = new gpt3_tokenizer_1.default({ type: 'gpt3' });
function generateChatMessages(message, behavior) {
    return [
        getSystemMessage(behavior),
        {
            role: 'user',
            content: (0, lodash_1.isString)(message) ? message : message.content,
        },
    ];
}
exports.generateChatMessages = generateChatMessages;
function generateAllChatMessages(message, messages, botId) {
    if ((0, lodash_1.isEmpty)(messages)) {
        return generateChatMessages(message);
    }
    const initialMessage = messages.last();
    if (!initialMessage ||
        (0, lodash_1.isEmpty)(initialMessage.embeds) ||
        (0, lodash_1.isEmpty)(initialMessage.embeds[0].fields)) {
        return generateChatMessages(message);
    }
    const embed = initialMessage.embeds[0];
    const prompt = embed.fields[0].name === 'Message' ? embed.fields[0].value : '';
    const behavior = embed.fields[1].name === 'Behavior' ? embed.fields[1].value : '';
    if (!prompt || !behavior) {
        return generateChatMessages(message);
    }
    return [
        getSystemMessage(behavior),
        { role: 'user', content: prompt },
        ...messages
            .filter((message) => message.type === discord_js_1.MessageType.Default &&
            message.content &&
            (0, lodash_1.isEmpty)(message.embeds) &&
            (0, lodash_1.isEmpty)(message.mentions.members))
            .map((message) => toChatMessage(message, botId))
            .reverse(),
        (0, lodash_1.isString)(message)
            ? { role: 'user', content: message }
            : toChatMessage(message, botId),
    ];
}
exports.generateAllChatMessages = generateAllChatMessages;
function getSystemMessage(message) {
    if (message === 'Default') {
        message = undefined;
    }
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
function toChatMessage(message, botId) {
    return {
        role: message.author.id === botId
            ? openai_1.ChatCompletionRequestMessageRoleEnum.Assistant
            : openai_1.ChatCompletionRequestMessageRoleEnum.User,
        content: message.content,
    };
}
exports.toChatMessage = toChatMessage;
async function validateMessage(message, alias = 'message') {
    message = (0, lodash_1.isString)(message) ? message : message?.content;
    if (!message) {
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
    return text ? tokenizer.encode(text).bpe.length + 1 : 0;
}
exports.getTokensFromText = getTokensFromText;
function exceedsTokenLimit(text) {
    return getTokensFromText(text) > 4096 - Number(config_1.default.openai.max_tokens);
}
exports.exceedsTokenLimit = exceedsTokenLimit;
function splitMessages(message, maxLength = 2000) {
    const messages = [];
    while (message.length > maxLength) {
        let pos = message.substring(0, maxLength).lastIndexOf(' ');
        pos = pos <= 0 ? maxLength : pos;
        messages.push(message.substring(0, pos));
        message = message.substring(pos);
    }
    messages.push(message);
    return messages;
}
exports.splitMessages = splitMessages;
