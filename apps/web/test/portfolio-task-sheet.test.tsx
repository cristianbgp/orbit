import { createRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { PortfolioTaskSheet } from "@/features/projects/portfolio-task-sheet";
import { ApiClientError } from "@/lib/api/fetcher";

const mocks = vi.hoisted(() => ({
  projectQuery: {
    data: undefined as unknown,
    isPending: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
  sheetProps: undefined as undefined | Record<string, unknown>,
}));
vi.mock("@/lib/api/generated/projects/projects", () => ({
  useGetProject: () => mocks.projectQuery,
}));
vi.mock("@/features/projects/project-task-sheet", () => ({
  ProjectTaskSheet: (props: Record<string, unknown>) => {
    mocks.sheetProps = props;
    return <div>Detalle de tarea reutilizado</div>;
  },
}));

function renderSheet(
  taskProjectId: string | null = "project-1",
  taskId: string | null = "task-1",
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PortfolioTaskSheet
          taskProjectId={taskProjectId}
          taskId={taskId}
          open={Boolean(taskProjectId && taskId)}
          openerRef={createRef()}
          onOpenChange={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { invalidate };
}

describe("PortfolioTaskSheet", () => {
  beforeEach(() => {
    mocks.projectQuery.data = {
      project: {
        id: "project-1",
        name: "Recurso Runa",
        client: { id: "client-1", name: "Runa Card SAC" },
        startDate: "2026-08-01",
        archivedAt: null,
      },
    };
    mocks.projectQuery.isPending = false;
    mocks.projectQuery.isError = false;
    mocks.projectQuery.error = null;
    mocks.sheetProps = undefined;
  });

  test("resolves the project before reusing the existing task Sheet", () => {
    renderSheet();
    expect(screen.getByText("Detalle de tarea reutilizado")).toBeVisible();
    expect(mocks.sheetProps).toMatchObject({
      projectId: "project-1",
      projectStartDate: "2026-08-01",
      taskId: "task-1",
      open: true,
      projectContext: {
        name: "Recurso Runa",
        clientName: "Runa Card SAC",
      },
    });
  });

  test("does not fetch or mount a task with incomplete URL selection", () => {
    renderSheet(null, "task-1");
    expect(
      screen.queryByText("Detalle de tarea reutilizado"),
    ).not.toBeInTheDocument();
  });

  test("keeps direct refresh safe while the project is loading", () => {
    mocks.projectQuery.data = undefined;
    mocks.projectQuery.isPending = true;
    renderSheet();
    expect(
      screen.getByLabelText("Cargando proyecto de la tarea"),
    ).toBeVisible();
  });

  test("shows an unavailable state without retrying a missing project", () => {
    mocks.projectQuery.data = undefined;
    mocks.projectQuery.isError = true;
    mocks.projectQuery.error = new ApiClientError("missing", {
      kind: "http",
      status: 404,
      retryable: false,
    });

    renderSheet();

    expect(screen.getByText("Tarea no disponible")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Intentar de nuevo" }),
    ).not.toBeInTheDocument();
  });
});
