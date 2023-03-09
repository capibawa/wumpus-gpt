"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTextFlagged = exports.createImage = exports.createChatCompletion = exports.CompletionStatus = void 0;
const tslib_1 = require("tslib");
const axios_1 = tslib_1.__importDefault(require("axios"));
const openai_1 = require("openai");
const config_1 = tslib_1.__importDefault(require("../config"));
const configuration = new openai_1.Configuration({ apiKey: config_1.default.openai.api_key });
const openai = new openai_1.OpenAIApi(configuration);
var CompletionStatus;
(function (CompletionStatus) {
    CompletionStatus[CompletionStatus["Ok"] = 0] = "Ok";
    CompletionStatus[CompletionStatus["Moderated"] = 1] = "Moderated";
    CompletionStatus[CompletionStatus["ContextLengthExceeded"] = 2] = "ContextLengthExceeded";
    CompletionStatus[CompletionStatus["InvalidRequest"] = 3] = "InvalidRequest";
    CompletionStatus[CompletionStatus["UnexpectedError"] = 4] = "UnexpectedError";
})(CompletionStatus = exports.CompletionStatus || (exports.CompletionStatus = {}));
async function createChatCompletion(messages) {
    try {
        const completion = await openai.createChatCompletion({
            model: 'gpt-3.5-turbo',
            messages,
            temperature: Number(config_1.default.openai.temperature),
            top_p: Number(config_1.default.openai.top_p),
            frequency_penalty: Number(config_1.default.openai.frequency_penalty),
            presence_penalty: Number(config_1.default.openai.presence_penalty),
            max_tokens: Number(config_1.default.openai.max_tokens),
        });
        const message = completion.data.choices[0].message;
        if (message) {
            return {
                status: CompletionStatus.Ok,
                message: message.content.trim(),
            };
        }
    }
    catch (err) {
        if (axios_1.default.isAxiosError(err)) {
            if (err.response?.data?.error?.code === 'context_length_exceeded') {
                return {
                    status: CompletionStatus.ContextLengthExceeded,
                    message: 'The request has exceeded the token limit. Try again with a shorter message or start another conversation.',
                };
            }
            else if (err.response?.data?.error?.type === 'invalid_request_error') {
                logError(err);
                const error = err.response.data.error;
                return {
                    status: CompletionStatus.InvalidRequest,
                    message: error.message,
                };
            }
        }
        else {
            logError(err);
            return {
                status: CompletionStatus.UnexpectedError,
                message: err instanceof Error ? err.message : err,
            };
        }
    }
    return {
        status: CompletionStatus.UnexpectedError,
        message: 'There was an unexpected error processing your request.',
    };
}
exports.createChatCompletion = createChatCompletion;
async function createImage(prompt) {
    let imageUrl = '';
    try {
        const image = await openai.createImage({
            prompt,
        });
        imageUrl = image.data.data[0].url || '';
    }
    catch (err) {
        logError(err);
    }
    return imageUrl;
}
exports.createImage = createImage;
async function isTextFlagged(input) {
    let flagged = false;
    try {
        const moderation = await openai.createModeration({
            input,
        });
        flagged = moderation.data.results[0].flagged;
    }
    catch (err) {
        logError(err);
    }
    return flagged;
}
exports.isTextFlagged = isTextFlagged;
function logError(err) {
    if (axios_1.default.isAxiosError(err)) {
        if (err.response) {
            console.log(err.response.status);
            console.log(err.response.data);
        }
        else {
            console.log(err.message);
        }
    }
    else {
        console.log(err);
    }
}
