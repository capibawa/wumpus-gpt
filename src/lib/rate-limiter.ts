import { RateLimiter as Limiter } from 'limiter';
import { Interval } from 'limiter/dist/cjs/TokenBucket';

export class RateLimiter {
  private limiters: { [key: string]: Limiter } = {};

  constructor(public attempts: number, public interval?: Interval) {}

  public attempt(key: string, callback: () => void): boolean {
    let limiter = this.limiters[key];

    if (!limiter) {
      limiter = new Limiter({
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
