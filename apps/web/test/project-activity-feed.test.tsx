import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRef, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectActivityFeed } from "@/features/projects/project-activity-feed";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
}));

vi.mock("@/lib/api/generated/activity/activity", () => ({
  getListProjectActivitiesQueryKey: (projectId: string) => [
    `/api/projects/${projectId}/activities`,
  ],
  listProjectActivities: mocks.list,
  useListProjectActivities: () => ({
    data: response(firstPageActivities, 1, 2, 11),
    isPending: false,
    isError: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
  }),
}));

const firstPageActivities = [
  {
    id: "activity-2",
    type: "task.status_changed",
    actor: {
      userId: "user-1",
      alias: "AT",
      nameSnapshot: "Ana Torres",
      activeStudioMember: true,
      linkable: true,
    },
    subject: null,
    details: {
      taskId: "task-1",
      taskTitle: "Preparar recurso",
      previousStatus: "pending",
      newStatus: "in_progress",
    },
    createdAt: "2026-08-06T20:00:00.000Z",
  },
  {
    id: "activity-1",
    type: "project_assignment.added",
    actor: {
      userId: "user-1",
      alias: "AT",
      nameSnapshot: "Ana Torres",
      activeStudioMember: true,
      linkable: true,
    },
    subject: {
      userId: "user-3",
      alias: "MS",
      nameSnapshot: "María Solís",
      activeStudioMember: true,
      linkable: true,
    },
    details: { responsibility: "member" },
    createdAt: "2026-08-06T19:00:00.000Z",
  },
];

const secondPageActivity = {
  ...firstPageActivities[1],
  id: "activity-0",
  createdAt: "2026-08-05T19:00:00.000Z",
};

function response(
  activities: typeof firstPageActivities,
  page: number,
  totalPages: number,
  total: number,
) {
  return {
    activities,
    pagination: { page, pageSize: 10, total, totalPages },
  };
}

function renderFeed(
  children: ReactNode = <ProjectActivityFeed projectId="project-1" />,
  initialEntries = ["/"],
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ProjectActivityFeed", () => {
  beforeEach(() => {
    mocks.list
      .mockReset()
      .mockImplementation((_projectId: string, params: { page: number }) =>
        Promise.resolve(
          params.page === 1
            ? response(firstPageActivities, 1, 2, 3)
            : response([secondPageActivity], 2, 2, 3),
        ),
      );
  });

  test("renders newest-first activity with timestamps and task links", async () => {
    renderFeed();

    const entries = await screen.findAllByRole("listitem");
    expect(entries[0]).toHaveTextContent(
      /cambió el estado de Preparar recurso de Pendiente a En trabajo\./,
    );
    expect(entries[1]).toHaveTextContent(/agregó a .* al proyecto\./);
    expect(screen.getAllByRole("time")[0]).toHaveAttribute(
      "datetime",
      "2026-08-06T20:00:00.000Z",
    );
    expect(
      screen.getByRole("link", { name: "Preparar recurso" }),
    ).toHaveAttribute("href", "/projects/project-1?task=task-1");
  });

  test("selects activity tasks without discarding the current project query", async () => {
    const openerRef = createRef<HTMLElement>();
    function LocationProbe() {
      const location = useLocation();
      return (
        <output data-testid="location">{`${location.pathname}${location.search}`}</output>
      );
    }

    renderFeed(
      <>
        <ProjectActivityFeed projectId="project-1" taskOpenerRef={openerRef} />
        <LocationProbe />
      </>,
      ["/projects/project-1?view=active&filter=mine"],
    );

    const taskLink = await screen.findByRole("link", {
      name: "Preparar recurso",
    });
    fireEvent.click(taskLink);

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/projects/project-1?view=active&filter=mine&task=task-1",
    );
    expect(openerRef.current).toBe(taskLink);
  });

  test("requests ten recent events and appends the next page", async () => {
    renderFeed();

    await waitFor(() =>
      expect(mocks.list).toHaveBeenCalledWith(
        "project-1",
        { page: 1, pageSize: 10 },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Cargar más actividad" }),
    );

    await waitFor(() =>
      expect(screen.getAllByRole("listitem")).toHaveLength(3),
    );
    expect(
      screen
        .getAllByRole("time")
        .some(
          (time) =>
            time.getAttribute("datetime") === "2026-08-05T19:00:00.000Z",
        ),
    ).toBe(true);
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(mocks.list).toHaveBeenLastCalledWith(
      "project-1",
      { page: 2, pageSize: 10 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(
      screen.queryByRole("button", { name: "Cargar más actividad" }),
    ).not.toBeInTheDocument();
  });

  test("keeps earlier events and retries a failed next page", async () => {
    mocks.list.mockImplementation(
      (_projectId: string, params: { page: number }) =>
        params.page === 1
          ? Promise.resolve(response(firstPageActivities, 1, 2, 3))
          : Promise.reject(new Error("network")),
    );
    renderFeed();

    fireEvent.click(
      await screen.findByRole("button", { name: "Cargar más actividad" }),
    );
    expect(
      await screen.findByText("No pudimos cargar más actividad."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    mocks.list.mockResolvedValue(response([secondPageActivity], 2, 2, 3));
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    await waitFor(() =>
      expect(screen.getAllByRole("listitem")).toHaveLength(3),
    );
    expect(
      screen
        .getAllByRole("time")
        .some(
          (time) =>
            time.getAttribute("datetime") === "2026-08-05T19:00:00.000Z",
        ),
    ).toBe(true);
  });

  test("renders initial loading, empty, and retry states", async () => {
    let resolveInitial:
      ((value: ReturnType<typeof response>) => void) | undefined;
    mocks.list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInitial = resolve;
        }),
    );
    const view = renderFeed();
    expect(screen.getByLabelText("Cargando actividad")).toBeInTheDocument();
    resolveInitial?.(response([], 1, 0, 0));
    expect(
      await screen.findByText("Aún no hay actividad registrada"),
    ).toBeInTheDocument();
    view.unmount();

    mocks.list
      .mockReset()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(response(firstPageActivities, 1, 2, 3));
    renderFeed();
    fireEvent.click(
      await screen.findByRole("button", { name: "Intentar de nuevo" }),
    );
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
  });
});
