import type { RateLimitDecision, RateLimiter } from "./rate-limit-types";
import { RATE_LIMITED_MESSAGE } from "./rate-limit-types";

type RejectedRateLimitDecision = Extract<RateLimitDecision, { allowed: false }>;

export function createRateLimitedResponse(decision: RejectedRateLimitDecision) {
  return {
    body: {
      error: {
        code: "RATE_LIMITED",
        message: RATE_LIMITED_MESSAGE,
        retryAfterSeconds: decision.retryAfterSeconds,
      },
    } as const,
    headers: { "Retry-After": String(decision.retryAfterSeconds) },
  };
}

export function consumeAuthenticatedRateLimit(
  limiter: RateLimiter,
  userId: string,
) {
  const decision = limiter.consume(userId);
  return decision.allowed ? null : createRateLimitedResponse(decision);
}
