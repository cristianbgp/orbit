import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import {
  deriveProjectDeadlineState,
  ProjectDeadlineStatus,
} from "@/features/projects/project-deadline-status";

describe("deriveProjectDeadlineState", () => {
  test.each([
    ["draft", "2026-08-01", "planned"],
    ["completed", "2026-08-01", "completed"],
    ["active", "2026-08-11", "overdue"],
    ["active", "2026-08-12", "due_today"],
    ["active", "2026-08-13", "upcoming"],
    ["active", "2026-08-19", "upcoming"],
    ["active", "2026-08-20", "scheduled"],
  ] as const)(
    "derives %s with deadline %s as %s",
    (projectStatus, deadline, expected) => {
      expect(
        deriveProjectDeadlineState({
          projectStatus,
          deadline,
          today: "2026-08-12",
        }),
      ).toBe(expected);
    },
  );
});

describe("ProjectDeadlineStatus", () => {
  test("shows project end date and active state without color-only meaning", () => {
    render(
      <ProjectDeadlineStatus
        date="2026-08-12"
        projectStatus="active"
        today="2026-08-12"
      />,
    );

    const deadline = screen.getByRole("group", {
      name: "Fecha final: 12 ago 2026, Finaliza hoy",
    });
    expect(within(deadline).getByText("Fecha final")).toBeVisible();
    expect(within(deadline).getByText("12 ago 2026")).toBeVisible();
    expect(within(deadline).getByText("Finaliza hoy")).toBeVisible();
    expect(deadline).toHaveAttribute("data-deadline-state", "due_today");
    expect(deadline.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  test("keeps the final-date lifecycle state in inline presentation", () => {
    render(
      <ProjectDeadlineStatus
        date="2026-08-17"
        projectStatus="completed"
        today="2026-08-12"
        variant="inline"
      />,
    );

    const deadline = screen.getByRole("group", {
      name: "Fecha final: 17 ago 2026, Proyecto completado",
    });
    expect(within(deadline).getByText("Fecha final")).toBeVisible();
    expect(within(deadline).getByText("Proyecto completado")).toBeVisible();
    expect(deadline).toHaveAttribute("data-deadline-variant", "inline");
  });
});
