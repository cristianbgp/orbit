import { describe, expect, test } from "vitest";

import { createInMemoryRateLimiter } from "../src/rate-limit/in-memory-rate-limiter";

describe("in-memory rate limiter", () => {
  test("allows requests through the maximum and rejects the next request", () => {
    const limiter = createInMemoryRateLimiter({
      limit: 2,
      windowMs: 60_000,
      now: () => 10_000,
    });

    expect(limiter.consume("user-1")).toEqual({ allowed: true });
    expect(limiter.consume("user-1")).toEqual({ allowed: true });
    expect(limiter.consume("user-1")).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
  });

  test("rounds the remaining fixed-window duration up to whole seconds", () => {
    let currentTime = 1_000;
    const limiter = createInMemoryRateLimiter({
      limit: 1,
      windowMs: 60_000,
      now: () => currentTime,
    });

    expect(limiter.consume("user-1")).toEqual({ allowed: true });
    currentTime = 60_001;

    expect(limiter.consume("user-1")).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
  });

  test("starts a new allowance at the exact fixed-window boundary", () => {
    let currentTime = 5_000;
    const limiter = createInMemoryRateLimiter({
      limit: 1,
      windowMs: 60_000,
      now: () => currentTime,
    });

    expect(limiter.consume("user-1")).toEqual({ allowed: true });
    currentTime = 65_000;

    expect(limiter.consume("user-1")).toEqual({ allowed: true });
  });

  test("keeps allowances isolated by authenticated user", () => {
    const limiter = createInMemoryRateLimiter({
      limit: 1,
      now: () => 0,
    });

    expect(limiter.consume("user-1")).toEqual({ allowed: true });
    expect(limiter.consume("user-2")).toEqual({ allowed: true });
    expect(limiter.consume("user-1")).toMatchObject({ allowed: false });
  });

  test("evicts the least recently touched subject when capacity is full", () => {
    let currentTime = 0;
    const limiter = createInMemoryRateLimiter({
      limit: 1,
      windowMs: 60_000,
      maxSubjects: 2,
      now: () => currentTime,
    });

    expect(limiter.consume("older-user")).toEqual({ allowed: true });
    currentTime = 1;
    expect(limiter.consume("recent-user")).toEqual({ allowed: true });
    currentTime = 2;
    expect(limiter.consume("recent-user")).toMatchObject({ allowed: false });
    currentTime = 3;
    expect(limiter.consume("new-user")).toEqual({ allowed: true });

    expect(limiter.consume("older-user")).toEqual({ allowed: true });
  });
});
