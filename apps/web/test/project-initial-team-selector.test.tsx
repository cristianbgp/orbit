import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  ProjectInitialTeamSelector,
  type InitialTeamSelection,
} from "@/features/projects/project-initial-team-selector";

Element.prototype.scrollIntoView = vi.fn();
vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const member = {
  memberId: "member-2",
  userId: "user-2",
  alias: "LR",
  avatarColor: "#11182b",
  name: "Luis Ramos",
  email: "luis@orbit.pe",
  image: null,
  role: "member",
  position: "senior" as const,
  memberSince: "2026-08-06T10:00:00.000Z",
  isCurrentUser: false,
};

const mocks = vi.hoisted(() => ({
  params: undefined as unknown,
  query: {
    data: undefined as
      | undefined
      | {
          members: (typeof member)[];
          pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
          };
        },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
}));

vi.mock("@/lib/api/generated/team/team", () => ({
  useListTeamMembers: (params: unknown) => {
    mocks.params = params;
    return mocks.query;
  },
}));

function Harness() {
  const [value, setValue] = useState<InitialTeamSelection[]>([]);
  return <ProjectInitialTeamSelector value={value} onChange={setValue} />;
}

describe("ProjectInitialTeamSelector", () => {
  beforeEach(() => {
    mocks.query.data = {
      members: [member],
      pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    };
    mocks.query.isPending = false;
    mocks.query.isError = false;
    mocks.query.refetch.mockReset();
  });

  test("selects members and lets each one become a supervisor", () => {
    render(<Harness />);

    expect(mocks.params).toEqual({ page: 1, pageSize: 100 });
    fireEvent.click(
      screen.getByRole("combobox", { name: "Añadir integrantes al proyecto" }),
    );
    fireEvent.click(screen.getByRole("option"));

    expect(screen.getByText("1 integrante")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("combobox", { name: "Rol de Luis Ramos" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Supervisor" }));
    expect(
      screen.getByRole("combobox", { name: "Rol de Luis Ramos" }),
    ).toHaveTextContent("Supervisor");

    fireEvent.click(
      screen.getByRole("button", { name: "Quitar a Luis Ramos" }),
    );
    expect(screen.getByText("Añadir integrantes")).toBeInTheDocument();
  });
});
