export type RateLimitDecision =
  { allowed: true } | { allowed: false; retryAfterSeconds: number };

export type RateLimiter = {
  consume(subject: string): RateLimitDecision;
};

export const RATE_LIMITED_MESSAGE =
  "Has realizado demasiadas solicitudes. Inténtalo nuevamente en un momento.";
