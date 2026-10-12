import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ProjectTaskList } from "@/features/projects/project-task-list";
import type { ProjectTask } from "@/lib/api/generated/models";

const tasks: ProjectTask[] = [
  {
    id: "task-1",
    stage: { id: "stage-1", name: "Investigación", position: 0 },
    title: "Revisar antecedentes",
    description: null,
    status: "in_progress",
    plannedStartDate: null,
    internalDueDate: "2026-08-14",
    position: 0,
    archivedAt: null,
    responsibles: [
      {
        assignmentId: "task-assignment-1",
        userId: "user-2",
        userName: "Luis Ramos",
        userEmail: "luis@orbit.pe",
        userAlias: "LR",
        userAvatarColor: "#11182b",
        userPosition: "partner",
        activeStudioMember: true,
        assignedAt: "2026-08-06T20:00:00.000Z",
      },
      {
        assignmentId: "task-assignment-2",
        userId: null,
        userName: "Elena Prado",
        userEmail: "elena@orbit.pe",
        userAlias: "EP",
        userAvatarColor: null,
        userPosition: null,
        activeStudioMember: false,
        assignedAt: "2026-08-06T20:00:00.000Z",
      },
    ],
    createdAt: "2026-08-06T20:00:00.000Z",
    updatedAt: "2026-08-06T20:00:00.000Z",
  },
  {
    id: "task-2",
    stage: { id: "stage-2", name: "Informe", position: 1 },
    title: "Preparar informe",
    description: null,
    status: "pending",
    plannedStartDate: null,
    internalDueDate: null,
    position: 0,
    archivedAt: null,
    responsibles: [],
    createdAt: "2026-08-06T20:00:00.000Z",
    updatedAt: "2026-08-06T20:00:00.000Z",
  },
];

describe("ProjectTaskList", () => {
  test("preserves server stage order and shows quiet task metadata", () => {
    render(
      <MemoryRouter>
        <ProjectTaskList
          tasks={tasks}
          view="active"
          onEdit={vi.fn()}
          onArchive={vi.fn()}
          onStatusChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    const investigation = screen.getByRole("heading", {
      name: "Investigación",
    });
    const report = screen.getByRole("heading", { name: "Informe" });
    expect(
      investigation.compareDocumentPosition(report) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByRole("combobox", {
        name: /Cambiar estado de Revisar antecedentes/,
      }),
    ).toHaveClass("bg-info-soft");
    expect(screen.getByText("Fecha límite: 14 ago 2026")).toBeInTheDocument();
    expect(screen.queryByText(/Fecha límite interna/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("LR").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Luis Ramos/ })).toHaveAttribute(
      "href",
      "/team/user-2",
    );
    expect(screen.getAllByText("EP").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("link", { name: /Elena Prado/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Sin fecha")).not.toBeInTheDocument();
    expect(screen.queryByText("Sin encargado")).not.toBeInTheDocument();
  });

  test("uses edit/archive actions for active tasks and sheet details for archived", () => {
    const onEdit = vi.fn();
    const onArchive = vi.fn();
    const openerRef = createRef<HTMLElement>();
    const { rerender } = render(
      <MemoryRouter>
        <ProjectTaskList
          tasks={[tasks[0]]}
          view="active"
          taskOpenerRef={openerRef}
          onEdit={onEdit}
          onArchive={onArchive}
          onStatusChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Editar Revisar antecedentes" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Archivar Revisar antecedentes" }),
    );
    expect(onEdit).toHaveBeenCalledWith(tasks[0]);
    expect(onArchive).toHaveBeenCalledWith(tasks[0]);
    expect(openerRef.current).toBe(
      screen.getByRole("button", { name: "Editar Revisar antecedentes" }),
    );

    rerender(
      <MemoryRouter>
        <ProjectTaskList
          tasks={[{ ...tasks[0], archivedAt: "2026-08-07T10:00:00.000Z" }]}
          view="archived"
          taskOpenerRef={openerRef}
          onEdit={onEdit}
          onArchive={onArchive}
          onStatusChange={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole("button", { name: /Editar/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Archivar/ }),
    ).not.toBeInTheDocument();
    const details = screen.getByRole("button", {
      name: "Ver detalles de Revisar antecedentes",
    });
    fireEvent.click(details);
    expect(onEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "task-1" }),
    );
    expect(openerRef.current).toBe(details);
    expect(
      screen.queryByRole("button", { name: /Eliminar/ }),
    ).not.toBeInTheDocument();
  });

  test("changes status from an active row and keeps archived rows read-only", () => {
    const onStatusChange = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <ProjectTaskList
          tasks={[tasks[0]]}
          view="active"
          updatingTaskIds={new Set(["task-1"])}
          onEdit={vi.fn()}
          onArchive={vi.fn()}
          onStatusChange={onStatusChange}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("combobox", {
        name: /Cambiar estado de Revisar antecedentes/,
      }),
    ).toBeDisabled();

    rerender(
      <MemoryRouter>
        <ProjectTaskList
          tasks={[{ ...tasks[0], archivedAt: "2026-08-07T10:00:00.000Z" }]}
          view="archived"
          onEdit={vi.fn()}
          onArchive={vi.fn()}
          onStatusChange={onStatusChange}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("En trabajo")).toBeVisible();
  });
});
