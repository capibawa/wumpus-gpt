"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChatResponse = void 0;
const tslib_1 = require("tslib");
const gpt_3_encoder_1 = require("gpt-3-encoder");
const openai_1 = require("openai");
const config_1 = tslib_1.__importDefault(require("../config"));
const configuration = new openai_1.Configuration({ apiKey: config_1.default.openai.api_key });
const openai = new openai_1.OpenAIApi(configuration);
async function getChatResponse(messages) {
    try {
        const data = [
            { role: 'system', content: config_1.default.bot.instructions },
            ...messages,
        ];
        const input = data.map((message) => message.content).join('\n');
        if ((0, gpt_3_encoder_1.encode)(input).length > config_1.default.bot.token_limit) {
            return 'The request has exceeded the token limit! Try again with a shorter message or start another conversation via the `/chat` command.';
        }
        const completion = await openai.createChatCompletion({
            model: 'gpt-3.5-turbo',
            messages: data,
            temperature: 0.7,
            top_p: 1.0,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            max_tokens: config_1.default.bot.token_limit,
        });
        const message = completion.data.choices[0].message;
        if (message) {
            return message.content;
        }
    }
    catch (err) {
        console.error(err);
    }
    return false;
}
exports.getChatResponse = getChatResponse;
