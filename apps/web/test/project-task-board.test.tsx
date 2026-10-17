import { createRef } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ProjectTaskBoard } from "@/features/projects/project-task-board";
import type { ProjectStage, ProjectTask } from "@/lib/api/generated/models";

const stages: ProjectStage[] = [
  {
    id: "stage-1",
    name: "Investigación",
    description: null,
    position: 0,
    createdAt: "2026-08-06T10:00:00.000Z",
    updatedAt: "2026-08-06T10:00:00.000Z",
  },
  {
    id: "stage-2",
    name: "Informe",
    description: null,
    position: 1,
    createdAt: "2026-08-06T10:00:00.000Z",
    updatedAt: "2026-08-06T10:00:00.000Z",
  },
];

function task(
  id: string,
  stage: ProjectTask["stage"],
  title: string,
): ProjectTask {
  return {
    id,
    stage,
    title,
    description: null,
    status: "pending",
    plannedStartDate: null,
    internalDueDate: null,
    position: 0,
    archivedAt: null,
    responsibles: [],
    createdAt: "2026-08-06T20:00:00.000Z",
    updatedAt: "2026-08-06T20:00:00.000Z",
  };
}

const tasks = [
  {
    ...task(
      "task-1",
      { id: "stage-1", name: "Investigación", position: 0 },
      "Revisar antecedentes",
    ),
    internalDueDate: "2026-08-14",
  },
  task(
    "task-2",
    { id: "stage-2", name: "Informe", position: 1 },
    "Preparar informe",
  ),
];

const stageTaskStatusCounts = {
  "stage-1": { pending: 1, inProgress: 1, blocked: 0, completed: 0 },
  "stage-2": { pending: 0, inProgress: 0, blocked: 0, completed: 1 },
};

