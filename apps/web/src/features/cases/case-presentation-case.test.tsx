import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { CasePresentationCase } from "./case-presentation-case";

const { mutation } = vi.hoisted(() => ({
  mutation: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock("@/lib/api/generated/case-actions/case-actions", async (original) => ({
  ...(await original<
    typeof import("@/lib/api/generated/case-actions/case-actions")
  >()),
  useCreateCaseAction: mutation,
  useUpdateCaseAction: mutation,
  useCompleteCaseAction: mutation,
  useReopenCaseAction: mutation,
}));
vi.mock("@/lib/api/generated/case-events/case-events", async (original) => ({
  ...(await original<
    typeof import("@/lib/api/generated/case-events/case-events")
  >()),
  useCreateCaseEvent: mutation,
  useUpdateCaseEvent: mutation,
}));
vi.mock("@/lib/api/generated/case-updates/case-updates", async (original) => ({
  ...(await original<
    typeof import("@/lib/api/generated/case-updates/case-updates")
  >()),
  useCreateCaseUpdate: mutation,
  useUpdateCaseUpdate: mutation,
}));
vi.mock("./case-action-sheet", () => ({ CaseActionSheet: () => null }));
vi.mock("./case-update-sheet", () => ({ CaseUpdateSheet: () => null }));
vi.mock("./case-event-sheet", () => ({ CaseEventSheet: () => null }));
vi.mock("./case-edit-sheet", () => ({
  CaseEditSheet: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">Editor general del caso</div> : null,
}));

const item = {
  id: "case-1",
  identification: "Caso tributario",
  status: "in_progress" as const,
  result: null,
  type: "judicial" as const,
  stage: "judicial_first_instance" as const,
  docketNumber: "EXP-001",
  periodKind: "year" as const,
  periodStart: "2026-01-01",
  periodEnd: "2026-12-01",
  team: [],
  followers: [],
  updates: [],
  backgrounds: [
    {
      id: "background-1",
      caseId: "case-1",
      date: "2026-09-03",
      description: "Primer antecedente",
      kind: "background" as const,
      creator: {
        userId: "user-1",
        fullName: "Ana",
        alias: "AN",
        avatarColor: null,
        activeStudioMember: true,
        linkable: true,
      },
      createdAt: "2026-09-03T12:00:00.000Z",
      updatedAt: "2026-09-03T12:00:00.000Z",
      archivedAt: null,
    },
    {
      id: "background-2",
      caseId: "case-1",
      date: "2026-09-02",
      description: "Segundo antecedente",
      kind: "background" as const,
      creator: {
        userId: "user-1",
        fullName: "Ana",
        alias: "AN",
        avatarColor: null,
        activeStudioMember: true,
        linkable: true,
      },
      createdAt: "2026-09-02T12:00:00.000Z",
      updatedAt: "2026-09-02T12:00:00.000Z",
      archivedAt: null,
    },
    {
      id: "background-3",
      caseId: "case-1",
      date: "2026-09-01",
      description: "Tercer antecedente",
      kind: "background" as const,
      creator: {
        userId: "user-1",
        fullName: "Ana",
        alias: "AN",
        avatarColor: null,
        activeStudioMember: true,
        linkable: true,
      },
      createdAt: "2026-09-01T12:00:00.000Z",
      updatedAt: "2026-09-01T12:00:00.000Z",
      archivedAt: null,
    },
    {
      id: "background-4",
      caseId: "case-1",
      date: "2026-08-31",
      description: "Cuarto antecedente",
      kind: "background" as const,
      creator: {
        userId: "user-1",
        fullName: "Ana",
        alias: "AN",
        avatarColor: null,
        activeStudioMember: true,
        linkable: true,
      },
      createdAt: "2026-08-31T12:00:00.000Z",
      updatedAt: "2026-08-31T12:00:00.000Z",
      archivedAt: null,
    },
  ],
  actions: [],
  events: [],
};

describe("CasePresentationCase", () => {
  beforeEach(() => vi.clearAllMocks());

  test("edits the case in a sheet without leaving the presentation", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <CasePresentationCase
            item={item}
            clientName="Cliente Andes"
            organizationDate="2026-09-04"
            open
            onOpenChange={vi.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Editar caso" }));

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Editor general del caso",
    );
    expect(
      screen.queryByRole("link", { name: /Configurar caso/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Eventos.*0/ })).toBeVisible();
    expect(
      screen.getByText(/informes orales, entrevistas u otros eventos/i),
    ).toBeVisible();
  });

  test("shows the three latest backgrounds and expands the complete history", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <CasePresentationCase
            item={item}
            clientName="Cliente Andes"
            organizationDate="2026-09-04"
            open
            onOpenChange={vi.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Antecedentes · 4")).toBeVisible();
    expect(screen.getByText("Primer antecedente")).toBeVisible();
    expect(screen.getByText("Segundo antecedente")).toBeVisible();
    expect(screen.getByText("Tercer antecedente")).toBeVisible();
    expect(screen.queryByText("Cuarto antecedente")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Ver todos los antecedentes" }),
    );

    expect(screen.getByText("Cuarto antecedente")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Ver menos antecedentes" }),
    ).toBeVisible();
  });

  test("groups team and follow-up members under their own underlined headings", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <CasePresentationCase
            item={{
              ...item,
              team: [
                {
                  assignmentId: "team-1",
                  userId: "user-1",
                  fullName: "Ana Torres",
                  alias: "AT",
                  avatarColor: null,
                  position: "partner",
                  activeStudioMember: true,
                },
              ],
              followers: [
                {
                  assignmentId: "follower-1",
                  userId: "user-2",
                  fullName: "Bruno Díaz",
                  alias: "BD",
                  avatarColor: null,
                  position: "junior",
                  activeStudioMember: true,
                },
              ],
            }}
            clientName="Cliente Andes"
            organizationDate="2026-09-04"
            open
            onOpenChange={vi.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const people = screen.getByRole("group", {
      name: "Participación de Caso tributario",
    });
    const scroller = within(people).getByRole("region", {
      name: "Equipo y seguimiento de Caso tributario",
    });
    expect(people).toHaveClass("overflow-hidden");
    expect(scroller).toHaveClass("overflow-x-auto");
    expect(scroller).toHaveAttribute("tabindex", "0");
    expect(within(people).getByText("Equipo")).toHaveClass("border-b");
    expect(within(people).getByText("Seguimiento")).toHaveClass("border-b");
    expect(
      within(people).getByRole("group", {
        name: "Equipo de Caso tributario",
      }),
    ).toBeVisible();
    expect(
      within(people).getByRole("group", {
        name: "Seguimiento de Caso tributario",
      }),
    ).toBeVisible();
  });
});
