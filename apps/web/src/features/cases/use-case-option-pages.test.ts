import { describe, expect, test, vi } from "vitest";

import { collectPaginatedItems } from "./use-case-option-pages";

describe("collectPaginatedItems", () => {
  test("loads every result page instead of silently stopping at 100 options", async () => {
    const fetchPage = vi.fn(async (page: number) => ({
      items:
        page === 1
          ? Array.from({ length: 100 }, (_, index) => `item-${index + 1}`)
          : ["item-101"],
      pagination: {
        page,
        pageSize: 100,
        total: 101,
        totalPages: 2,
      },
    }));

    await expect(collectPaginatedItems(fetchPage)).resolves.toHaveLength(101);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 1);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 2);
  });
});
