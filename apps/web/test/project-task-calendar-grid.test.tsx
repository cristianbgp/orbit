import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";

import { ProjectTaskCalendarGrid } from "@/features/projects/project-task-calendar-grid";
import { layoutProjectTaskCalendar } from "@/features/projects/project-task-calendar-layout";
import type {
  ProjectTaskCalendarContext,
  ProjectTaskCalendarMarker,
} from "@/lib/api/generated/models";

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

function task(
  id: string,
  status: ProjectTaskCalendarContext["status"] = "pending",
  position = 0,
): ProjectTaskCalendarContext {
  return {
    id,
    title: id === "task-1" ? "Redactar demanda" : `Tarea ${id}`,
    status,
    plannedStartDate: "2026-08-10",
    internalDueDate: "2026-08-12",
    position,
    project: {
      id: "project-1",
      name: "Apelación Rivera",
      startDate: "2026-08-01",
      client: { id: "client-1", name: "Rivera SAC" },
    },
    stage: { id: "stage-1", name: "Redacción", position: 2 },
    responsibles: [
      {
        assignmentId: "assignment-1",
        userId: "user-1",
        userName: "Cristian Granda",
        userEmail: "cristian@example.com",
        userAlias: "CG",
        userAvatarColor: "#11182b",
        userPosition: "junior",
        activeStudioMember: true,
        assignedAt: "2026-08-01T12:00:00.000Z",
      },
    ],
  };
}

function renderGrid(
  tasks: ProjectTaskCalendarContext[],
  markers: ProjectTaskCalendarMarker[] = [],
  month = "2026-08",
  today = "2026-08-11",
) {
  const onOpenTask = vi.fn();
  const onOpenDay = vi.fn();
  const onOpenProject = vi.fn();
  const layout = layoutProjectTaskCalendar(tasks, markers, month, today);
  render(
    <MemoryRouter>
      <ProjectTaskCalendarGrid
        layout={layout}
        month={month}
        today={today}
        onOpenTask={onOpenTask}
        onOpenDay={onOpenDay}
        onOpenProject={onOpenProject}
      />
    </MemoryRouter>,
  );
  return { layout, onOpenTask, onOpenDay, onOpenProject };
}

