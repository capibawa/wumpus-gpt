"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTextFlagged = exports.createImage = exports.getModeratedChatMessages = exports.getChatResponse = void 0;
const tslib_1 = require("tslib");
const format_1 = tslib_1.__importDefault(require("date-fns/format"));
const openai_1 = require("openai");
const config_1 = tslib_1.__importDefault(require("../config"));
const helpers_1 = require("../lib/helpers");
const configuration = new openai_1.Configuration({ apiKey: config_1.default.openai.api_key });
const openai = new openai_1.OpenAIApi(configuration);
async function getChatResponse(messages) {
    const latestMessage = messages.pop();
    if (await isTextFlagged(latestMessage.content)) {
        throw new Error('Your message has been blocked by moderation.');
    }
    const systemMessage = {
        role: 'system',
        content: config_1.default.bot.instructions +
            ` The current date is ${(0, format_1.default)(new Date(), 'PPP')}.`,
    };
    const moderatedMessages = await getModeratedChatMessages(messages);
    const chatMessages = [systemMessage, ...moderatedMessages, latestMessage];
    if ((0, helpers_1.exceedsTokenLimit)(chatMessages.map((message) => message.content).join('\n'))) {
        throw new Error('The request has exceeded the token limit! Try again with a shorter message or start another conversation via the `/chat` command.');
    }
    try {
        const completion = await openai.createChatCompletion({
            model: 'gpt-3.5-turbo',
            messages: chatMessages,
            temperature: config_1.default.openai.temperature,
            top_p: config_1.default.openai.top_p,
            frequency_penalty: config_1.default.openai.frequency_penalty,
            presence_penalty: config_1.default.openai.presence_penalty,
            max_tokens: config_1.default.openai.max_tokens,
        });
        const message = completion.data.choices[0].message;
        if (message) {
            return message.content;
        }
    }
    catch (err) {
        console.error(err);
    }
    throw new Error('There was an error while processing a response.');
}
exports.getChatResponse = getChatResponse;
async function getModeratedChatMessages(messages) {
    const moderatedMessages = [];
    if (messages.length === 0) {
        return moderatedMessages;
    }
    const moderation = await openai.createModeration({
        input: messages.map((message) => message.role === 'user' ? message.content : ''),
    });
    moderation.data.results.forEach((result, index) => {
        const message = messages[index];
        if (message.role === 'user' && result.flagged) {
            return;
        }
        if (message.role === 'assistant' &&
            message.content === 'Your message has been blocked by moderation.') {
            return;
        }
        moderatedMessages.push(message);
    });
    return moderatedMessages;
}
exports.getModeratedChatMessages = getModeratedChatMessages;
async function createImage(prompt) {
    let imageUrl = '';
    try {
        const image = await openai.createImage({
            prompt,
        });
        imageUrl = image.data.data[0].url || '';
    }
    catch (err) {
        console.error(err);
    }
    return imageUrl;
}
exports.createImage = createImage;
async function isTextFlagged(input) {
    try {
        const moderation = await openai.createModeration({
            input,
        });
        return moderation.data.results[0].flagged;
    }
    catch (err) {
        console.error(err);
    }
    return false;
}
exports.isTextFlagged = isTextFlagged;
