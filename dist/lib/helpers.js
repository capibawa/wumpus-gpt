"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.limit = void 0;
function limit(str, limit) {
    return str.length > limit ? `${str.slice(0, limit - 3)}...` : str;
}
exports.limit = limit;
