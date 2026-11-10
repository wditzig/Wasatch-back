import { createMiddleware } from "hono/factory";
import type { AppEnv, RateLimitRule } from "../context";
import { AppError } from "../errors";

/**
 * Fixed-window in-memory rate limiter. Adequate for a single API instance; replace the store
 * with Redis before running more than one instance (see docs/SECURITY.md).
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  check(key: string, rule: RateLimitRule, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      if (this.hits.size > 50_000) this.prune(now);
      this.hits.set(key, { count: 1, resetAt: now + rule.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    entry.count += 1;
    return { allowed: entry.count <= rule.limit, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }

  private prune(now: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}

export function enforceRateLimit(limiter: RateLimiter, key: string, rule: RateLimitRule): void {
  const result = limiter.check(key, rule);
  if (!result.allowed) {
    throw new AppError(429, "rate_limited", "Too many requests. Please wait a moment and try again.", {
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }
}

export function rateLimit(limiter: RateLimiter, name: string, rule: RateLimitRule) {
  return createMiddleware<AppEnv>(async (c, next) => {
    enforceRateLimit(limiter, `${name}:${c.get("ip")}`, rule);
    await next();
  });
}