describe("ProjectTaskBoard", () => {
  test("switches the mobile stage panel and creates in the selected stage", () => {
    const onCreate = vi.fn();
    render(
      <ProjectTaskBoard
        stages={stages}
        tasks={tasks}
        stageTaskStatusCounts={stageTaskStatusCounts}
        onCreate={onCreate}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );

    const researchTab = screen.getByRole("tab", {
      name: /Investigación.*1 tarea.*En curso/,
    });
    const reportTab = screen.getByRole("tab", {
      name: /Informe.*1 tarea.*Completada/,
    });
    expect(researchTab).toHaveAttribute("aria-selected", "true");
    expect(reportTab).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      "Revisar antecedentes",
    );

    fireEvent.click(reportTab);

    expect(reportTab).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent("Preparar informe");
    expect(panel).not.toHaveTextContent("Revisar antecedentes");
    fireEvent.click(
      within(panel).getByRole("button", { name: "Nueva tarea en Informe" }),
    );
    expect(onCreate).toHaveBeenCalledWith("stage-2");
  });

  test("keeps every stage in the desktop board presentation", () => {
    render(
      <ProjectTaskBoard
        stages={stages}
        tasks={tasks}
        stageTaskStatusCounts={stageTaskStatusCounts}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );

    const board = screen.getByTestId("project-task-board-columns");
    expect(board).toHaveClass("md:flex");
    expect(
      within(board).getByRole("heading", { name: "Investigación" }),
    ).toBeInTheDocument();
    expect(
      within(board).getByRole("heading", { name: "Informe" }),
    ).toBeInTheDocument();
    expect(within(board).getAllByText("Pendiente")).toHaveLength(2);
    expect(within(board).getByText("Fecha límite · 14 ago 2026")).toBeVisible();
    expect(
      within(board).queryByText(/Límite interno/i),
    ).not.toBeInTheDocument();
    expect(
      within(board).getByLabelText("Estado de etapa: En curso"),
    ).toBeVisible();
    expect(
      within(
        within(board).getByLabelText("Estado de etapa: En curso"),
      ).getByText("En curso"),
    ).toHaveClass("sr-only");
    expect(
      within(board).getByLabelText("Estado de etapa: Completada"),
    ).toBeVisible();
  });

  test("contains the wide desktop board inside its own horizontal scroller", () => {
    render(
      <ProjectTaskBoard
        stages={stages}
        tasks={tasks}
        stageTaskStatusCounts={stageTaskStatusCounts}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );

    const board = screen.getByTestId("project-task-board-columns");
    const scrollRegion = screen.getByRole("region", {
      name: "Tablero de tareas desplazable",
    });

    expect(scrollRegion).toContainElement(board);
    expect(scrollRegion).toHaveClass(
      "w-full",
      "min-w-0",
      "max-w-full",
      "overflow-x-auto",
    );
    expect(scrollRegion.parentElement).toHaveClass(
      "w-full",
      "min-w-0",
      "max-w-full",
      "overflow-hidden",
    );
    expect(scrollRegion.parentElement).toHaveStyle({
      contain: "inline-size layout paint",
    });
  });

  test("records the edit control as the task-sheet opener", () => {
    const openerRef = createRef<HTMLElement>();
    const onEdit = vi.fn();
    render(
      <ProjectTaskBoard
        stages={stages}
        tasks={tasks}
        taskOpenerRef={openerRef}
        onCreate={vi.fn()}
        onEdit={onEdit}
        onArchive={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );

    const edit = screen.getAllByRole("button", { name: "Editar" })[0];
    fireEvent.click(edit);

    expect(onEdit).toHaveBeenCalledWith(tasks[0]);
    expect(openerRef.current).toBe(edit);
  });

  test("shows alias-first responsible identities linked only for active members", () => {
    const assigned = task(
      "task-3",
      { id: "stage-1", name: "Investigación", position: 0 },
      "Entrevistar al cliente",
    );
    assigned.responsibles = [
      {
        assignmentId: "assignment-1",
        userId: "user-2",
        userName: "Luis Ramos",
        userEmail: "luis@orbit.pe",
        userAlias: "Lucho",
        userAvatarColor: "#11182b",
        userPosition: "partner",
        activeStudioMember: true,
        assignedAt: "2026-08-06T20:00:00.000Z",
      },
      {
        assignmentId: "assignment-2",
        userId: null,
        userName: "Elena Prado",
        userEmail: "elena@orbit.pe",
        userAlias: "EP",
        userAvatarColor: null,
        userPosition: null,
        activeStudioMember: false,
        assignedAt: "2026-08-06T20:00:00.000Z",
      },
    ];

    render(
      <MemoryRouter>
        <ProjectTaskBoard
          stages={stages}
          tasks={[assigned]}
          onCreate={vi.fn()}
          onEdit={vi.fn()}
          onArchive={vi.fn()}
          onStatusChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getAllByRole("link", {
        name: /Lucho, Luis Ramos, Socio, Encargado/,
      })[0],
    ).toHaveAttribute("href", "/team/user-2");
    expect(
      screen.getAllByRole("img", { name: "Elena Prado" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("link", { name: /Elena Prado/ }),
    ).not.toBeInTheDocument();
  });

  test("changes status from a writable task card and disables only that task", () => {
    const onStatusChange = vi.fn();
    render(
      <ProjectTaskBoard
        stages={stages}
        tasks={tasks}
        updatingTaskIds={new Set(["task-1"])}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onStatusChange={onStatusChange}
      />,
    );

    const first = screen.getByRole("combobox", {
      name: /Cambiar estado de Revisar antecedentes/,
    });
    const second = screen.getByRole("combobox", {
      name: /Cambiar estado de Preparar informe/,
    });
    expect(first).toBeDisabled();
    expect(second).toBeEnabled();

    fireEvent.keyDown(second, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "En trabajo" }));
    expect(onStatusChange).toHaveBeenCalledWith(tasks[1], "in_progress");
  });

  test("keeps status read-only in an archived project", () => {
    render(
      <ProjectTaskBoard
        stages={stages}
        tasks={[tasks[0]]}
        readOnly
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeVisible();
  });
});
