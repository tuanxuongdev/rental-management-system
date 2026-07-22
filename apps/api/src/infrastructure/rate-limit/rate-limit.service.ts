import { HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';

type Bucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, Bucket>();

  assertWithinLimit(
    key: string,
    limit: number,
    windowMs: number,
    options?: { failClosed?: boolean; unavailable?: boolean },
  ): void {
    if (options?.unavailable === true) {
      if (options.failClosed === true) {
        throw new ServiceUnavailableException({
          message: 'Rate limiting service unavailable',
          code: 'AUTH_RATE_LIMIT_UNAVAILABLE',
        });
      }
      return;
    }

    const now = Date.now();
    const existing = this.buckets.get(key);

    if (existing === undefined || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    if (existing.count >= limit) {
      throw new HttpException(
        {
          message: 'Too many attempts. Try again later.',
          code: 'AUTH_RATE_LIMITED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    existing.count += 1;
  }
}
