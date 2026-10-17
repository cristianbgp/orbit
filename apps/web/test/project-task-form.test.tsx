import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ProjectTaskForm } from "@/features/projects/project-task-form";
import type {
  ProjectAssignment,
  ProjectStage,
  ProjectTask,
} from "@/lib/api/generated/models";

Element.prototype.scrollIntoView = vi.fn();

function chooseOption(label: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(screen.getByRole("option", { name: option }));
}

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
const assignments: ProjectAssignment[] = [
  {
    id: "project-assignment-1",
    userId: "user-2",
    userName: "Luis Ramos",
    userEmail: "luis@orbit.pe",
    userAlias: "LR",
    userAvatarColor: "#11182b",
    activeStudioMember: true,
    responsibility: "member",
    assignedByUserId: "user-1",
    assignedByName: "Ana Torres",
    assignedAt: "2026-08-06T20:00:00.000Z",
    endedAt: null,
    endedByUserId: null,
    endedByName: null,
    endReason: null,
  },
];
const projectStartDate = "2026-08-06";

describe("ProjectTaskForm", () => {
  test("submits the inline task form when Enter is pressed in the title", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectTaskForm
        projectStartDate={projectStartDate}
        stages={stages}
        activeAssignments={assignments}
        submitOnEnter
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    const title = screen.getByLabelText("Título");
    fireEvent.change(title, { target: { value: "Preparar informe" } });
    fireEvent.keyDown(title, { key: "Enter" });

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Preparar informe" }),
      ),
    );
  });

  test("keeps Enter available in the description and treats cancel as a secondary action", () => {
    const onSubmit = vi.fn();
    render(
      <ProjectTaskForm
        projectStartDate={projectStartDate}
        stages={stages}
        activeAssignments={assignments}
        submitOnEnter
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.keyDown(screen.getByLabelText("Descripción"), { key: "Enter" });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveAttribute(
      "type",
      "button",
    );
  });

  test("creates a pending task with optional values and several responsibles", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectTaskForm
        projectStartDate={projectStartDate}
        stages={stages}
        activeAssignments={assignments}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        "Inicio planificado y fecha límite. La fecha límite es opcional.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Revisar antecedentes" },
    });
    chooseOption("Etapa", "Informe");
    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: "  " },
    });
    fireEvent.click(screen.getByLabelText("Fechas planificadas"));
    fireEvent.click(
      screen.getByRole("button", {
        name: /lunes, 10 de agosto de 2026$/i,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /viernes, 14 de agosto de 2026$/i,
      }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /Luis Ramos/ }));
    fireEvent.click(screen.getByRole("button", { name: "Crear tarea" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        title: "Revisar antecedentes",
        stageId: "stage-2",
        description: null,
        status: "pending",
        plannedStartDate: "2026-08-10",
        internalDueDate: "2026-08-14",
        responsibleUserIds: ["user-2"],
      }),
    );
  });

  test("validates the title and preserves values after a failed save", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("failed"));
    render(
      <ProjectTaskForm
        projectStartDate={projectStartDate}
        stages={stages}
        activeAssignments={assignments}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear tarea" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ingresa al menos 2 caracteres",
    );
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Revisar expediente" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear tarea" }));
    expect(
      await screen.findByText(/No pudimos guardar la tarea/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue("Revisar expediente");
  });

  test("edits all fixed statuses and clears optional values", async () => {
    const initialTask: ProjectTask = {
      id: "task-1",
      stage: { id: "stage-1", name: "Investigación", position: 0 },
      title: "Revisar antecedentes",
      description: "Detalle",
      status: "in_progress",
      plannedStartDate: "2026-08-07",
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
          userPosition: "senior",
          activeStudioMember: true,
          assignedAt: "2026-08-06T20:00:00.000Z",
        },
      ],
      createdAt: "2026-08-06T20:00:00.000Z",
      updatedAt: "2026-08-06T20:00:00.000Z",
    };
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectTaskForm
        projectStartDate={projectStartDate}
        stages={stages}
        activeAssignments={assignments}
        initialTask={initialTask}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Estado" }));
    expect(
      screen.getByRole("option", { name: "Pendiente" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "En trabajo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Suspendida" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Completada" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Completada" }));
    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByLabelText("Fechas planificadas"));
    fireEvent.click(screen.getByRole("button", { name: "Limpiar fechas" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          description: null,
          internalDueDate: null,
        }),
      ),
    );
  });

  test("submits a planned start without requiring a deadline", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectTaskForm
        projectStartDate={projectStartDate}
        stages={stages}
        activeAssignments={assignments}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Preparar esquema" },
    });
    fireEvent.click(screen.getByLabelText("Fechas planificadas"));
    fireEvent.click(
      screen.getByRole("button", {
        name: /lunes, 10 de agosto de 2026$/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Crear tarea" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          plannedStartDate: "2026-08-10",
          internalDueDate: null,
        }),
      ),
    );
  });

  test("rejects a legacy deadline that has no planned start", () => {
    const onSubmit = vi.fn();
    render(
      <ProjectTaskForm
        projectStartDate={projectStartDate}
        stages={stages}
        activeAssignments={assignments}
        initialTask={{
          id: "task-invalid",
          stage: { id: "stage-1", name: "Investigación", position: 0 },
          title: "Tarea heredada",
          description: null,
          status: "pending",
          plannedStartDate: null,
          internalDueDate: "2026-08-14",
          position: 0,
          archivedAt: null,
          responsibles: [],
          createdAt: "2026-08-06T20:00:00.000Z",
          updatedAt: "2026-08-06T20:00:00.000Z",
        }}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Selecciona un inicio planificado para usar una fecha límite.",
    );
  });

  test("retains and rejects a planned start before the project start", () => {
    const onSubmit = vi.fn();
    render(
      <ProjectTaskForm
        projectStartDate="2026-08-10"
        stages={stages}
        activeAssignments={assignments}
        initialTask={{
          id: "task-before-project",
          stage: { id: "stage-1", name: "Investigación", position: 0 },
          title: "Tarea heredada",
          description: null,
          status: "pending",
          plannedStartDate: "2026-08-07",
          internalDueDate: "2026-08-14",
          position: 0,
          archivedAt: null,
          responsibles: [],
          createdAt: "2026-08-06T20:00:00.000Z",
          updatedAt: "2026-08-06T20:00:00.000Z",
        }}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Fechas planificadas")).toHaveTextContent(
      /7 ago.*2026/,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "El inicio planificado no puede ser anterior a la fecha de inicio del proyecto.",
    );

    fireEvent.click(screen.getByLabelText("Fechas planificadas"));
    expect(
      screen.getByRole("gridcell", { name: "9" }).querySelector("button"),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
