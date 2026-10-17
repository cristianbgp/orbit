import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";

import { ProjectActivityMessage } from "@/features/projects/project-activity-message";
import type {
  ProjectActivity,
  ProjectActivityIdentity,
} from "@/lib/api/generated/models";

const actor: ProjectActivityIdentity = {
  userId: "actor-1",
  alias: "AT",
  avatarColor: "#11182b",
  nameSnapshot: "Ana Torres",
  activeStudioMember: true,
  linkable: true,
};

const subject: ProjectActivityIdentity = {
  userId: "subject-1",
  alias: "LR",
  avatarColor: "#4657d9",
  nameSnapshot: "Luis Ramos",
  activeStudioMember: true,
  linkable: true,
};

function activity(
  type: string,
  details: Record<string, string | null>,
  overrides: Partial<ProjectActivity> = {},
): ProjectActivity {
  return {
    id: "activity-1",
    type,
    actor,
    subject,
    details,
    createdAt: "2026-08-06T20:00:00.000Z",
    ...overrides,
  };
}

function renderMessage(record: ProjectActivity) {
  return render(
    <MemoryRouter>
      <p>
        <ProjectActivityMessage activity={record} projectId="project-1" />
      </p>
    </MemoryRouter>,
  );
}

describe("ProjectActivityMessage", () => {
  test.each([
    [
      "project.created",
      { projectName: "Apelación" },
      /creó el proyecto Apelación\./,
    ],
    [
      "project.details_changed",
      { previousName: "Apelación", newName: "Recurso" },
      /cambió el nombre del proyecto de Apelación a Recurso\./,
    ],
    [
      "project.dates_changed",
      { previousEndDate: "2026-08-17", newEndDate: "2026-08-20" },
      /cambió la fecha final de 17 ago 2026 a 20 ago 2026\./,
    ],
    ["project.archived", {}, /archivó el proyecto\./],
    ["project.restored", {}, /restauró el proyecto\./],
  ])("renders lifecycle activity %s", (type, details, expected) => {
    const { container } = renderMessage(
      activity(type, details, { subject: null }),
    );
    expect(container).toHaveTextContent(expected);
  });

  test("renders project status transitions as semantic badges", () => {
    const { container } = renderMessage(
      activity(
        "project.status_changed",
        { previousStatus: "draft", newStatus: "completed" },
        { subject: null },
      ),
    );

    expect(screen.getByText("Borrador")).toHaveClass("bg-muted");
    expect(screen.getByText("Completado")).toHaveClass("bg-info-soft");
    expect(container).toHaveTextContent(
      /cambió el estado del proyecto de Borrador a Completado\./,
    );
  });

  test("keeps legacy project-date activity understandable after the migration", () => {
    const { container } = renderMessage(
      activity(
        "project.dates_changed",
        {
          previousLegalDeadline: "2026-08-17",
          newLegalDeadline: "2026-08-20",
        },
        { subject: null },
      ),
    );

    expect(container).toHaveTextContent(
      /cambió la fecha legal del modelo anterior de 17 ago 2026 a 20 ago 2026/,
    );
  });

  test.each([
    [
      "project.event_created",
      { title: "Audiencia de vista", date: "2026-08-18" },
      /creó el evento legal Audiencia de vista para el 18 ago 2026\./,
    ],
    [
      "project.event_updated",
      {
        title: "Audiencia de vista",
        date: "2026-08-18",
        newTitle: "Audiencia final",
        newDate: "2026-08-20",
      },
      /actualizó el evento legal Audiencia de vista: nombre, Audiencia de vista → Audiencia final; fecha, 18 ago 2026 → 20 ago 2026\./,
    ],
    [
      "project.event_deleted",
      { title: "Audiencia de vista", date: "2026-08-18" },
      /eliminó el evento legal Audiencia de vista del 18 ago 2026\./,
    ],
  ])("renders legal-event activity %s", (type, details, expected) => {
    const { container } = renderMessage(
      activity(type, details, { subject: null }),
    );
    expect(container).toHaveTextContent(expected);
  });

  test("renders every changed pair and translates project types", () => {
    const { container } = renderMessage(
      activity(
        "project.details_changed",
        {
          previousName: "Consulta inicial",
          newName: "Consulta tributaria",
          previousType: "consultation",
          newType: "written_submission",
        },
        { subject: null },
      ),
    );

    expect(container).toHaveTextContent(
      /nombre, Consulta inicial → Consulta tributaria; tipo, Consulta \(Correo\/Informe\) → Escrito \(Demanda\/Recurso\/Escrito\)/,
    );
    expect(container).not.toHaveTextContent(/written_submission|consultation/);
  });

  test("renders a status change with member and task links plus the shared badge", () => {
    renderMessage(
      activity(
        "task.status_changed",
        {
          taskId: "task-1",
          taskTitle: "Preparar recurso",
          previousStatus: "pending",
          newStatus: "in_progress",
        },
        { subject: null },
      ),
    );

    expect(screen.getByRole("link", { name: /Ana Torres/ })).toHaveAttribute(
      "href",
      "/team/actor-1",
    );
    expect(
      screen.getByRole("link", { name: "Preparar recurso" }),
    ).toHaveAttribute("href", "/projects/project-1?task=task-1");
    expect(screen.getByRole("link", { name: "Preparar recurso" })).toHaveClass(
      "text-primary-strong",
      "underline",
      "hover:decoration-primary",
      "focus-visible:ring-2",
    );
    expect(screen.getByText("Pendiente")).toHaveClass("bg-muted");
    expect(screen.getByText("En trabajo")).toHaveClass("bg-info-soft");
    expect(screen.getByText("En trabajo").parentElement).toHaveTextContent(
      /cambió el estado de Preparar recurso de Pendiente a En trabajo\./,
    );
  });

  test("keeps a colored destination badge for legacy status activity", () => {
    const { container } = renderMessage(
      activity(
        "project.status_changed",
        { newStatus: "completed" },
        { subject: null },
      ),
    );

    expect(screen.getByText("Completado")).toHaveClass("bg-info-soft");
    expect(container).toHaveTextContent(
      /cambió el estado del proyecto a Completado\./,
    );
  });

  test.each([
    [
      "task.details_changed",
      {
        taskId: "task-1",
        taskTitle: "Preparar demanda",
        previousTitle: "Preparar escrito",
        newTitle: "Preparar demanda",
        previousDescription: null,
        newDescription: "Incorporar jurisprudencia",
      },
      /actualizó los detalles de Preparar demanda: título, Preparar escrito → Preparar demanda; descripción, sin descripción → Incorporar jurisprudencia\./,
    ],
    [
      "task.dates_changed",
      {
        taskId: "task-1",
        taskTitle: "Preparar demanda",
        previousPlannedStartDate: "2026-08-12",
        newPlannedStartDate: "2026-08-13",
        previousInternalDueDate: null,
        newInternalDueDate: "2026-08-20",
      },
      /cambió las fechas de Preparar demanda: inicio, 12 ago 2026 → 13 ago 2026; fecha límite, sin fecha → 20 ago 2026\./,
    ],
  ])("renders %s with nullable before-after values", (type, details, text) => {
    const { container } = renderMessage(
      activity(type, details, { subject: null }),
    );

    expect(container).toHaveTextContent(text);
    expect(
      screen.getByRole("link", { name: "Preparar demanda" }),
    ).toHaveAttribute("href", "/projects/project-1?task=task-1");
  });

  test.each([
    [
      "project.stage_created",
      { stageId: "stage-1", stageName: "Investigación" },
      /creó la etapa Investigación\./,
    ],
    [
      "project.stage_details_changed",
      {
        stageId: "stage-1",
        stageName: "Análisis",
        previousName: "Investigación",
        newName: "Análisis",
        previousDescription: null,
        newDescription: "Revisar antecedentes",
      },
      /actualizó la etapa Análisis: nombre, Investigación → Análisis; descripción, sin descripción → Revisar antecedentes\./,
    ],
    [
      "project.stage_deleted",
      { stageId: "stage-1", stageName: "Investigación" },
      /eliminó la etapa Investigación\./,
    ],
    [
      "project.stages_reordered",
      {
        previousOrder: '[{"id":"stage-1","name":"Investigación"}]',
        newOrder: '[{"id":"stage-2","name":"Redacción"}]',
      },
      /reordenó las etapas del proyecto\./,
    ],
  ])("renders stage activity %s", (type, details, text) => {
    const { container } = renderMessage(
      activity(type, details, { subject: null }),
    );
    expect(container).toHaveTextContent(text);
    expect(container).not.toHaveTextContent(/stage-1|stage-2|previousOrder/);
  });

  test.each([
    [
      "task.created",
      { taskId: "task/one", taskTitle: "Revisar antecedentes" },
      /creó la tarea Revisar antecedentes\./,
      "/projects/project-1?task=task%2Fone",
    ],
    [
      "task.stage_changed",
      {
        taskId: "task-1",
        taskTitle: "Revisar antecedentes",
        previousStageName: "Investigación",
        newStageName: "Informe",
      },
      /movió Revisar antecedentes de Investigación a Informe\./,
      "/projects/project-1?task=task-1",
    ],
    [
      "task_assignment.added",
      { taskId: "task-1", taskTitle: "Revisar antecedentes" },
      /asignó a .* como encargado de Revisar antecedentes\./,
      "/projects/project-1?task=task-1",
    ],
    [
      "task_assignment.removed",
      {
        taskId: "task-1",
        taskTitle: "Revisar antecedentes",
        endReason: "task_unassigned",
      },
      /retiró a .* de Revisar antecedentes\./,
      "/projects/project-1?task=task-1",
    ],
    [
      "task.archived",
      { taskId: "task-1", taskTitle: "Revisar antecedentes" },
      /archivó la tarea Revisar antecedentes\./,
      "/projects/project-1?task=task-1",
    ],
    [
      "task.restored",
      { taskId: "task-1", taskTitle: "Revisar antecedentes" },
      /restauró la tarea Revisar antecedentes\./,
      "/projects/project-1?task=task-1",
    ],
  ])("renders %s with a navigable task", (type, details, text, href) => {
    const { container } = renderMessage(activity(type, details));

    expect(container).toHaveTextContent(text);
    expect(
      screen.getByRole("link", { name: "Revisar antecedentes" }),
    ).toHaveAttribute("href", href);
  });

  test.each([
    [
      activity("project_assignment.added", {
        responsibility: "responsible",
      }),
      /asignó a .* como Supervisor del proyecto\./,
    ],
    [
      activity("project_assignment.added", { responsibility: "member" }),
      /agregó a .* al proyecto\./,
    ],
    [
      activity("project_assignment.responsibility_changed", {
        previousResponsibility: "member",
        newResponsibility: "responsible",
      }),
      /cambió la supervisión de .* a Supervisor del proyecto\./,
    ],
    [
      activity("project_assignment.responsibility_changed", {
        previousResponsibility: "responsible",
        newResponsibility: "member",
      }),
      /cambió la supervisión de .* a Miembro del proyecto\./,
    ],
    [
      activity("project_assignment.removed", {
        previousResponsibility: "member",
      }),
      /quitó a .* del proyecto\./,
    ],
    [
      activity("organization_member.removed", { memberId: "member-2" }),
      /retiró a .* del estudio\. Su participación en este proyecto quedó en el historial\./,
    ],
  ])("renders a semantic project member event", (record, text) => {
    const { container } = renderMessage(record);

    expect(container).toHaveTextContent(text);
    expect(screen.getByRole("link", { name: /Ana Torres/ })).toHaveAttribute(
      "href",
      "/team/actor-1",
    );
    expect(screen.getByRole("link", { name: /Luis Ramos/ })).toHaveAttribute(
      "href",
      "/team/subject-1",
    );
  });

  test.each([
    {
      ...subject,
      linkable: false,
    },
    {
      ...subject,
      userId: null,
    },
  ])("keeps an unavailable member as a Retirado snapshot", (removedSubject) => {
    renderMessage(
      activity(
        "project_assignment.removed",
        { previousResponsibility: "member" },
        { subject: removedSubject },
      ),
    );

    expect(screen.getByText("Luis Ramos · Retirado")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Luis Ramos/ }),
    ).not.toBeInTheDocument();
  });

  test("renders a task title without a link when the activity has no task ID", () => {
    renderMessage(
      activity(
        "task.created",
        { taskTitle: "Tarea sin destino" },
        { subject: null },
      ),
    );

    expect(screen.getByText("Tarea sin destino")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Tarea sin destino" }),
    ).not.toBeInTheDocument();
  });

  test("uses a safe text fallback for unknown or malformed activity", () => {
    const { rerender } = renderMessage(activity("unknown", {}));
    expect(
      screen.getByText("Se registró una actividad en el proyecto."),
    ).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <p>
          <ProjectActivityMessage
            activity={activity("task.status_changed", {
              taskTitle: "Tarea",
            })}
            projectId="project-1"
          />
        </p>
      </MemoryRouter>,
    );
    expect(
      screen.getByText("Se registró una actividad en el proyecto."),
    ).toBeInTheDocument();
  });
});
