"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.destroyThread = exports.exceedsTokenLimit = void 0;
const tslib_1 = require("tslib");
const gpt3_tokenizer_1 = tslib_1.__importDefault(require("gpt3-tokenizer"));
const config_1 = tslib_1.__importDefault(require("../config"));
let tokenizer;
function exceedsTokenLimit(text) {
    if (!tokenizer) {
        tokenizer = new gpt3_tokenizer_1.default({ type: 'gpt3' });
    }
    return tokenizer.encode(text).bpe.length > config_1.default.openai.max_tokens;
}
exports.exceedsTokenLimit = exceedsTokenLimit;
async function destroyThread(thread) {
    await thread.delete();
    const starterMessage = await thread.fetchStarterMessage();
    if (starterMessage) {
        await starterMessage.delete();
    }
}
exports.destroyThread = destroyThread;
