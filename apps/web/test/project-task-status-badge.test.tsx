import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProjectTaskStatusBadge } from "@/features/projects/project-task-status-badge";

const statusStyles = [
  {
    status: "pending",
    label: "Pendiente",
    classNames: ["bg-muted", "text-task-status-pending"],
    backgroundToken: "--muted",
    foregroundToken: "--task-status-pending",
  },
  {
    status: "in_progress",
    label: "En trabajo",
    classNames: ["bg-info-soft", "text-task-status-in-progress"],
    backgroundToken: "--info-soft",
    foregroundToken: "--task-status-in-progress",
  },
  {
    status: "blocked",
    label: "Suspendida",
    classNames: ["bg-danger-soft", "text-task-status-blocked"],
    backgroundToken: "--danger-soft",
    foregroundToken: "--task-status-blocked",
  },
  {
    status: "completed",
    label: "Completada",
    classNames: ["bg-success-soft", "text-task-status-completed"],
    backgroundToken: "--success-soft",
    foregroundToken: "--task-status-completed",
  },
] as const;

const orbitTheme = readFileSync(
  resolve(process.cwd(), "src/styles/globals.css"),
  "utf8",
);

function cssColor(token: string) {
  const match = orbitTheme.match(
    new RegExp(`${token}:\\s*(#[0-9a-f]{6});`, "i"),
  );
  if (!match) throw new Error(`Expected ${token} to be a six-digit hex color`);
  return match[1];
}

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

describe("ProjectTaskStatusBadge", () => {
  test.each(statusStyles)(
    "renders $status with its semantic status style",
    ({ status, label, classNames }) => {
      render(<ProjectTaskStatusBadge status={status} />);

      expect(screen.getByText(label)).toHaveClass(...classNames);
    },
  );

  test("keeps every status badge text pair at WCAG AA contrast", () => {
    for (const { backgroundToken, foregroundToken } of statusStyles) {
      expect(
        contrastRatio(cssColor(backgroundToken), cssColor(foregroundToken)),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("renders an unknown status with a neutral fallback", () => {
    render(<ProjectTaskStatusBadge status="toString" />);

    expect(screen.getByText("Estado desconocido")).toHaveClass("bg-muted");
  });
});
