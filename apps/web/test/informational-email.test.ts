import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const webEntry = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
const globalStyles = readFileSync(
  resolve(process.cwd(), "src/styles/globals.css"),
  "utf8",
);

describe("informational email contract", () => {
  test("disables automatic browser email actions", () => {
    expect(webEntry).toMatch(
      /<meta\s+name="format-detection"\s+content="email=no"\s*\/?>/,
    );
  });

  test("neutralizes explicit and Apple-generated mail links globally", () => {
    expect(globalStyles).toContain('a[href^="mailto:"]');
    expect(globalStyles).toContain("a[x-apple-data-detectors]");
    expect(globalStyles).toMatch(/pointer-events:\s*none\s*!important/);
    expect(globalStyles).toMatch(/user-select:\s*text\s*!important/);
  });
});
