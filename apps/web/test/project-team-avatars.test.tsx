import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, test, vi } from "vitest";

import { ProjectTeamAvatars } from "@/features/projects/project-team-avatars";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

describe("ProjectTeamAvatars", () => {
  test("groups active members by position and exposes their role", async () => {
    render(
      <MemoryRouter>
        <ProjectTeamAvatars
          projectName="Apelación Constructora"
          team={{
            members: [
              {
                userId: "user-1",
                fullName: "Cristian Granda",
                alias: "CG",
                avatarColor: "#4657d9",
                responsibility: "responsible",
                position: "partner",
              },
              {
                userId: "user-2",
                fullName: "Ana Mendoza",
                alias: "AM",
                avatarColor: "#0f766e",
                responsibility: "member",
                position: "junior",
              },
            ],
            total: 2,
          }}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByLabelText("Equipo de Apelación Constructora"),
    ).toBeInTheDocument();
    const supervisor = screen.getByRole("link", {
      name: "CG, Cristian Granda, Socio, Supervisor",
    });
    expect(supervisor).toHaveAttribute("href", "/team/user-1");
    expect(screen.getByRole("img", { name: "Cristian Granda" })).toHaveClass(
      "size-7",
      "text-[0.625rem]",
    );
    expect(
      screen.getByRole("img", { name: "Cristian Granda" }),
    ).not.toHaveClass("size-9");
    expect(screen.getByText("Socio")).toBeVisible();
    expect(screen.getByText("Junior")).toBeVisible();

    fireEvent.focus(supervisor);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "CG · Cristian Granda · Socio · Supervisor",
    );
  });

  test("states clearly when a project has no active team", () => {
    render(
      <MemoryRouter>
        <ProjectTeamAvatars
          projectName="Consulta"
          team={{ members: [], total: 0 }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Sin equipo")).toBeVisible();
  });
});
