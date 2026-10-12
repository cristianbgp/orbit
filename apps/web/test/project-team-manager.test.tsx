import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ProjectTeamManager } from "@/features/projects/project-team-manager";
import type { ProjectAssignment } from "@/lib/api/generated/models";

Element.prototype.scrollIntoView = vi.fn();

const mocks = vi.hoisted(() => ({
  candidateParams: undefined as unknown,
  candidates: {
    data: {
      candidates: [
        {
          memberId: "member-2",
          userId: "user-2",
          name: "Luis Ramos",
          email: "luis@orbit.pe",
          userAlias: "LR",
          userAvatarColor: "#11182b",
          activeStudioMember: true,
          assigned: false,
        },
        {
          memberId: "member-3",
          userId: "user-3",
          name: "María Solís",
          email: "maria@orbit.pe",
          userAlias: "MS",
          userAvatarColor: "#4657d9",
          activeStudioMember: true,
          assigned: false,
        },
      ],
      pagination: { page: 1, pageSize: 25, total: 30, totalPages: 2 },
    },
    isPending: false,
    isError: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
  },
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock(
  "@/lib/api/generated/project-collaboration/project-collaboration",
  () => ({
    useListProjectAssignmentCandidates: (
      _projectId: string,
      params: unknown,
    ) => {
      mocks.candidateParams = params;
      return mocks.candidates;
    },
    useAddProjectAssignments: () => ({
      mutateAsync: mocks.add,
      isPending: false,
    }),
    useUpdateProjectAssignment: () => ({
      mutateAsync: mocks.update,
      isPending: false,
    }),
    useRemoveProjectAssignment: () => ({
      mutateAsync: mocks.remove,
      isPending: false,
    }),
    getListProjectAssignmentsQueryKey: (projectId: string) => [
      `/api/projects/${projectId}/assignments`,
    ],
    getListProjectAssignmentCandidatesQueryKey: (projectId: string) => [
      `/api/projects/${projectId}/assignment-candidates`,
    ],
  }),
);

vi.mock("@/lib/api/generated/activity/activity", () => ({
  getListProjectActivitiesQueryKey: (projectId: string) => [
    `/api/projects/${projectId}/activities`,
  ],
}));

const active: ProjectAssignment[] = [
  {
    id: "assignment-1",
    userId: "user-4",
    userName: "José Vega",
    userEmail: "jose@orbit.pe",
    userAlias: "JV",
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

function renderManager() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProjectTeamManager
          projectId="project-1"
          activeAssignments={active}
          onDone={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { invalidate };
}

describe("ProjectTeamManager", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mocks.add.mockReset().mockResolvedValue({ assignments: [] });
    mocks.update.mockReset().mockResolvedValue({ assignment: active[0] });
    mocks.remove.mockReset().mockResolvedValue({ assignment: active[0] });
    mocks.candidateParams = undefined;
  });

  test("debounces candidate search and requests candidate pages", async () => {
    vi.useFakeTimers();
    renderManager();
    fireEvent.change(screen.getByLabelText("Buscar miembros del estudio"), {
      target: { value: "Luis" },
    });
    expect(mocks.candidateParams).toMatchObject({ search: undefined, page: 1 });
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(mocks.candidateParams).toMatchObject({ search: "Luis", page: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(mocks.candidateParams).toMatchObject({ search: "Luis", page: 2 });
  });

  test("adds multiple people with an independent responsibility for each", async () => {
    const { invalidate } = renderManager();
    expect(screen.getAllByText("LR").length).toBeGreaterThan(0);
    expect(screen.getByText("luis@orbit.pe")).toBeInTheDocument();
    expect(screen.getByLabelText("Luis Ramos")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Luis Ramos/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /LR.*luis@orbit.pe/ }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: /MS.*maria@orbit.pe/ }),
    );
    fireEvent.click(screen.getByLabelText("Supervisión de Luis Ramos"));
    fireEvent.click(
      screen.getByRole("option", { name: "Supervisor del proyecto" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar seleccionados" }),
    );

    await waitFor(() =>
      expect(mocks.add).toHaveBeenCalledWith({
        projectId: "project-1",
        data: {
          assignments: [
            { userId: "user-2", responsibility: "responsible" },
            { userId: "user-3", responsibility: "member" },
          ],
        },
      }),
    );
    expect(invalidate).toHaveBeenCalledTimes(3);
  });

  test("changes responsibility and explicitly confirms assignment removal", async () => {
    renderManager();
    expect(screen.getAllByText("JV").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /José Vega/ })).toHaveAttribute(
      "href",
      "/team/user-4",
    );
    fireEvent.click(screen.getByLabelText("Supervisión de José Vega"));
    fireEvent.click(
      screen.getByRole("option", { name: "Supervisor del proyecto" }),
    );
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        projectId: "project-1",
        assignmentId: "assignment-1",
        data: { responsibility: "responsible" },
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Quitar a José Vega del proyecto" }),
    );
    expect(
      screen.getByText(/Su participación anterior permanecerá/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar retiro" }));
    await waitFor(() =>
      expect(mocks.remove).toHaveBeenCalledWith({
        projectId: "project-1",
        assignmentId: "assignment-1",
      }),
    );
  });

  test("keeps selections and reports a stale write for retry", async () => {
    mocks.add.mockRejectedValueOnce({ status: 409 });
    renderManager();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /LR.*luis@orbit.pe/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar seleccionados" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "cambió mientras editabas",
    );
    expect(
      screen.getByRole("checkbox", { name: /LR.*luis@orbit.pe/ }),
    ).toBeChecked();
  });
});
