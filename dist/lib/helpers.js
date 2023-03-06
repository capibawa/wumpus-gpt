"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.limit = exports.destroyThread = void 0;
async function destroyThread(thread) {
    await thread.delete();
    const starterMessage = await thread.fetchStarterMessage();
    if (starterMessage) {
        await starterMessage.delete();
    }
}
exports.destroyThread = destroyThread;
function limit(str, limit) {
    return str.length > limit ? `${str.slice(0, limit - 3)}...` : str;
}
exports.limit = limit;
