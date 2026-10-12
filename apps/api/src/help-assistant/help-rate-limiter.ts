import type { HelpRateLimiter } from "./help-assistant-types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type UserRequests = { timestamps: number[]; touchedAt: number };

export function createHelpRateLimiter(
  options: {
    now?: () => number;
    hourlyLimit?: number;
    dailyLimit?: number;
    maxUsers?: number;
  } = {},
): HelpRateLimiter {
  const now = options.now ?? Date.now;
  const hourlyLimit = options.hourlyLimit ?? 10;
  const dailyLimit = options.dailyLimit ?? 30;
  const maxUsers = options.maxUsers ?? 10_000;
  const requests = new Map<string, UserRequests>();

  function pruneExpiredUsers(currentTime: number) {
    for (const [userId, entry] of requests) {
      if (entry.touchedAt <= currentTime - DAY_MS) requests.delete(userId);
    }
  }

  function makeRoomForNewUser() {
    while (requests.size >= maxUsers) {
      let oldest: [string, UserRequests] | undefined;
      for (const entry of requests) {
        if (!oldest || entry[1].touchedAt < oldest[1].touchedAt) oldest = entry;
      }
      if (!oldest) break;
      requests.delete(oldest[0]);
    }
  }

  return {
    consume(userId) {
      const currentTime = now();
      pruneExpiredUsers(currentTime);
      if (!requests.has(userId)) makeRoomForNewUser();
      const entry = requests.get(userId) ?? {
        timestamps: [],
        touchedAt: currentTime,
      };
      entry.timestamps = entry.timestamps.filter(
        (timestamp) => timestamp > currentTime - DAY_MS,
      );
      entry.touchedAt = currentTime;
      const hourlyCount = entry.timestamps.filter(
        (timestamp) => timestamp > currentTime - HOUR_MS,
      ).length;
      if (hourlyCount >= hourlyLimit || entry.timestamps.length >= dailyLimit) {
        requests.set(userId, entry);
        return false;
      }
      entry.timestamps.push(currentTime);
      requests.set(userId, entry);
      return true;
    },
  };
}
