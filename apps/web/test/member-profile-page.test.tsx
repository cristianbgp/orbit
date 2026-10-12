import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { MemberProfilePage } from "@/features/identity/member-profile-page";
import { ApiClientError } from "@/lib/api/fetcher";

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  getMember: vi.fn(),
  state: {
    data: {
      member: {
        memberId: "member-2",
        userId: "user-2",
        alias: "DS",
        name: "Diego Salazar",
        email: "diego@orbit.pe",
        image: null,
        role: "member",
        position: "senior",
        memberSince: "2026-08-05T10:00:00.000Z",
        isCurrentUser: false,
      },
    } as
      | {
          member: {
            memberId: string;
            userId: string;
            alias: string;
            name: string;
            email: string;
            image: null;
            role: string;
            position:
              "partner" | "senior" | "junior" | "assistant" | "intern" | null;
            memberSince: string;
            isCurrentUser: boolean;
          };
        }
      | undefined,
    isPending: false,
    isError: false,
    error: null as unknown,
  },
}));

vi.mock("@/lib/api/generated/team/team", () => ({
  useGetTeamMember: (...args: unknown[]) => mocks.getMember(...args),
}));

function renderPage(path = "/team/user-2") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/team/:userId" element={<MemberProfilePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MemberProfilePage", () => {
  beforeEach(() => {
    mocks.refetch.mockReset();
    mocks.getMember.mockImplementation(() => ({
      ...mocks.state,
      refetch: mocks.refetch,
    }));
    mocks.state.data = {
      member: {
        memberId: "member-2",
        userId: "user-2",
        alias: "DS",
        name: "Diego Salazar",
        email: "diego@orbit.pe",
        image: null,
        role: "member",
        position: "senior",
        memberSince: "2026-08-05T10:00:00.000Z",
        isCurrentUser: false,
      },
    };
    mocks.state.isPending = false;
    mocks.state.isError = false;
    mocks.state.error = null;
  });

  test("shows read-only identity and studio membership facts", () => {
    renderPage();

    const heading = screen.getByRole("heading", {
      name: "Perfil de miembro",
    });
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
        ?.querySelector("svg.lucide-users"),
    ).toHaveAttribute("aria-hidden", "true");
    expect(
      heading.closest('[data-slot="app-page-header"]')?.nextElementSibling,
    ).toHaveAttribute("data-slot", "app-page-content");
    expect(screen.getAllByText("DS")).not.toHaveLength(0);
    expect(screen.getByText("Diego Salazar")).toBeInTheDocument();
    expect(screen.getByText("diego@orbit.pe")).toBeInTheDocument();
    expect(screen.getAllByText("Miembro")).not.toHaveLength(0);
    expect(screen.getByText("Información en el estudio")).toBeInTheDocument();
    expect(screen.getByText("Senior")).toBeInTheDocument();
    expect(screen.getByText("5 de agosto de 2026")).toBeInTheDocument();
    expect(screen.getByLabelText("Diego Salazar")).toHaveTextContent("DS");
    expect(mocks.getMember).toHaveBeenCalledWith("user-2", {
      query: { enabled: true },
    });
  });

  test("shows a nullable legacy membership without inventing a position", () => {
    if (mocks.state.data) mocks.state.data.member.position = null;
    renderPage();

    expect(screen.getByText("Sin posición")).toBeInTheDocument();
  });

  test("identifies the current user and links to the editable profile", () => {
    if (mocks.state.data) mocks.state.data.member.isCurrentUser = true;
    renderPage();

    expect(screen.getByText("Este eres tú")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Editar tu perfil" }),
    ).toHaveAttribute("href", "/profile");
  });

  test("keeps the loading state inside the page", () => {
    mocks.state.data = undefined;
    mocks.state.isPending = true;
    renderPage();

    expect(
      screen
        .getByLabelText("Cargando perfil de miembro")
        .closest('[data-slot="app-page"]'),
    ).toHaveClass("max-w-384");
  });

  test("shows a stable unavailable state without retrying tenant-safe 404s", () => {
    mocks.state.data = undefined;
    mocks.state.isError = true;
    mocks.state.error = new ApiClientError("Not found", {
      kind: "http",
      status: 404,
      retryable: false,
    });

    renderPage();

    expect(
      screen
        .getByRole("heading", { name: "Perfil no disponible" })
        .closest('[data-slot="app-page"]'),
    ).toHaveClass("max-w-384");
    expect(
      screen.getByText("Este perfil no está disponible en tu estudio."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Intentar de nuevo" }),
    ).not.toBeInTheDocument();
  });

  test("offers retry for transient server failures", () => {
    mocks.state.data = undefined;
    mocks.state.isError = true;
    mocks.state.error = new ApiClientError("Server error", {
      kind: "http",
      status: 503,
      retryable: true,
    });

    renderPage();

    expect(
      screen
        .getByRole("heading", { name: "No pudimos cargar el perfil" })
        .closest('[data-slot="app-page"]'),
    ).toHaveClass("max-w-384");
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
});
