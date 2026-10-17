import { describe, expect, test } from "vitest";

import { createHelpRateLimiter } from "../src/help-assistant/help-rate-limiter";

describe("Orbit help rate limiter", () => {
  test("enforces the rolling hourly limit independently per user", () => {
    let now = 1_000_000;
    const limiter = createHelpRateLimiter({
      now: () => now,
      hourlyLimit: 2,
      dailyLimit: 4,
    });

    expect(limiter.consume("user-1")).toBe(true);
    expect(limiter.consume("user-1")).toBe(true);
    expect(limiter.consume("user-1")).toBe(false);
    expect(limiter.consume("user-2")).toBe(true);

    now += 60 * 60 * 1000 + 1;
    expect(limiter.consume("user-1")).toBe(true);
  });

  test("enforces the rolling daily limit across hourly windows", () => {
    let now = 1_000_000;
    const limiter = createHelpRateLimiter({
      now: () => now,
      hourlyLimit: 2,
      dailyLimit: 3,
    });

    expect(limiter.consume("user-1")).toBe(true);
    now += 60 * 60 * 1000 + 1;
    expect(limiter.consume("user-1")).toBe(true);
    now += 60 * 60 * 1000 + 1;
    expect(limiter.consume("user-1")).toBe(true);
    expect(limiter.consume("user-1")).toBe(false);

    now += 24 * 60 * 60 * 1000 + 1;
    expect(limiter.consume("user-1")).toBe(true);
  });

  test("bounds retained user keys", () => {
    const limiter = createHelpRateLimiter({
      maxUsers: 2,
      hourlyLimit: 1,
      dailyLimit: 1,
    });
    expect(limiter.consume("user-1")).toBe(true);
    expect(limiter.consume("user-2")).toBe(true);
    expect(limiter.consume("user-3")).toBe(true);
    expect(limiter.consume("user-1")).toBe(true);
  });

  test("does not reset an existing user's limit when the key cap is full", () => {
    const limiter = createHelpRateLimiter({
      maxUsers: 2,
      hourlyLimit: 2,
      dailyLimit: 2,
    });

    expect(limiter.consume("user-1")).toBe(true);
    expect(limiter.consume("user-2")).toBe(true);
    expect(limiter.consume("user-1")).toBe(true);
    expect(limiter.consume("user-1")).toBe(false);
  });
});
