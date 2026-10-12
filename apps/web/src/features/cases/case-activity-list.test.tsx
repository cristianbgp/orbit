import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";

import { OrganizationCalendarProvider } from "@/features/organization/organization-calendar-context";
import { CaseActivityList } from "./case-activity-list";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useInfiniteQuery: () => ({
      data: {
        pages: [
          {
            activities: [
              {
                id: "activity-1",
                type: "case.updated",
                actor: {
                  userId: "user-1",
                  nameSnapshot: "Ana Torres",
                  alias: "AT",
                  avatarColor: null,
                  activeStudioMember: true,
                  linkable: true,
                },
                subject: null,
                details: {
                  previousEntity: "sunat",
                  newEntity: "tax_court",
                },
                createdAt: "2026-09-02T02:00:00.000Z",
              },
            ],
            pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
          },
        ],
      },
      isPending: false,
      isError: false,
      isFetchingNextPage: false,
      isFetchNextPageError: false,
      hasNextPage: false,
    }),
  };
});

describe("CaseActivityList", () => {
  test("uses the rich case message and the studio timezone", () => {
    render(
      <MemoryRouter>
        <OrganizationCalendarProvider
          timeZone="America/New_York"
          now={new Date("2026-09-02T12:00:00.000Z")}
        >
          <CaseActivityList caseId="case-1" />
        </OrganizationCalendarProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/cambió la entidad/i).parentElement,
    ).toHaveTextContent(/SUNAT.*Tribunal Fiscal/);
    expect(
      screen.getByText("Cambios del caso registrados automáticamente."),
    ).toBeVisible();
    expect(
      document.querySelector('[data-slot="case-activity-timeline-marker"]'),
    ).toBeInTheDocument();
    expect(screen.getByRole("time")).toHaveTextContent(/1 set.*10:00 p/i);
  });
});
