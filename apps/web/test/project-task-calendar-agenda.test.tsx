import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";

import { ProjectTaskCalendarAgenda } from "@/features/projects/project-task-calendar-agenda";
import { layoutProjectTaskCalendar } from "@/features/projects/project-task-calendar-layout";
import type {
  ProjectTaskCalendarContext,
  ProjectTaskCalendarMarker,
} from "@/lib/api/generated/models";

const task: ProjectTaskCalendarContext = {
  id: "task-1",
  title: "Preparar informe",
  status: "blocked",
  plannedStartDate: "2026-08-10",
  internalDueDate: "2026-08-12",
  position: 0,
  project: {
    id: "project-1",
    name: "Informe Rivera",
    startDate: "2026-08-01",
    client: { id: "client-1", name: "Rivera SAC" },
  },
  stage: { id: "stage-1", name: "Investigación", position: 0 },
  responsibles: [
    {
      assignmentId: "a1",
      userId: "u1",
      userName: "Ana Mendoza",
      userEmail: "ana@example.com",
      userAlias: "AM",
      userAvatarColor: "#11182b",
      userPosition: "senior",
      activeStudioMember: true,
      assignedAt: "2026-08-01T00:00:00.000Z",
    },
  ],
};

describe("ProjectTaskCalendarAgenda", () => {
  test("marks weekend agenda dates without disabling their tasks", () => {
    const weekendTask = {
      ...task,
      plannedStartDate: "2026-08-08",
      internalDueDate: "2026-08-10",
    };
    render(
      <MemoryRouter>
        <ProjectTaskCalendarAgenda
          layout={layoutProjectTaskCalendar(
            [weekendTask],
            [],
            "2026-08",
            "2026-08-11",
          )}
          onOpenTask={vi.fn()}
          onOpenProject={vi.fn()}
        />
      </MemoryRouter>,
    );

    const heading = screen.getByRole("heading", {
      name: "sábado, 8 de agosto de 2026",
    });
    expect(heading.closest("section")).toHaveAttribute("data-weekend", "true");
    expect(heading).toHaveClass("bg-muted/60");
    expect(
      screen.getByRole("link", { name: /Preparar informe/i }),
    ).toBeEnabled();
  });

  test("shows a multi-day task once with complete legal-work context", () => {
    const onOpenTask = vi.fn();
    const layout = layoutProjectTaskCalendar(
      [task],
      [],
      "2026-08",
      "2026-08-11",
    );
    render(
      <MemoryRouter>
        <ProjectTaskCalendarAgenda
          layout={layout}
          onOpenTask={onOpenTask}
          onOpenProject={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Preparar informe")).toHaveLength(1);
    expect(screen.getByText(/10 ago 2026 - 12 ago 2026/)).toBeVisible();
    expect(screen.getByText(/Informe Rivera.*Rivera SAC/)).toBeVisible();
    expect(screen.getByText(/Investigación.*AM/)).toBeVisible();
    expect(screen.getByText("Suspendida")).toBeVisible();
    const link = screen.getByRole("link", {
      name: /Preparar informe.*Informe Rivera/i,
    });
    fireEvent.click(link);
    expect(onOpenTask).toHaveBeenCalledWith("project-1", "task-1", link);
  });

  test("shows project period and event entries on their date", () => {
    const markers: ProjectTaskCalendarMarker[] = [
      {
        projectId: "project-1",
        projectName: "Informe Rivera",
        clientName: "Rivera SAC",
        kind: "project_end",
        date: "2026-08-11",
      },
      {
        projectId: "project-1",
        projectName: "Informe Rivera",
        clientName: "Rivera SAC",
        kind: "project_event",
        date: "2026-08-11",
        eventId: "event-1",
        eventTitle: "Audiencia de vista",
        eventType: "legal",
      },
    ];
    render(
      <MemoryRouter>
        <ProjectTaskCalendarAgenda
          layout={layoutProjectTaskCalendar(
            [],
            markers,
            "2026-08",
            "2026-08-11",
          )}
          onOpenTask={vi.fn()}
          onOpenProject={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Fin del proyecto")).toBeVisible();
    expect(screen.getByText("Audiencia de vista")).toBeVisible();
    const event = screen.getByRole("link", {
      name: /Informe Rivera.*Evento legal/i,
    });
    const end = screen.getByRole("link", {
      name: /Informe Rivera.*Fin del proyecto/i,
    });
    expect(end.querySelector("svg")).toHaveClass("text-danger");
    expect(event.querySelector("svg")).toHaveClass("text-primary-strong");
    expect(event.querySelector(".lucide-calendar-days")).toBeInTheDocument();
    expect(event.querySelector(".lucide-scale")).not.toBeInTheDocument();
    expect(end).toHaveAttribute("href", "/projects/project-1");
  });
});
