import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ProjectTeam } from "@/features/projects/project-team";

const mocks = vi.hoisted(() => ({
  query: {
    data: undefined as unknown,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
}));

vi.mock(
  "@/lib/api/generated/project-collaboration/project-collaboration",
  () => ({
    useListProjectAssignments: () => mocks.query,
  }),
);

vi.mock("@/features/projects/project-team-manager", () => ({
  ProjectTeamManager: () => <div>Administrador abierto</div>,
}));

const assignment = {
  id: "assignment-1",
  userId: "user-2",
  userName: "Luis Ramos",
  userEmail: "luis@orbit.pe",
  userAlias: "Lucho",
  activeStudioMember: true,
  responsibility: "responsible" as const,
  assignedByUserId: "user-1",
  assignedByName: "Ana Torres",
  assignedAt: "2026-08-06T20:00:00.000Z",
  endedAt: null,
  endedByUserId: null,
  endedByName: null,
  endReason: null,
};

describe("ProjectTeam", () => {
  beforeEach(() => {
    mocks.query.data = {
      active: [
        assignment,
        {
          ...assignment,
          id: "assignment-2",
          userId: "user-3",
          userName: "María Solís",
          userAlias: "Mari",
        },
        {
          ...assignment,
          id: "assignment-3",
          userId: "user-4",
          userName: "José Vega",
          userAlias: "Pepe",
          responsibility: "member",
        },
      ],
      history: [
        {
          ...assignment,
          id: "assignment-4",
          endedAt: "2026-08-07T20:00:00.000Z",
          endedByUserId: "user-1",
          endedByName: "Ana Torres",
          endReason: "project_unassigned",
        },
        {
          ...assignment,
          id: "assignment-5",
          userId: "user-5",
          userName: "Elena Prado",
          userEmail: "elena@orbit.pe",
          userAlias: "EP",
          activeStudioMember: false,
          responsibility: "member",
          endedAt: "2026-08-07T20:00:00.000Z",
          endedByUserId: "user-1",
          endedByName: "Ana Torres",
          endReason: "organization_removed",
        },
      ],
      historyPagination: { page: 1, pageSize: 25, total: 2, totalPages: 1 },
    };
    mocks.query.isPending = false;
    mocks.query.isError = false;
    mocks.query.refetch.mockReset();
  });

  test("groups several supervisors and preserves former participation", () => {
    render(
      <MemoryRouter>
        <ProjectTeam projectId="project-1" />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Equipo del proyecto" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Supervisores del proyecto" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Lucho").length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: /Luis Ramos/ })[0],
    ).toHaveAttribute("href", "/team/user-2");
    expect(screen.getAllByText("Mari").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Otros miembros del proyecto" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Pepe").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Participación anterior" }),
    ).toBeInTheDocument();
    const endedActiveParticipation = screen
      .getByText("Participación finalizada")
      .closest("article");
    expect(endedActiveParticipation).not.toBeNull();
    expect(
      within(endedActiveParticipation!).getByText("Lucho"),
    ).toBeInTheDocument();
    expect(
      within(endedActiveParticipation!).getByRole("link", {
        name: /Luis Ramos/,
      }),
    ).toHaveAttribute("href", "/team/user-2");
    const formerParticipation = screen
      .getByText("Elena Prado")
      .closest("article");
    expect(formerParticipation).not.toBeNull();
    expect(
      within(formerParticipation!).getByText("Miembro retirado"),
    ).toBeInTheDocument();
    expect(
      within(formerParticipation!).getByText("Miembro del proyecto"),
    ).toBeInTheDocument();
    expect(
      within(formerParticipation!).getByText("Asignado: 6 ago. 2026"),
    ).toBeInTheDocument();
    expect(
      within(formerParticipation!).getByText("Finalizado: 7 ago. 2026"),
    ).toBeInTheDocument();
    expect(
      within(formerParticipation!).queryByRole("link"),
    ).not.toBeInTheDocument();
  });

  test("uses a one-column people layout in the compact dashboard rail", () => {
    render(
      <MemoryRouter>
        <ProjectTeam projectId="project-1" compact />
      </MemoryRouter>,
    );

    expect(
      screen.getByTestId("project-team-active-responsible"),
    ).toHaveAttribute("data-layout", "compact");
    expect(screen.getByTestId("project-team-active-member")).toHaveAttribute(
      "data-layout",
      "compact",
    );
    expect(screen.getAllByText("Lucho").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pepe").length).toBeGreaterThan(0);
  });

  test("opens management for an active studio member", () => {
    render(
      <MemoryRouter>
        <ProjectTeam projectId="project-1" />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Gestionar equipo" }));
    expect(screen.getByText("Administrador abierto")).toBeInTheDocument();
  });

  test("keeps archived participation readable without management controls", () => {
    render(
      <MemoryRouter>
        <ProjectTeam projectId="project-1" readOnly />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Lucho").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "Gestionar equipo" }),
    ).not.toBeInTheDocument();
  });

  test("shows an honest empty state", () => {
    mocks.query.data = {
      active: [],
      history: [],
      historyPagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    };
    render(
      <MemoryRouter>
        <ProjectTeam projectId="project-1" />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Aún no hay personas asignadas"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Luis Ramos")).not.toBeInTheDocument();
  });

  test("offers retry without fabricating assignments after an error", () => {
    mocks.query.data = undefined;
    mocks.query.isError = true;
    render(
      <MemoryRouter>
        <ProjectTeam projectId="project-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(mocks.query.refetch).toHaveBeenCalledOnce();
    expect(screen.queryByText("Luis Ramos")).not.toBeInTheDocument();
  });
});
