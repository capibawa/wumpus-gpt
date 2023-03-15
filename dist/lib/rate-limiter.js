"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const limiter_1 = require("limiter");
class RateLimiter {
    constructor(attempts, interval) {
        this.attempts = attempts;
        this.interval = interval;
        this.limiters = {};
    }
    attempt(key, callback) {
        let limiter = this.limiters[key];
        if (!limiter) {
            limiter = new limiter_1.RateLimiter({
                tokensPerInterval: this.attempts,
                interval: this.interval || 'minute',
            });
            this.limiters[key] = limiter;
        }
        if (!limiter.tryRemoveTokens(1)) {
            return false;
        }
        callback();
        return true;
    }
}
exports.default = RateLimiter;
