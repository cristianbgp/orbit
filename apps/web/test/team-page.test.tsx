import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { TeamPage } from "@/features/team/team-page";

Element.prototype.scrollIntoView = vi.fn();

const owner = {
  memberId: "member-owner",
  userId: "user-owner",
  alias: "AT",
  name: "Ana Torres",
  email: "ana@orbit.pe",
  image: null,
  role: "owner",
  position: null,
  memberSince: "2026-08-01T10:00:00.000Z",
  isCurrentUser: true,
};

const pendingInvitation = {
  id: "invitation-1",
  email: "nuevo@orbit.pe",
  role: "member" as const,
  position: "junior" as const,
  status: "pending" as const,
  createdAt: "2026-08-14T10:00:00.000Z",
  expiresAt: "2099-08-16T10:00:00.000Z",
};

const mocks = vi.hoisted(() => ({
  listMembersQuery: vi.fn(),
  removeMember: vi.fn(),
  updateMemberPosition: vi.fn(),
  createRecoveryLink: vi.fn(),
  resetRecoveryLink: vi.fn(),
  invitationHook: vi.fn(),
  member: {
    data: { role: "member" } as null | { role: string },
    isPending: false,
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useActiveMember: () => mocks.member,
  },
}));

vi.mock("@/lib/api/generated/team/team", () => ({
  getGetTeamMemberQueryKey: (userId: string) => [`/api/team/users/${userId}`],
  getListTeamMembersQueryKey: () => ["/api/team/members"],
  getListPendingTeamInvitationsQueryKey: () => ["/api/team/invitations"],
  useListTeamMembers: (params: unknown, options: unknown) =>
    mocks.listMembersQuery(params, options),
  useListPendingTeamInvitations: (options: unknown) =>
    mocks.invitationHook(options),
  useRemoveTeamMember: () => ({
    mutateAsync: mocks.removeMember,
    isPending: false,
  }),
  useUpdateTeamMemberPosition: () => ({
    mutateAsync: mocks.updateMemberPosition,
    isPending: false,
  }),
  useCreateMemberPasswordRecoveryLink: () => ({
    mutateAsync: mocks.createRecoveryLink,
    reset: mocks.resetRecoveryLink,
  }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TeamPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, invalidate };
}

describe("TeamPage", () => {
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    mocks.member.data = { role: "member" };
    mocks.member.isPending = false;
    mocks.listMembersQuery.mockReset().mockReturnValue({
      data: {
        members: [owner],
        pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
    });
    mocks.removeMember
      .mockReset()
      .mockResolvedValue({ member: { id: "member-2" } });
    mocks.updateMemberPosition.mockReset().mockResolvedValue({
      member: { ...owner, position: "partner" },
    });
    mocks.createRecoveryLink.mockReset().mockResolvedValue({
      url: "https://app.orbit.pe/reset-password?token=secret",
      expiresAt: "2026-08-18T15:30:00.000Z",
    });
    mocks.resetRecoveryLink.mockReset();
    mocks.invitationHook.mockReset().mockReturnValue({
      data: { invitations: [] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  test("uses the shared application page frame", async () => {
    renderPage();

    const heading = await screen.findByRole("heading", { name: "Equipo" });
    expect(heading.closest('[data-slot="app-page"]')).toHaveClass(
      "max-w-384",
      "py-6",
      "lg:py-8",
    );
    expect(
      heading
        .closest('[data-slot="app-page-header"]')
        ?.querySelector("svg.lucide-users"),
    ).toHaveAttribute("aria-hidden", "true");
    expect(
      heading.closest('[data-slot="app-page-header"]')?.nextElementSibling,
    ).toHaveAttribute("data-slot", "app-page-content");
  });

  test("loads the active team for every member", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Equipo" }),
    ).toBeInTheDocument();
    expect((await screen.findAllByText("AT")).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Ana Torres/ })).toHaveAttribute(
      "href",
      "/team/user-owner",
    );
    expect(mocks.listMembersQuery).toHaveBeenCalledWith(
      { page: 1, pageSize: 25 },
      { query: { placeholderData: expect.any(Function) } },
    );
    expect(
      screen.queryByRole("button", { name: "Invitar miembro" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(4);
  });

  test("offers retry after member listing fails", async () => {
    const refetch = vi.fn();
    mocks.listMembersQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      isPlaceholderData: false,
      refetch,
    });
    renderPage();

    expect(
      await screen.findByText("No pudimos cargar el equipo"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  test("requests the next page when the member total requires it", async () => {
    mocks.listMembersQuery.mockImplementation((params: { page: number }) => ({
      data: {
        members: [owner],
        pagination: {
          page: params.page,
          pageSize: 25,
          total: 26,
          totalPages: 2,
        },
      },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
    }));
    renderPage();

    await screen.findAllByText("AT");
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    await waitFor(() =>
      expect(mocks.listMembersQuery).toHaveBeenLastCalledWith(
        { page: 2, pageSize: 25 },
        { query: { placeholderData: expect.any(Function) } },
      ),
    );
  });

  test("enables pending invitations only for owners", async () => {
    mocks.member.data = { role: "owner" };
    renderPage();

    expect(
      await screen.findByRole("button", { name: "Invitar miembro" }),
    ).toBeInTheDocument();
    expect(mocks.invitationHook).toHaveBeenCalledWith({
      query: { enabled: true },
    });
  });

  test("lets only owners open member password recovery", async () => {
    const ordinaryView = renderPage();
    expect(
      screen.queryByRole("button", {
        name: "Generar enlace de recuperación de Ana Torres",
      }),
    ).not.toBeInTheDocument();
    ordinaryView.unmount();

    mocks.member.data = { role: "owner" };
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Generar enlace de recuperación de Ana Torres",
      }),
    );

    expect(
      screen.getByRole("dialog", { name: "Recuperar acceso" }),
    ).toBeVisible();
    expect(mocks.createRecoveryLink).not.toHaveBeenCalled();
  });

  test("gives owners member and invitation tabs plus an invitation sheet", async () => {
    mocks.member.data = { role: "owner" };
    mocks.invitationHook.mockReturnValue({
      data: { invitations: [pendingInvitation] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();

    expect(
      await screen.findByRole("tab", { name: /Miembros 1/ }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Invitaciones 1/ })).toBeVisible();
    const invitationTab = screen.getByRole("tab", { name: /Invitaciones 1/ });
    fireEvent.mouseDown(invitationTab, { button: 0, ctrlKey: false });
    expect(await screen.findByText("nuevo@orbit.pe")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Invitar miembro" }));
    expect(
      screen.getByRole("dialog", { name: "Invitar a un miembro" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Correo del nuevo miembro")).toBeVisible();
  });

  test("debounces member search and applies the position filter", async () => {
    vi.useFakeTimers();
    mocks.member.data = { role: "owner" };
    renderPage();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar miembros" }),
      {
        target: { value: "  diego  " },
      },
    );
    expect(mocks.listMembersQuery).toHaveBeenLastCalledWith(
      { page: 1, pageSize: 25 },
      expect.anything(),
    );
    await act(async () => vi.advanceTimersByTime(300));
    expect(mocks.listMembersQuery).toHaveBeenLastCalledWith(
      { page: 1, pageSize: 25, q: "diego" },
      expect.anything(),
    );

    fireEvent.click(
      screen.getByRole("combobox", { name: "Filtrar por posición" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Senior" }));
    expect(mocks.listMembersQuery).toHaveBeenLastCalledWith(
      { page: 1, pageSize: 25, q: "diego", position: "senior" },
      expect.anything(),
    );
    vi.useRealTimers();
  });

  test("keeps invitation requests disabled for ordinary members", async () => {
    renderPage();

    await screen.findAllByText("AT");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(mocks.invitationHook).toHaveBeenCalledWith({
      query: { enabled: false },
    });
  });

  test("resets pagination when a position filter changes", async () => {
    mocks.member.data = { role: "owner" };
    mocks.listMembersQuery.mockImplementation((params: { page: number }) => ({
      data: {
        members: [owner],
        pagination: {
          page: params.page,
          pageSize: 25,
          total: 26,
          totalPages: 2,
        },
      },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
    }));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() =>
      expect(mocks.listMembersQuery).toHaveBeenLastCalledWith(
        { page: 2, pageSize: 25 },
        expect.anything(),
      ),
    );
    fireEvent.click(
      screen.getByRole("combobox", { name: "Filtrar por posición" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Junior" }));
    expect(mocks.listMembersQuery).toHaveBeenLastCalledWith(
      { page: 1, pageSize: 25, position: "junior" },
      expect.anything(),
    );
  });

  test("distinguishes filtered results from a truly empty studio", async () => {
    vi.useFakeTimers();
    mocks.listMembersQuery.mockReturnValue({
      data: {
        members: [],
        pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
      },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
    });
    renderPage();

    expect(screen.getByText("Aún no hay miembros para mostrar")).toBeVisible();
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar miembros" }),
      {
        target: { value: "nadie" },
      },
    );
    await act(async () => vi.advanceTimersByTime(300));
    expect(screen.getByText("No encontramos miembros")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(
      screen.getByRole("searchbox", { name: "Buscar miembros" }),
    ).toHaveValue("");
  });

  test("uses the Orbit removal endpoint and invalidates team and project data", async () => {
    mocks.member.data = { role: "owner" };
    mocks.listMembersQuery.mockReturnValue({
      data: {
        members: [
          owner,
          {
            ...owner,
            memberId: "member-2",
            userId: "user-2",
            alias: "Didi",
            role: "member",
            name: "Diego Salazar",
            email: "diego@orbit.pe",
            isCurrentUser: false,
          },
        ],
        pagination: { page: 1, pageSize: 25, total: 2, totalPages: 1 },
      },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
    });
    const { invalidate } = renderPage();

    await screen.findAllByText("Didi");
    fireEvent.click(
      screen.getByRole("button", { name: "Quitar a Diego Salazar" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar retiro" }));

    await waitFor(() =>
      expect(mocks.removeMember).toHaveBeenCalledWith({ memberId: "member-2" }),
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/team/members"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/team/users/user-2"],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["/api/projects"] });
  });

  test("updates a member position and invalidates list and profile", async () => {
    mocks.member.data = { role: "owner" };
    mocks.listMembersQuery.mockReturnValue({
      data: {
        members: [
          owner,
          {
            ...owner,
            memberId: "member-2",
            userId: "user-2",
            alias: "Didi",
            role: "member",
            position: "junior",
            name: "Diego Salazar",
            email: "diego@orbit.pe",
            isCurrentUser: false,
          },
        ],
        pagination: { page: 1, pageSize: 25, total: 2, totalPages: 1 },
      },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
    });
    const { invalidate } = renderPage();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Cambiar posición de Diego Salazar",
      }),
    );
    fireEvent.click(
      screen.getByRole("combobox", { name: "Posición de Diego Salazar" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Senior" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar posición" }));

    await waitFor(() =>
      expect(mocks.updateMemberPosition).toHaveBeenCalledWith({
        memberId: "member-2",
        data: { position: "senior" },
      }),
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/team/members"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/team/users/user-2"],
    });
  });
});
