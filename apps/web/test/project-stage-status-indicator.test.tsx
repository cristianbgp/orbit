import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProjectStageStatusIndicator } from "@/features/projects/project-stage-status-indicator";

describe("ProjectStageStatusIndicator", () => {
  test.each([
    ["empty", "Sin tareas"],
    ["pending", "Pendiente"],
    ["in_progress", "En curso"],
    ["blocked", "Suspendida"],
    ["completed", "Completada"],
  ] as const)("labels %s as %s", (status, label) => {
    render(<ProjectStageStatusIndicator status={status} />);

    expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByLabelText(`Estado de etapa: ${label}`)).toBeVisible();
  });

  test("keeps an icon display accessible without repeating visible text", () => {
    render(<ProjectStageStatusIndicator status="completed" display="icon" />);

    expect(screen.getByLabelText("Estado de etapa: Completada")).toBeVisible();
    expect(screen.getByText("Completada")).toHaveClass("sr-only");
  });

  test("shows the label when badge display is explicit", () => {
    render(<ProjectStageStatusIndicator status="completed" display="badge" />);

    expect(screen.getByText("Completada")).toBeVisible();
    expect(screen.getByText("Completada")).not.toHaveClass("sr-only");
  });
});
