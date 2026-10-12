import { describe, expect, test } from "vitest";

import {
  PROJECT_TASK_CALENDAR_TONES,
  projectTaskCalendarTone,
} from "@/features/projects/project-task-calendar-colors";

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/../g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);

  if (!channels || channels.length !== 3) {
    throw new Error(`Expected a six-digit hex color, received ${hex}`);
  }

  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(first: string, second: string) {
  const [lighter, darker] = [
    relativeLuminance(first),
    relativeLuminance(second),
  ].sort((left, right) => right - left);

  return (lighter + 0.05) / (darker + 0.05);
}

describe("projectTaskCalendarTone", () => {
  test("keeps a project tone stable using only its ID", () => {
    const tone = projectTaskCalendarTone("project-1");

    expect(projectTaskCalendarTone("project-1")).toBe(tone);
    expect(projectTaskCalendarTone("project-1", "Renamed project")).toBe(tone);
  });

  test("offers six distinct project identities without danger or milestone tones", () => {
    expect(PROJECT_TASK_CALENDAR_TONES).toHaveLength(6);

    const treatments = PROJECT_TASK_CALENDAR_TONES.map(
      ({ dot, bar, border, text }) => `${dot}|${bar}|${border}|${text}`,
    );
    expect(new Set(treatments)).toHaveLength(6);
    treatments.forEach((treatment) => {
      expect(treatment).not.toMatch(/danger|red|amber|warning/);
    });
  });

  test("meets WCAG AA contrast for every declared text and background pair", () => {
    for (const tone of PROJECT_TASK_CALENDAR_TONES) {
      expect(
        contrastRatio(tone.auditForeground, tone.auditBackground),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("can reach every fixed tone without constructing classes at runtime", () => {
    const seen = new Set(
      Array.from({ length: 200 }, (_, index) =>
        projectTaskCalendarTone(`project-${index}`),
      ),
    );

    expect(seen.size).toBe(6);
  });
});