describe("ProjectTaskCalendarGrid", () => {
  test("renders the seven-day month grid with full dates and today semantics", () => {
    renderGrid([task("task-1")]);

    expect(
      screen.getByRole("grid", { name: "Calendario mensual de tareas" }),
    ).toBeVisible();

    expect(
      screen.getAllByRole("columnheader").map((cell) => cell.textContent),
    ).toEqual(["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]);
    expect(
      screen.getByLabelText("martes, 11 de agosto de 2026"),
    ).toHaveAttribute("aria-current", "date");
  });

  test("marks weekend headers and cells while keeping today visually dominant", () => {
    renderGrid([], [], "2026-08", "2026-08-09");

    expect(screen.getByRole("columnheader", { name: "Sáb" })).toHaveAttribute(
      "data-weekend",
      "true",
    );
    expect(screen.getByRole("columnheader", { name: "Dom" })).toHaveClass(
      "bg-muted/70",
    );
    expect(
      screen.getByRole("columnheader", { name: "Vie" }),
    ).not.toHaveAttribute("data-weekend");

    const saturday = screen.getByLabelText("sábado, 8 de agosto de 2026");
    expect(saturday).toHaveAttribute("data-weekend", "true");
    expect(saturday).toHaveClass("bg-muted/60");

    const sundayToday = screen.getByLabelText("domingo, 9 de agosto de 2026");
    expect(sundayToday).toHaveAttribute("data-weekend", "true");
    expect(sundayToday).toHaveClass("bg-primary/8");
    expect(sundayToday).not.toHaveClass("bg-muted/60");
  });

  test("marks overdue work even when today is outside the displayed month", () => {
    const overdue = {
      ...task("past", "in_progress"),
      plannedStartDate: "2026-07-10",
      internalDueDate: "2026-07-12",
    };

    renderGrid([overdue], [], "2026-07", "2026-08-11");

    expect(screen.getAllByTestId("task-overdue").length).toBeGreaterThan(0);
  });

  test("opens a task from a semantic link with complete legal-work context", () => {
    const { onOpenTask } = renderGrid([task("task-1")]);
    const link = screen.getByRole("link", {
      name: /Redactar demanda.*Apelación Rivera.*Redacción.*Pendiente.*Encargados: CG/i,
    });

    expect(link).toHaveAttribute("href", "/projects/project-1?task=task-1");
    fireEvent.click(link);
    expect(onOpenTask).toHaveBeenCalledWith("project-1", "task-1", link);
  });

  test("distinguishes suspended, completed, and overdue tasks without color alone", () => {
    renderGrid([
      task("blocked", "blocked", 0),
      task("completed", "completed", 1),
      {
        ...task("overdue", "in_progress", 2),
        internalDueDate: "2026-08-10",
      },
    ]);

    expect(screen.getAllByTestId("task-status-blocked")[0]).toHaveClass(
      "text-danger",
    );
    expect(screen.getAllByTestId("task-status-completed")[0]).toHaveClass(
      "text-success",
    );
    expect(screen.getAllByTestId("task-overdue").length).toBeGreaterThan(0);
  });

  test("shows four lanes and exposes hidden work through each affected day", () => {
    const tasks = Array.from({ length: 7 }, (_, index) =>
      task(`dense-${index}`, "pending", index),
    );
    const { onOpenDay } = renderGrid(tasks);
    const week = screen.getByRole("row", {
      name: /Semana del lunes, 10 de agosto de 2026/i,
    });

    expect(
      new Set(
        within(week)
          .getAllByRole("link")
          .map((link) => link.dataset.lane),
      ),
    ).toEqual(new Set(["0", "1", "2", "3"]));

    const overflow = within(week).getByRole("button", {
      name: /3 tareas adicionales.*martes, 11 de agosto de 2026/i,
    });
    fireEvent.click(overflow);
    expect(onOpenDay).toHaveBeenCalledWith("2026-08-11", overflow);
  });

  test("shows project period and event markers and opens their projects", () => {
    const markers: ProjectTaskCalendarMarker[] = [
      {
        projectId: "project-1",
        projectName: "Apelación Rivera",
        clientName: "Rivera SAC",
        kind: "project_start",
        date: "2026-08-11",
      },
      {
        projectId: "project-1",
        projectName: "Apelación Rivera",
        clientName: "Rivera SAC",
        kind: "project_end",
        date: "2026-08-11",
      },
      {
        projectId: "project-1",
        projectName: "Apelación Rivera",
        clientName: "Rivera SAC",
        kind: "project_event",
        date: "2026-08-11",
        eventId: "event-1",
        eventTitle: "Audiencia de vista",
        eventType: "legal",
      },
    ];
    const { onOpenProject } = renderGrid([], markers);

    const start = screen.getByRole("button", {
      name: /1 inicio de proyecto.*11 de agosto/i,
    });
    const end = screen.getByRole("button", {
      name: /1 fin de proyecto.*11 de agosto/i,
    });
    const event = screen.getByRole("button", {
      name: /1 evento legal.*11 de agosto/i,
    });
    expect(start).toHaveClass("border-amber-500", "text-amber-700");
    expect(end).toHaveClass("border-danger", "text-danger");
    expect(event).toHaveClass("border-primary", "text-primary-strong");
    expect(event.querySelector(".lucide-calendar-days")).toBeInTheDocument();
    expect(event.querySelector(".lucide-scale")).not.toBeInTheDocument();
    fireEvent.click(start);
    fireEvent.click(end);
    fireEvent.click(event);

    expect(onOpenProject).toHaveBeenNthCalledWith(1, "project-1");
    expect(onOpenProject).toHaveBeenNthCalledWith(2, "project-1");
    expect(onOpenProject).toHaveBeenNthCalledWith(3, "project-1");
  });

  test("groups multiple same-day legal events into the complete day view", () => {
    const markers: ProjectTaskCalendarMarker[] = [
      {
        projectId: "project-1",
        projectName: "Apelación Rivera",
        clientName: "Rivera SAC",
        kind: "project_event",
        date: "2026-08-11",
        eventId: "event-1",
        eventTitle: "Audiencia",
        eventType: "legal",
      },
      {
        projectId: "project-1",
        projectName: "Apelación Rivera",
        clientName: "Rivera SAC",
        kind: "project_event",
        date: "2026-08-11",
        eventId: "event-2",
        eventTitle: "Presentación",
        eventType: "legal",
      },
    ];
    const { onOpenDay, onOpenProject } = renderGrid([], markers);
    const trigger = screen.getByRole("button", {
      name: /2 evento legal.*11 de agosto/i,
    });

    fireEvent.click(trigger);

    expect(onOpenDay).toHaveBeenCalledWith("2026-08-11", trigger);
    expect(onOpenProject).not.toHaveBeenCalled();
  });
});
