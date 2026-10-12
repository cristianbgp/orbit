import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectCompletionSuggestion } from "@/features/projects/project-completion-suggestion";
import type { Project } from "@/lib/api/generated/models/project";

const project = {
  id: "project-1",
  client: { id: "client-1", name: "Cliente Uno" },
  name: "Recurso de apelación",
  type: "written_submission" as const,
  status: "active" as const,
  startDate: "2026-08-06",
  endDate: "2026-08-20",
  internalReference: "EXP-42",
  description: "Proyecto de prueba",
  archivedAt: null as string | null,
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
};

const mocks = vi.hoisted(() => ({
  schedule: {
    data: undefined as
      | undefined
      | {
          stages: Array<{
            id: string;
            tasks: Array<{ id: string; status: string }>;
          }>;
        },
    isPending: false,
    isError: false,
  },
  update: vi.fn(),
}));

vi.mock("@/lib/api/generated/project-tasks/project-tasks", () => ({
  useGetProjectTaskSchedule: () => mocks.schedule,
}));

vi.mock("@/lib/api/generated/projects/projects", () => ({
  getGetProjectQueryKey: (projectId: string) => [`/api/projects/${projectId}`],
  getListProjectsQueryKey: () => ["/api/projects"],
  useUpdateProject: () => ({ mutateAsync: mocks.update }),
}));

vi.mock("@/lib/api/generated/activity/activity", () => ({
  getListProjectActivitiesQueryKey: (projectId: string) => [
    `/api/projects/${projectId}/activities`,
  ],
}));

function completedSchedule(...statuses: string[]) {
  return {
    stages: [
      {
        id: "stage-1",
        tasks: statuses.map((status, index) => ({
          id: `task-${index + 1}`,
          status,
        })),
      },
    ],
  };
}

function renderSuggestion(candidate: Project = project) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi
    .spyOn(queryClient, "invalidateQueries")
    .mockResolvedValue(undefined);

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <ProjectCompletionSuggestion project={candidate} />
    </QueryClientProvider>,
  );

  return { ...rendered, invalidate, queryClient };
}

describe("ProjectCompletionSuggestion", () => {
  beforeEach(() => {
    mocks.schedule.data = completedSchedule("completed", "completed");
    mocks.schedule.isPending = false;
    mocks.schedule.isError = false;
    mocks.update.mockReset().mockResolvedValue({
      project: { ...project, status: "completed" },
    });
  });

  test("suggests completion only for an active project with at least one completed task", () => {
    const rendered = renderSuggestion();
    expect(
      screen.getByText("Todas las tareas del proyecto están completadas."),
    ).toBeVisible();

    rendered.unmount();
    mocks.schedule.data = completedSchedule();
    const empty = renderSuggestion();
    expect(
      screen.queryByText("Todas las tareas del proyecto están completadas."),
    ).not.toBeInTheDocument();

    empty.unmount();
    mocks.schedule.data = completedSchedule("completed", "in_progress");
    const incomplete = renderSuggestion();
    expect(
      screen.queryByText("Todas las tareas del proyecto están completadas."),
    ).not.toBeInTheDocument();

    incomplete.unmount();
    mocks.schedule.data = completedSchedule("completed");
    renderSuggestion({ ...project, status: "draft" });
    expect(
      screen.queryByText("Todas las tareas del proyecto están completadas."),
    ).not.toBeInTheDocument();
  });

  test("confirms completion and refreshes project, portfolio, and activity data", async () => {
    const { invalidate, queryClient } = renderSuggestion();

    fireEvent.click(
      screen.getByRole("button", { name: "Marcar proyecto como completado" }),
    );
    expect(
      screen.getByRole("group", { name: "Confirmar proyecto completado" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        projectId: "project-1",
        data: {
          status: "completed",
        },
      }),
    );
    expect(queryClient.getQueryData(["/api/projects/project-1"])).toEqual({
      project: { ...project, status: "completed" },
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/projects/project-1"],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["/api/projects"] });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/projects/project-1/activities"],
    });
  });

  test("keeps the confirmation visible and explains a failed update", async () => {
    mocks.update.mockRejectedValue(new Error("network unavailable"));
    renderSuggestion();

    fireEvent.click(
      screen.getByRole("button", { name: "Marcar proyecto como completado" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos completar el proyecto. Inténtalo nuevamente.",
    );
    expect(
      screen.getByRole("group", { name: "Confirmar proyecto completado" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled();
  });
});
