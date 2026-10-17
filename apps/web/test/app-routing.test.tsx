import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { App } from "@/app";

const mocks = vi.hoisted(() => ({
  sessionPending: false,
  organizationsPending: false,
  session: null as null | {
    user: { id: string; name: string; email: string };
    session: { id: string; activeOrganizationId: string | null };
  },
  organizations: [] as {
    id: string;
    name: string;
    slug: string;
    timeZone: string;
  }[],
  userInvitations: [] as Array<{
    id: string;
    organizationId: string;
    organizationName: string;
    email: string;
    role: "member";
    status: "pending";
    inviterId: string;
    createdAt: Date;
    expiresAt: Date;
  }>,
  create: vi.fn(),
  setActive: vi.fn(),
  listMembers: vi.fn(),
  getInvitation: vi.fn(),
  acceptInvitation: vi.fn(),
  listUserInvitations: vi.fn(),
  rejectInvitation: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  resetPassword: vi.fn(),
}));

const project = {
  id: "project-1",
  client: { id: "client-1", name: "Constructora del Sur S.A." },
  name: "Apelación Constructora",
  type: "written_submission" as const,
  status: "draft" as const,
  startDate: "2026-08-06",
  endDate: "2026-08-14",
  internalReference: "EXP-2026-014",
  description: "Impugnación de la resolución de primera instancia.",
  archivedAt: null,
  createdAt: "2026-08-05T10:00:00.000Z",
  updatedAt: "2026-08-05T10:00:00.000Z",
};

function receivedInvitation(
  id: string,
  expiresAt = new Date("2099-08-08T17:00:00.000Z"),
) {
  return {
    id,
    organizationId: "org-1",
    organizationName: "Estudio Orbit",
    email: "member@orbit.pe",
    role: "member" as const,
    status: "pending" as const,
    inviterId: "owner-1",
    createdAt: new Date("2026-08-06T12:00:00.000Z"),
    expiresAt,
  };
}

