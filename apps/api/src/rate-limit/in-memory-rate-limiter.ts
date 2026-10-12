import type { RateLimiter } from "./rate-limit-types";

const DEFAULT_LIMIT = 300;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_SUBJECTS = 10_000;

type RateLimitEntry = {
  count: number;
  windowStartedAt: number;
  touchedAt: number;
};

type InMemoryRateLimiterOptions = {
  now?: () => number;
  limit?: number;
  windowMs?: number;
  maxSubjects?: number;
};

export function createInMemoryRateLimiter(
  options: InMemoryRateLimiterOptions = {},
): RateLimiter {
  const now = options.now ?? Date.now;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxSubjects = options.maxSubjects ?? DEFAULT_MAX_SUBJECTS;
  const entries = new Map<string, RateLimitEntry>();

  function pruneExpiredEntries(currentTime: number) {
    for (const [subject, entry] of entries) {
      if (currentTime - entry.touchedAt >= windowMs) entries.delete(subject);
    }
  }

  function makeRoomForNewSubject() {
    while (entries.size >= maxSubjects) {
      let oldestSubject: string | undefined;
      let oldestTouchedAt = Number.POSITIVE_INFINITY;

      for (const [subject, entry] of entries) {
        if (entry.touchedAt < oldestTouchedAt) {
          oldestSubject = subject;
          oldestTouchedAt = entry.touchedAt;
        }
      }

      if (!oldestSubject) return;
      entries.delete(oldestSubject);
    }
  }

  return {
    consume(subject) {
      const currentTime = now();
      pruneExpiredEntries(currentTime);

      let entry = entries.get(subject);
      if (!entry) {
        makeRoomForNewSubject();
        entry = {
          count: 0,
          windowStartedAt: currentTime,
          touchedAt: currentTime,
        };
      } else if (currentTime - entry.windowStartedAt >= windowMs) {
        entry.count = 0;
        entry.windowStartedAt = currentTime;
      }

      entry.touchedAt = currentTime;

      if (entry.count >= limit) {
        entries.set(subject, entry);
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((entry.windowStartedAt + windowMs - currentTime) / 1_000),
          ),
        };
      }

      entry.count += 1;
      entries.set(subject, entry);
      return { allowed: true };
    },
  };
}
