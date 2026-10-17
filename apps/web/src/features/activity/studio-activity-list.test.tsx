import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";

import type { DashboardActivityPreview } from "@/lib/api/generated/models";
import { StudioActivityList } from "./studio-activity-list";

const caseActivity: DashboardActivityPreview = {
  id: "activity-1",
  type: "case_assignment.added",
  source: "case",
  actor: {
    userId: "actor-1",
    alias: "CG",
    avatarColor: "#465df5",
    nameSnapshot: "Cristian Granda",
    activeStudioMember: true,
    linkable: true,
  },
  subject: {
    userId: "subject-1",
    alias: "AT",
    avatarColor: "#0d9488",
    nameSnapshot: "Ana Torres",
    activeStudioMember: true,
    linkable: true,
  },
  details: { assignmentId: "assignment-1" },
  createdAt: "2026-09-02T15:00:00.000Z",
  project: null,
  case: {
    id: "case-1",
    identification: "Caso de prueba",
    status: "in_progress",
    archivedAt: null,
  },
};

describe("StudioActivityList", () => {
  test("renders case activity with the same linked identity and status treatment", () => {
    render(
      <MemoryRouter>
        <StudioActivityList
          activities={[caseActivity]}
          timeZone="America/Lima"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /CG/i })).toHaveAttribute(
      "href",
      "/team/actor-1",
    );
    expect(screen.getByRole("link", { name: /AT/i })).toHaveAttribute(
      "href",
      "/team/subject-1",
    );
    expect(
      screen.getByRole("link", { name: "Caso de prueba" }),
    ).toHaveAttribute("href", "/cases/case-1");
    expect(screen.getByText("En trámite")).toHaveAttribute(
      "data-case-status",
      "in_progress",
    );
  });

  test("renders structured case updates without nesting them in a paragraph", () => {
    render(
      <MemoryRouter>
        <StudioActivityList
          activities={[
            {
              ...caseActivity,
              type: "case.updated",
              details: {
                previousType: "administrative",
                newType: "judicial",
                previousEntity: "sunat",
                newEntity: "judiciary",
              },
            },
          ]}
          timeZone="America/Lima"
        />
      </MemoryRouter>,
    );

    const update = screen.getByRole("group", {
      name: "Actualización del caso: 2 cambios",
    });
    expect(update.closest("p")).toBeNull();
  });
});
