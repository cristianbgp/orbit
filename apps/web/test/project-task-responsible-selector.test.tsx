import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ProjectTaskResponsibleSelector } from "@/features/projects/project-task-responsible-selector";
import type { ProjectAssignment } from "@/lib/api/generated/models";

const assignments: ProjectAssignment[] = [
  {
    id: "project-assignment-1",
    userId: "user-2",
    userName: "Luis Ramos",
    userEmail: "luis@orbit.pe",
    userAlias: "LR",
    userAvatarColor: "#11182b",
    activeStudioMember: true,
    responsibility: "responsible",
    assignedByUserId: "user-1",
    assignedByName: "Ana Torres",
    assignedAt: "2026-08-06T20:00:00.000Z",
    endedAt: null,
    endedByUserId: null,
    endedByName: null,
    endReason: null,
  },
  {
    id: "project-assignment-2",
    userId: "user-3",
    userName: "María Solís",
    userEmail: "maria@orbit.pe",
    userAlias: "MS",
    userAvatarColor: "#4657d9",
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

describe("ProjectTaskResponsibleSelector", () => {
  test("selects zero or several active project members", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ProjectTaskResponsibleSelector
        assignments={assignments}
        selectedUserIds={[]}
        onChange={onChange}
      />,
    );

    expect(screen.getAllByText("LR").length).toBeGreaterThan(0);
    expect(screen.getByText("luis@orbit.pe")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Luis Ramos" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      screen
        .getAllByText("LR")
        .every((element) => !element.closest("[tabindex]")),
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "LR, Luis Ramos, luis@orbit.pe",
      }),
    );
    expect(onChange).toHaveBeenCalledWith(["user-2"]);

    rerender(
      <ProjectTaskResponsibleSelector
        assignments={assignments}
        selectedUserIds={["user-2"]}
        onChange={onChange}
      />,
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "MS, María Solís, maria@orbit.pe",
      }),
    );
    expect(onChange).toHaveBeenLastCalledWith(["user-2", "user-3"]);
  });

  test("does not render former project assignments", () => {
    render(
      <ProjectTaskResponsibleSelector
        assignments={[
          ...assignments,
          {
            ...assignments[0],
            id: "former",
            userId: "user-4",
            userName: "José Vega",
            endedAt: "2026-08-07T10:00:00.000Z",
          },
        ]}
        selectedUserIds={[]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByText("José Vega")).not.toBeInTheDocument();
  });
});
