import { createRef, useRef, useState } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";

import { ProjectTaskCalendarDaySheet } from "@/features/projects/project-task-calendar-day-sheet";
import type {
  ProjectTaskCalendarContext,
  ProjectTaskCalendarResponse,
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
  status: ProjectTaskCalendarContext["status"],
  start: string,
  end: string | null,
): ProjectTaskCalendarContext {
  return {
    id,
    title: `Tarea ${id}`,
    status,
    plannedStartDate: start,
    internalDueDate: end,
    position: 0,
    project: {
      id: `project-${id}`,
      name: `Proyecto ${id}`,
      startDate: "2026-08-01",
      client: { id: `client-${id}`, name: `Cliente ${id}` },
    },
    stage: { id: `stage-${id}`, name: "Estrategia", position: 1 },
    responsibles: [],
  };
}

const response: ProjectTaskCalendarResponse = {
  tasks: [
    task("completed", "completed", "2026-08-10", "2026-08-12"),
    task("active", "in_progress", "2026-08-11", null),
    task("outside", "pending", "2026-08-12", null),
  ],
  markers: [
    {
      projectId: "project-active",
      projectName: "Proyecto active",
      clientName: "Cliente active",
      kind: "project_start",
      date: "2026-08-11",
    },
    {
      projectId: "project-completed",
      projectName: "Proyecto completed",
      clientName: "Cliente completed",
      kind: "project_end",
      date: "2026-08-11",
    },
    {
      projectId: "project-active",
      projectName: "Proyecto active",
      clientName: "Cliente active",
      kind: "project_event",
      date: "2026-08-11",
      eventId: "event-1",
      eventTitle: "Audiencia de vista",
      eventType: "legal",
    },
  ],
  undatedTaskCount: 0,
  truncated: false,
};

function renderSheet(data = response) {
  const openerRef = createRef<HTMLButtonElement>();
  const onOpenChange = vi.fn();
  const onOpenTask = vi.fn();
  const onOpenProject = vi.fn();

  render(
    <MemoryRouter>
      <button ref={openerRef}>Abrir día</button>
      <ProjectTaskCalendarDaySheet
        date="2026-08-11"
        data={data}
        open
        openerRef={openerRef}
        onOpenChange={onOpenChange}
        onOpenTask={onOpenTask}
        onOpenProject={onOpenProject}
      />
    </MemoryRouter>,
  );

  return { openerRef, onOpenChange, onOpenTask, onOpenProject };
}

describe("ProjectTaskCalendarDaySheet", () => {
  test("lists every task active on the date before completed work", () => {
    renderSheet();
    const dialog = screen.getByRole("dialog");

    expect(
      within(dialog).getByText("martes, 11 de agosto de 2026"),
    ).toBeVisible();
    expect(within(dialog).queryByText("Tarea outside")).not.toBeInTheDocument();
    const tasks = within(dialog).getAllByRole("link", { name: /Tarea / });
    expect(tasks.map((item) => item.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Tarea active"),
        expect.stringContaining("Tarea completed"),
      ]),
    );
    expect(tasks[0]).toHaveTextContent("Tarea active");
  });

  test("shows project period and event markers and opens project context", () => {
    const { onOpenProject } = renderSheet();
    const start = screen.getByRole("link", {
      name: /Inicio del proyecto.*Proyecto active/i,
    });
    const end = screen.getByRole("link", {
      name: /Fin del proyecto.*Proyecto completed/i,
    });
    const event = screen.getByRole("link", {
      name: /Audiencia de vista.*Proyecto active/i,
    });
    expect(event.querySelector(".lucide-calendar-days")).toBeInTheDocument();
    expect(event.querySelector(".lucide-scale")).not.toBeInTheDocument();

    fireEvent.click(start);
    fireEvent.click(end);
    fireEvent.click(event);
    expect(onOpenProject).toHaveBeenCalledWith("project-active");
    expect(onOpenProject).toHaveBeenCalledWith("project-completed");
  });

  test("closes the daily Sheet before opening a task", () => {
    const { onOpenChange, onOpenTask } = renderSheet();
    const taskLink = screen.getByRole("link", { name: /Tarea active/i });

    fireEvent.click(taskLink);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onOpenTask).toHaveBeenCalledWith(
      "project-active",
      "active",
      taskLink,
    );
  });

  test("renders empty day context and keeps mobile scrolling contained", () => {
    const empty: ProjectTaskCalendarResponse = {
      tasks: [],
      markers: [],
      undatedTaskCount: 0,
      truncated: false,
    };
    renderSheet(empty);

    expect(
      screen.getByText("No hay tareas ni fechas del proyecto este día."),
    ).toBeVisible();
    expect(screen.getByRole("dialog")).toHaveClass("overscroll-contain");
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveClass(
      "min-h-11",
    );
  });

  test("restores focus to the day opener when the Sheet closes", async () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      const openerRef = useRef<HTMLButtonElement>(null);

      return (
        <MemoryRouter>
          <button ref={openerRef}>Abrir día controlado</button>
          <ProjectTaskCalendarDaySheet
            date="2026-08-11"
            data={response}
            open={open}
            openerRef={openerRef}
            onOpenChange={setOpen}
            onOpenTask={vi.fn()}
            onOpenProject={vi.fn()}
          />
        </MemoryRouter>
      );
    }

    render(<Harness />);
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Abrir día controlado" }),
      ).toHaveFocus();
    });
  });
});
