import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectStages } from "@/features/projects/project-stages";

const stages = [
  {
    id: "stage-1",
    name: "Investigación",
    description: "Reunir fundamentos.",
    position: 0,
    createdAt: "2026-08-06T10:00:00.000Z",
    updatedAt: "2026-08-06T10:00:00.000Z",
  },
  {
    id: "stage-2",
    name: "Estrategia",
    description: null,
    position: 1,
    createdAt: "2026-08-06T10:00:00.000Z",
    updatedAt: "2026-08-06T10:00:00.000Z",
  },
];

const mocks = vi.hoisted(() => ({
  query: {
    data: undefined as undefined | { stages: typeof stages },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  member: {
    data: { role: "member" } as null | { role: string },
    isPending: false,
  },
  scheduleQuery: {
    data: {
      project: {
        startDate: "2026-08-06",
        endDate: "2026-08-14",
        timeZone: "America/Lima",
      },
      stages: [
        {
          id: "stage-1",
          name: "Investigación",
          position: 0,
          startDate: null,
          endDate: null,
          scheduledTaskCount: 0,
          taskStatusCounts: {
            pending: 1,
            inProgress: 1,
            blocked: 0,
            completed: 0,
          },
          usesProjectStartFallback: false,
        },
        {
          id: "stage-2",
          name: "Estrategia",
          position: 1,
          startDate: null,
          endDate: null,
          scheduledTaskCount: 0,
          taskStatusCounts: {
            pending: 0,
            inProgress: 0,
            blocked: 0,
            completed: 0,
          },
          usesProjectStartFallback: false,
        },
      ],
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
}));

vi.mock("@/lib/api/generated/project-stages/project-stages", () => ({
  useListProjectStages: () => mocks.query,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useActiveMember: () => mocks.member },
}));

vi.mock("@/lib/api/generated/project-tasks/project-tasks", () => ({
  useGetProjectTaskSchedule: () => mocks.scheduleQuery,
}));

vi.mock("@/features/projects/project-stage-editor", () => ({
  ProjectStageEditor: ({ startAdding }: { startAdding?: boolean }) => (
    <p>{startAdding ? "Editor agregando" : "Editor de estructura"}</p>
  ),
}));

describe("ProjectStages", () => {
  beforeEach(() => {
    mocks.query.data = { stages };
    mocks.query.isPending = false;
    mocks.query.isError = false;
    mocks.query.refetch.mockReset().mockResolvedValue(undefined);
    mocks.member.data = { role: "member" };
    mocks.member.isPending = false;
  });

  test("renders stages as an ordered legal path", () => {
    render(<ProjectStages projectId="project-1" />);

    expect(screen.getByRole("heading", { name: "Etapas" })).toBeInTheDocument();
    expect(
      screen.getByText("Estructura de etapas de este proyecto."),
    ).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Investigación");
    expect(items[0]).toHaveTextContent("Reunir fundamentos.");
    expect(items[1]).toHaveTextContent("Estrategia");
    expect(items[1]).not.toHaveTextContent("Reunir fundamentos.");
    expect(items[0]).toHaveTextContent("En curso");
    expect(items[1]).toHaveTextContent("Sin tareas");
    expect(
      screen.getByRole("button", { name: "Editar estructura" }),
    ).toBeInTheDocument();
  });

  test("shows structure editing to an active studio member", () => {
    render(<ProjectStages projectId="project-1" />);

    expect(
      screen.getByRole("button", { name: "Editar estructura" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar estructura" }));
    expect(screen.getByText("Editor de estructura")).toBeInTheDocument();
  });

  test("offers manual creation to an active studio member when empty", () => {
    mocks.query.data = { stages: [] };
    render(<ProjectStages projectId="project-1" />);

    expect(
      screen.getByText("Este proyecto todavía no tiene etapas."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Agregar etapa" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Agregar etapa" }));
    expect(screen.getByText("Editor agregando")).toBeInTheDocument();
  });

  test("keeps the empty state read-only without an active membership", () => {
    mocks.query.data = { stages: [] };
    mocks.member.data = null;
    render(<ProjectStages projectId="project-1" />);

    expect(
      screen.getByText("Este proyecto todavía no tiene etapas."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Agregar etapa" }),
    ).not.toBeInTheDocument();
  });

  test("renders stage-shaped loading feedback", () => {
    mocks.query.data = undefined;
    mocks.query.isPending = true;
    render(<ProjectStages projectId="project-1" />);

    expect(screen.getByLabelText("Cargando etapas")).toBeInTheDocument();
  });

  test("offers retry after a stage query failure", () => {
    mocks.query.data = undefined;
    mocks.query.isError = true;
    render(<ProjectStages projectId="project-1" />);

    expect(
      screen.getByText("No pudimos cargar las etapas."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(mocks.query.refetch).toHaveBeenCalledOnce();
  });

  test("waits for membership before exposing mutation controls", () => {
    mocks.member.data = null;
    mocks.member.isPending = true;
    render(<ProjectStages projectId="project-1" />);

    expect(
      screen.queryByRole("button", { name: "Editar estructura" }),
    ).not.toBeInTheDocument();
  });

  test("keeps archived project stages readable without mutation controls", () => {
    render(<ProjectStages projectId="project-1" readOnly />);
    expect(screen.getByText("Investigación")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Editar estructura" }),
    ).not.toBeInTheDocument();
  });
});
