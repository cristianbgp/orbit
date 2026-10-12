import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

describe("ProjectTaskStatusSelect", () => {
  test("offers the four Orbit statuses and reports a changed value", async () => {
    const module =
      await import("@/features/projects/project-task-status-select").catch(
        () => null,
      );
    expect(module).not.toBeNull();

    const onValueChange = vi.fn();
    const ProjectTaskStatusSelect = module!.ProjectTaskStatusSelect;
    render(
      <ProjectTaskStatusSelect
        taskTitle="Revisar antecedentes"
        value="pending"
        onValueChange={onValueChange}
      />,
    );

    const trigger = screen.getByRole("combobox", {
      name: "Cambiar estado de Revisar antecedentes. Estado actual: Pendiente",
    });
    expect(trigger).toHaveTextContent("Pendiente");
    expect(trigger.querySelector(".lucide-chevron-down")).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(screen.getByRole("option", { name: "Pendiente" })).toBeVisible();
    expect(screen.getByRole("option", { name: "En trabajo" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Suspendida" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Completada" })).toBeVisible();

    fireEvent.click(screen.getByRole("option", { name: "Pendiente" }));
    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "En trabajo" }));
    expect(onValueChange).toHaveBeenCalledWith("in_progress");
  });

  test.each([
    ["pending", "Pendiente", "lucide-clock-3"],
    ["in_progress", "En trabajo", "lucide-circle-dot-dashed"],
    ["blocked", "Suspendida", "lucide-circle-pause"],
    ["completed", "Completada", "lucide-circle-check-big"],
  ] as const)(
    "renders %s as an accessible icon-only trigger",
    async (status, label, iconClass) => {
      const { ProjectTaskStatusSelect } =
        await import("@/features/projects/project-task-status-select");

      render(
        <ProjectTaskStatusSelect
          taskTitle="Revisar antecedentes"
          value={status}
          display="icon"
          onValueChange={vi.fn()}
        />,
      );

      const trigger = screen.getByRole("combobox", {
        name: `Cambiar estado de Revisar antecedentes. Estado actual: ${label}`,
      });
      expect(trigger).not.toHaveTextContent(label);
      expect(trigger).toHaveClass("!size-11", "justify-center", "lg:!size-8");
      expect(trigger.querySelector(`.${iconClass}`)).toHaveAttribute(
        "aria-hidden",
        "true",
      );
      expect(
        trigger.querySelector(".lucide-chevron-down"),
      ).not.toBeInTheDocument();
    },
  );

  test("keeps full menu labels and status changes in icon mode", async () => {
    const { ProjectTaskStatusSelect } =
      await import("@/features/projects/project-task-status-select");
    const onValueChange = vi.fn();

    render(
      <ProjectTaskStatusSelect
        taskTitle="Revisar antecedentes"
        value="pending"
        display="icon"
        onValueChange={onValueChange}
      />,
    );

    fireEvent.keyDown(
      screen.getByRole("combobox", {
        name: "Cambiar estado de Revisar antecedentes. Estado actual: Pendiente",
      }),
      { key: "ArrowDown" },
    );
    fireEvent.click(screen.getByRole("option", { name: "En trabajo" }));

    expect(onValueChange).toHaveBeenCalledWith("in_progress");
  });
});
