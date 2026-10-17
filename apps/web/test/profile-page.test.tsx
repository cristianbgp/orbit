import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ProfilePage } from "@/features/identity/profile-page";
import { ApiClientError } from "@/lib/api/fetcher";
import { getGetCurrentUserQueryKey } from "@/lib/api/generated/identity/identity";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  updatePending: false,
  getMember: vi.fn(),
  currentUser: {
    data: {
      user: {
        id: "user-1",
        alias: "CGP",
        avatarColor: "#11182b",
        name: "Cristian Granda",
        email: "cristian@orbit.pe",
        image: null,
        createdAt: "2026-08-01T10:00:00.000Z",
      },
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  member: {
    data: {
      member: {
        memberId: "member-1",
        userId: "user-1",
        alias: "CGP",
        avatarColor: "#11182b",
        name: "Cristian Granda",
        email: "cristian@orbit.pe",
        image: null,
        role: "owner",
        position: null,
        memberSince: "2026-08-01T10:00:00.000Z",
        isCurrentUser: true,
      },
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
}));

vi.mock("@/lib/api/generated/identity/identity", () => ({
  getGetCurrentUserQueryKey: () => ["/api/me"],
  useGetCurrentUser: () => mocks.currentUser,
  useUpdateCurrentUser: () => ({
    mutateAsync: mocks.update,
    isPending: mocks.updatePending,
  }),
}));

vi.mock("@/lib/api/generated/team/team", () => ({
  useGetTeamMember: (...args: unknown[]) => mocks.getMember(...args),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(getGetCurrentUserQueryKey(), mocks.currentUser.data);
  queryClient.setQueryData(["/api/team/users/user-1"], mocks.member.data);
  queryClient.setQueryData(["/api/projects/project-1"], { project: {} });
  queryClient.setQueryData(["/api/clients"], { clients: [] });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { ...view, queryClient };
}

describe("ProfilePage", () => {
  beforeEach(() => {
    mocks.update.mockReset().mockResolvedValue(mocks.currentUser.data);
    mocks.updatePending = false;
    mocks.currentUser.isPending = false;
    mocks.currentUser.isError = false;
    mocks.currentUser.refetch.mockReset();
    mocks.member.refetch.mockReset();
    mocks.getMember.mockReset().mockReturnValue(mocks.member);
  });

  test("shows current identity, accessible color choices, and studio membership", () => {
    renderPage();

    const heading = screen.getByRole("heading", { name: "Tu perfil" });
    expect(heading).toBeInTheDocument();
    expect(heading.closest('[data-slot="app-page"]')).toHaveClass(
      "max-w-384",
      "py-6",
      "lg:py-8",
    );
    expect(heading).toHaveClass("font-display", "text-3xl", "sm:text-4xl");
    expect(
      heading
        .closest('[data-slot="app-page-header"]')
        ?.querySelector("svg.lucide-user-round"),
    ).toHaveAttribute("aria-hidden", "true");
    expect(
      heading.closest('[data-slot="app-page-header"]')?.nextElementSibling,
    ).toHaveAttribute("data-slot", "app-page-content");
    expect(screen.getByDisplayValue("CGP")).toBeInTheDocument();
    expect(screen.getByText("Cristian Granda")).toBeInTheDocument();
    expect(screen.getAllByText("cristian@orbit.pe")).not.toHaveLength(0);
    expect(screen.getByText("Propietario")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Información en el estudio" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sin posición")).toBeInTheDocument();
    expect(screen.getByText("1 de agosto de 2026")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByLabelText("Nombre completo")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Correo electrónico"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar perfil" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("radiogroup", { name: "Color del avatar" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Grafito" })).toBeChecked();
  });

  test("keeps loading and error states in the shared application frame", () => {
    mocks.currentUser.isPending = true;
    const loadingView = renderPage();

    expect(
      screen
        .getByLabelText("Cargando tu perfil")
        .closest('[data-slot="app-page"]'),
    ).toHaveClass("max-w-384");

    loadingView.unmount();
    mocks.currentUser.isPending = false;
    mocks.currentUser.isError = true;
    renderPage();

    expect(
      screen
        .getByRole("heading", { name: "No pudimos cargar tu perfil" })
        .closest('[data-slot="app-page"]'),
    ).toHaveClass("max-w-384");
  });

  test("updates the trimmed alias and invalidates every identity presentation", async () => {
    const { queryClient } = renderPage();

    fireEvent.change(screen.getByLabelText("Alias"), {
      target: { value: "  CRIS  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar perfil" }));

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        data: { alias: "CRIS", avatarColor: "#11182b" },
      }),
    );
    await waitFor(() => {
      expect(
        queryClient.getQueryState(getGetCurrentUserQueryKey())?.isInvalidated,
      ).toBe(true);
      expect(
        queryClient.getQueryState(["/api/team/users/user-1"])?.isInvalidated,
      ).toBe(true);
      expect(
        queryClient.getQueryState(["/api/projects/project-1"])?.isInvalidated,
      ).toBe(true);
    });
    expect(queryClient.getQueryState(["/api/clients"])?.isInvalidated).toBe(
      false,
    );
    expect(
      screen.getByRole("button", { name: "Guardar perfil" }),
    ).toBeDisabled();
    expect(mocks.getMember).toHaveBeenCalledWith("user-1", {
      query: { enabled: true },
    });
  });

  test("keeps the entered alias and maps API validation failures", async () => {
    mocks.update.mockRejectedValue({
      error: { code: "VALIDATION_ERROR", message: "Invalid alias" },
    });
    renderPage();

    fireEvent.change(screen.getByLabelText("Alias"), {
      target: { value: "alias con espacios" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar perfil" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El alias debe tener entre 2 y 12 letras o números, sin espacios.",
    );
    expect(screen.getByLabelText("Alias")).toHaveValue("alias con espacios");
    expect(screen.getByLabelText("Alias")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("keeps input valid and intact after a request failure", async () => {
    mocks.update.mockRejectedValue(
      new ApiClientError("Network unavailable", {
        kind: "network",
        retryable: true,
      }),
    );
    renderPage();

    fireEvent.change(screen.getByLabelText("Alias"), {
      target: { value: "NuevoAlias" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar perfil" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos actualizar tu perfil. Inténtalo nuevamente.",
    );
    expect(screen.getByLabelText("Alias")).toHaveValue("NuevoAlias");
    expect(screen.getByLabelText("Alias")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
  });

  test("disables saving and announces progress while a request is pending", () => {
    mocks.updatePending = true;
    renderPage();

    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
  });

  test("prevents duplicate submissions while the first request is unresolved", () => {
    mocks.update.mockReturnValue(new Promise(() => {}));
    renderPage();

    fireEvent.change(screen.getByLabelText("Alias"), {
      target: { value: "CRIS" },
    });
    const save = screen.getByRole("button", { name: "Guardar perfil" });
    fireEvent.click(save);
    fireEvent.click(save);

    expect(mocks.update).toHaveBeenCalledOnce();
  });

  test("previews and saves an approved avatar color with the alias", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("radio", { name: "Verde azulado" }));

    expect(screen.getByRole("img", { name: "Cristian Granda" })).toHaveStyle({
      backgroundColor: "#0f766e",
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar perfil" }));

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        data: { alias: "CGP", avatarColor: "#0f766e" },
      }),
    );
    expect(screen.getByText("Perfil actualizado.")).toBeInTheDocument();
  });
});