vi.mock("@/features/system-status/use-api-health", () => ({
  useApiHealth: () => ({
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/lib/api/generated/dashboard/dashboard", () => ({
  getListDashboardActivityQueryKey: () => ["/api/dashboard/activity"],
  listDashboardActivity: vi.fn().mockResolvedValue({
    timeZone: "America/Lima",
    activities: [],
    nextCursor: null,
  }),
}));

vi.mock("@/lib/api/generated/my-work/my-work", () => ({
  getListMyAssignedTasksQueryKey: () => ["/api/my-work/tasks"],
  getListMySupervisionQueryKey: () => ["/api/my-work/supervision"],
  getListMyCaseActionsQueryKey: () => ["/api/my-work/case-actions"],
  useListMyAssignedTasks: () => ({
    data: {
      today: "2026-08-10",
      tasks: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    },
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useListMySupervision: () => ({
    data: {
      today: "2026-08-10",
      projects: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    },
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useListMyCaseActions: () => ({
    data: {
      actions: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    },
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/lib/api/generated/identity/identity", () => ({
  getGetCurrentUserQueryKey: () => ["/api/me"],
  useGetCurrentUser: () => ({
    data: mocks.session
      ? {
          user: {
            ...mocks.session.user,
            alias: "AT",
            image: null,
            createdAt: "2026-08-01T10:00:00.000Z",
          },
        }
      : undefined,
    isPending: false,
    isError: !mocks.session,
    refetch: vi.fn(),
  }),
  useUpdateCurrentUser: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/lib/api/generated/team/team", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/generated/team/team")>()),
  useGetTeamMember: (userId: string) => ({
    data: {
      member: {
        memberId: `member-${userId}`,
        userId,
        alias: userId === "user-2" ? "DS" : "AT",
        name: userId === "user-2" ? "Diego Salazar" : "Ana Torres",
        email: userId === "user-2" ? "diego@orbit.pe" : "ana@orbit.pe",
        image: null,
        role: userId === "user-2" ? "member" : "owner",
        memberSince: "2026-08-05T10:00:00.000Z",
        isCurrentUser: userId === mocks.session?.user.id,
      },
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/lib/api/generated/projects/projects", () => ({
  getGetProjectQueryKey: (projectId: string) => [`/api/projects/${projectId}`],
  getListProjectsQueryKey: () => ["/api/projects"],
  getListProjectsGroupedByClientQueryKey: () => [
    "/api/projects/grouped-by-client",
  ],
  useListProjects: () => ({
    data: {
      projects: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    },
    isPending: false,
    isError: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
  }),
  useListProjectsGroupedByClient: () => ({
    data: {
      groups: [],
      pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
      projectTotal: 0,
    },
    isPending: false,
    isError: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
  }),
  useCreateProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGetProject: () => ({
    data: { project },
    error: null,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useUpdateProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArchiveProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRestoreProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock(
  "@/lib/api/generated/project-tasks/project-tasks",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/lib/api/generated/project-tasks/project-tasks")
    >()),
    useListProjectTaskCalendar: () => ({
      data: {
        tasks: [],
        markers: [],
        undatedTaskCount: 0,
        truncated: false,
      },
      isPending: false,
      isError: false,
      isFetching: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
    }),
    useListUndatedProjectTasks: () => ({
      data: {
        tasks: [],
        pagination: {
          page: 1,
          pageSize: 25,
          total: 0,
          totalPages: 0,
        },
      },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
    }),
  }),
);

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useActiveMember: () => ({
      data: { role: "member" },
      isPending: false,
    }),
    useSession: () => ({
      data: mocks.session,
      isPending: mocks.sessionPending,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    }),
    useListOrganizations: () => {
      const [data, setData] = useState(mocks.organizations);

      return {
        data,
        isPending: mocks.organizationsPending,
        error: null,
        refetch: async () => {
          setData([...mocks.organizations]);
        },
      };
    },
    organization: {
      create: mocks.create,
      getInvitation: mocks.getInvitation,
      acceptInvitation: mocks.acceptInvitation,
      listUserInvitations: mocks.listUserInvitations,
      rejectInvitation: mocks.rejectInvitation,
      listMembers: mocks.listMembers,
      setActive: mocks.setActive,
    },
    signIn: { email: mocks.signIn },
    signUp: { email: mocks.signUp },
    resetPassword: mocks.resetPassword,
    signOut: mocks.signOut,
  },
}));

function renderApp(initialPath = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("application organization routing", () => {
  beforeEach(() => {
    mocks.sessionPending = false;
    mocks.organizationsPending = false;
    mocks.session = null;
    mocks.organizations = [];
    mocks.userInvitations = [];
    mocks.create.mockReset().mockImplementation(async ({ name, slug }) => {
      const organization = {
        id: "org-1",
        name,
        slug,
        timeZone: "America/Lima",
      };
      mocks.organizations = [organization];
      return { data: organization, error: null };
    });
    mocks.setActive.mockReset().mockResolvedValue({ data: null, error: null });
    mocks.listMembers.mockReset().mockResolvedValue({
      data: { members: [], total: 0 },
      error: null,
    });
    mocks.getInvitation
      .mockReset()
      .mockResolvedValue({ data: null, error: null });
    mocks.acceptInvitation
      .mockReset()
      .mockResolvedValue({ data: null, error: null });
    mocks.listUserInvitations.mockReset().mockImplementation(async () => ({
      data: [...mocks.userInvitations],
      error: null,
    }));
    mocks.rejectInvitation
      .mockReset()
      .mockImplementation(
        async ({ invitationId }: { invitationId: string }) => {
          mocks.userInvitations = mocks.userInvitations.filter(
            (invitation) => invitation.id !== invitationId,
          );
          return { data: null, error: null };
        },
      );
    mocks.signIn.mockReset().mockResolvedValue({ error: null });
    mocks.signUp.mockReset().mockResolvedValue({ error: null });
    mocks.resetPassword.mockReset().mockResolvedValue({ error: null });
    mocks.signOut.mockReset().mockResolvedValue({ error: null });
  });

  test("keeps one loading screen mounted while startup advances from session to studio", () => {
    mocks.sessionPending = true;
    const app = renderApp();
    const loadingOrbit = screen.getByTestId("pre-app-loading-orbit");

    mocks.sessionPending = false;
    mocks.organizationsPending = true;
    mocks.session = {
      user: { id: "user-1", name: "Ana Torres", email: "ana@orbit.pe" },
      session: { id: "session-1", activeOrganizationId: "org-1" },
    };
    app.rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false } },
          })
        }
      >
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Preparando tu estudio")).toBeInTheDocument();
    expect(screen.getByTestId("pre-app-loading-orbit")).toBe(loadingOrbit);
  });

  test("keeps the session loader visible while opening a direct invitation", () => {
    mocks.sessionPending = true;

    renderApp("/invitations/invitation-1");

    expect(
      screen.getByRole("status", { name: "Preparando tu sesión" }),
    ).toBeVisible();
  });

  test("keeps anonymous visitors in authentication at onboarding URLs", () => {
    renderApp("/onboarding/organization");

    expect(
      screen.getByRole("heading", { name: "Bienvenido a Orbit" }),
    ).toBeInTheDocument();
  });

  test("renders password reset publicly even when a session exists", async () => {
    mocks.session = {
      user: { id: "user-1", name: "Ana Torres", email: "ana@orbit.pe" },
      session: { id: "session-1", activeOrganizationId: "org-1" },
    };
    renderApp("/reset-password?token=private-reset-token");

    expect(
      screen.getByRole("heading", { name: "Define una nueva contraseña" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Proyectos")).not.toBeInTheDocument();
    expect(screen.queryByText("private-reset-token")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
      target: { value: "new-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
      target: { value: "new-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    await waitFor(() =>
      expect(mocks.resetPassword).toHaveBeenCalledWith({
        newPassword: "new-password",
        token: "private-reset-token",
      }),
    );
    expect(
      await screen.findByText(
        "Contraseña actualizada. Ya puedes iniciar sesión.",
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Bienvenido a Orbit" }),
    ).toBeInTheDocument();
  });

  test("keeps signed-out invitation details private", () => {
    renderApp("/invitations/invitation-1");

    expect(
      screen.getByRole("heading", {
        name: "Tienes una invitación para unirte a un estudio",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.queryByText("Estudio Orbit")).not.toBeInTheDocument();
    expect(mocks.getInvitation).not.toHaveBeenCalled();
  });

  test("shows an authenticated invitation before organization onboarding", async () => {
    mocks.session = {
      user: { id: "user-1", name: "Ana Torres", email: "member@orbit.pe" },
      session: { id: "session-1", activeOrganizationId: null },
    };
    mocks.getInvitation.mockResolvedValue({
      data: {
        id: "invitation-1",
        organizationId: "org-1",
        organizationName: "Estudio Orbit",
        organizationSlug: "orbit",
        email: "member@orbit.pe",
        inviterId: "owner-1",
        inviterEmail: "owner@orbit.pe",
        role: "member",
        status: "pending",
        createdAt: new Date("2026-08-06T12:00:00.000Z"),
        expiresAt: new Date("2026-08-08T12:00:00.000Z"),
      },
      error: null,
    });

    renderApp("/invitations/invitation-1");

    expect(await screen.findByText("Estudio Orbit")).toBeInTheDocument();
    expect(screen.getAllByText("member@orbit.pe")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeEnabled();
    expect(
      screen.queryByLabelText("Nombre del estudio"),
    ).not.toBeInTheDocument();
    expect(mocks.getInvitation).toHaveBeenCalledWith({
      query: { id: "invitation-1" },
    });
    expect(mocks.listUserInvitations).not.toHaveBeenCalled();
  });

  test("routes a user without membership through active invitation decisions", async () => {
    mocks.session = {
      user: { id: "user-1", name: "Ana Torres", email: "member@orbit.pe" },
      session: { id: "session-1", activeOrganizationId: null },
    };
    mocks.userInvitations = [receivedInvitation("invitation-1")];

    renderApp("/onboarding/organization");

    expect(
      await screen.findByRole("heading", { name: "Invitaciones pendientes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("member@orbit.pe")).toBeVisible();
    expect(
      screen.queryByLabelText("Nombre del estudio"),
    ).not.toBeInTheDocument();
    expect(mocks.listUserInvitations).toHaveBeenCalledWith();
  });

  test("does not let an expired invitation block organization creation", async () => {
    mocks.session = {
      user: { id: "user-1", name: "Ana Torres", email: "member@orbit.pe" },
      session: { id: "session-1", activeOrganizationId: null },
    };
    mocks.userInvitations = [
      receivedInvitation(
        "invitation-expired",
        new Date("2000-01-01T00:00:00.000Z"),
      ),
    ];

    renderApp("/onboarding/invitations");

    expect(
      await screen.findByLabelText("Nombre del estudio"),
    ).toBeInTheDocument();
  });

  test("does not expose organization creation when invitation lookup fails", async () => {
    mocks.session = {
      user: { id: "user-1", name: "Ana Torres", email: "member@orbit.pe" },
      session: { id: "session-1", activeOrganizationId: null },
    };
    mocks.listUserInvitations.mockResolvedValue({
      data: null,
      error: { code: "LOOKUP_FAILED" },
    });

    renderApp("/onboarding/organization");

    expect(
      await screen.findByText("No pudimos comprobar tus invitaciones"),
    ).toBeInTheDocument();
    expect(screen.getByText("member@orbit.pe")).toBeVisible();
    expect(
      screen.queryByLabelText("Nombre del estudio"),
    ).not.toBeInTheDocument();
  });

  test("routes to organization creation after rejecting the last invitation", async () => {
    mocks.session = {
      user: { id: "user-1", name: "Ana Torres", email: "member@orbit.pe" },
      session: { id: "session-1", activeOrganizationId: null },
    };
    mocks.userInvitations = [receivedInvitation("invitation-1")];
    renderApp("/onboarding/invitations");

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Rechazar invitación de Estudio Orbit",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar rechazo" }));

    await waitFor(() =>
      expect(mocks.rejectInvitation).toHaveBeenCalledWith({
        invitationId: "invitation-1",
      }),
    );
    expect(
      await screen.findByLabelText("Nombre del estudio"),
    ).toBeInTheDocument();
  });

  test("sends an authenticated user without membership to onboarding", async () => {
    mocks.session = {
      user: { id: "user-1", name: "Ana Torres", email: "ana@orbit.pe" },
      session: { id: "session-1", activeOrganizationId: null },
    };
    renderApp();

    expect(await screen.findByLabelText("Nombre del estudio")).toHaveValue(
      "Estudio de Ana Torres",
    );
    expect(screen.getByText("ana@orbit.pe")).toBeVisible();
  });

  test("signs out from organization onboarding without creating a studio", async () => {
    mocks.session = {
      user: { id: "user-1", name: "Ana Torres", email: "ana@orbit.pe" },
      session: { id: "session-1", activeOrganizationId: null },
    };
    renderApp("/onboarding/organization");

    fireEvent.click(
      await screen.findByRole("button", { name: "Cerrar sesión" }),
    );

    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  test("redirects the authenticated root to Projects", async () => {
    mocks.session = {
      user: { id: "user-1", name: "Ana Torres", email: "ana@orbit.pe" },
      session: { id: "session-1", activeOrganizationId: "org-1" },
    };
    mocks.organizations = [
      {
        id: "org-1",
        name: "Orbit",
        slug: "orbit",
        timeZone: "America/Lima",
      },
    ];
    renderApp();

    expect(
      await screen.findByRole("heading", { name: "Proyectos" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Proyectos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByText("Base técnica")).not.toBeInTheDocument();
    expect(mocks.listUserInvitations).not.toHaveBeenCalled();
  });

  test("renders Projects for an existing member", async () => {
    mocks.session = {
      user: { id: "user-1", name: "Ana Torres", email: "ana@orbit.pe" },
      session: { id: "session-1", activeOrganizationId: "org-1" },
    };
    mocks.organizations = [
      {
        id: "org-1",
        name: "Orbit",
        slug: "orbit",
        timeZone: "America/Lima",
      },
    ];
    renderApp("/projects");

    expect(
      await screen.findByRole("heading", { name: "Proyectos" }),
    ).toBeInTheDocument();
  });

  test("renders Mi trabajo from its authenticated sidebar route", async () => {
    mocks.session = {
      user: { id: "user-1", name: "Ana Torres", email: "ana@orbit.pe" },
      session: { id: "session-1", activeOrganizationId: "org-1" },
    };
    mocks.organizations = [
      { id: "org-1", name: "Orbit", slug: "orbit", timeZone: "America/Lima" },
    ];
    renderApp("/my-work");

    expect(
      await screen.findByRole("heading", { name: "Mi trabajo" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mi trabajo" })).toHaveAttribute(
      "href",
      "/my-work",
    );
  });

  test("renders studio activity from its authenticated sidebar route", async () => {
    mocks.session = {
      user: { id: "user-1", name: "Ana Torres", email: "ana@orbit.pe" },
      session: { id: "session-1", activeOrganizationId: "org-1" },
    };
    mocks.organizations = [
      { id: "org-1", name: "Orbit", slug: "orbit", timeZone: "America/Lima" },
    ];
    renderApp("/activity");

    expect(
      await screen.findByRole("heading", { name: "Actividad" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Actividad" })).toHaveAttribute(
      "href",
      "/activity",
    );
  });

  test("renders one Project detail for an existing member", async () => {
    mocks.session = {
      user: { id: "user-1", name: "Ana Torres", email: "ana@orbit.pe" },
      session: { id: "session-1", activeOrganizationId: "org-1" },
    };
    mocks.organizations = [
      {
        id: "org-1",
        name: "Orbit",
        slug: "orbit",
        timeZone: "America/Lima",
      },
    ];
    renderApp("/projects/project-1");

    expect(
      await screen.findByRole("heading", { name: "Apelación Constructora" }),
    ).toBeInTheDocument();
  });

  test("renders project settings inside authenticated organization routes", async () => {
    mocks.session = {
      user: { id: "user-1", name: "Ana Torres", email: "ana@orbit.pe" },
      session: { id: "session-1", activeOrganizationId: "org-1" },
    };
    mocks.organizations = [
      {
        id: "org-1",
        name: "Orbit",
        slug: "orbit",
        timeZone: "America/Lima",
      },
    ];
    renderApp("/projects/project-1/settings");

    expect(
      await screen.findByRole("heading", {
        name: "Configuración del proyecto",
      }),
    ).toBeInTheDocument();
  });

  test("renders the Team directory for an existing member", async () => {
    mocks.session = {
      user: { id: "user-1", name: "Ana Torres", email: "ana@orbit.pe" },
      session: { id: "session-1", activeOrganizationId: "org-1" },
    };
    mocks.organizations = [
      {
        id: "org-1",
        name: "Orbit",
        slug: "orbit",
        timeZone: "America/Lima",
      },
    ];
    renderApp("/team");

    expect(
      await screen.findByRole("heading", { name: "Equipo" }),
    ).toBeInTheDocument();
  });

  test("renders the current profile inside authenticated organization routes", async () => {
    mocks.session = {
      user: { id: "user-1", name: "Ana Torres", email: "ana@orbit.pe" },
      session: { id: "session-1", activeOrganizationId: "org-1" },
    };
    mocks.organizations = [
      {
        id: "org-1",
        name: "Orbit",
        slug: "orbit",
        timeZone: "America/Lima",
      },
    ];
    renderApp("/profile");

    expect(
      await screen.findByRole("heading", { name: "Tu perfil" }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("AT")).toBeInTheDocument();
  });

  test("renders a member profile inside authenticated organization routes", async () => {
    mocks.session = {
      user: { id: "user-1", name: "Ana Torres", email: "ana@orbit.pe" },
      session: { id: "session-1", activeOrganizationId: "org-1" },
    };
    mocks.organizations = [
      {
        id: "org-1",
        name: "Orbit",
        slug: "orbit",
        timeZone: "America/Lima",
      },
    ];
    renderApp("/team/user-2");

    expect(
      await screen.findByRole("heading", { name: "Perfil de miembro" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Diego Salazar")).toBeInTheDocument();
  });

  test("creates an organization and reaches Projects", async () => {
    mocks.session = {
      user: { id: "user-1", name: "Ana Torres", email: "ana@orbit.pe" },
      session: { id: "session-1", activeOrganizationId: null },
    };
    renderApp("/onboarding/organization");

    fireEvent.click(
      await screen.findByRole("button", { name: "Crear estudio" }),
    );

    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(
      await screen.findByRole("heading", { name: "Proyectos" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Nombre del estudio"),
    ).not.toBeInTheDocument();
  });
});
