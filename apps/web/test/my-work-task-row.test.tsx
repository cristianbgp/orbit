import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, test, vi } from "vitest";

import { MyWorkTaskRow } from "@/features/my-work/my-work-task-row";

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

const responsible = (index: number, activeStudioMember = true) => ({
  assignmentId: `assignment-${index}`,
  userId: activeStudioMember ? `user-${index}` : null,
  userName: `Integrante ${index}`,
  userEmail: `integrante${index}@orbit.test`,
  userAlias: `I${index}`,
  userAvatarColor: index === 1 ? "#4657d9" : "#0f766e",
  userPosition: index === 1 ? ("partner" as const) : ("junior" as const),
  activeStudioMember,
  assignedAt: "2026-08-01T10:00:00.000Z",
});

const task = {
  id: "task-1",
  title: "Redactar demanda",
  status: "in_progress" as const,
  plannedStartDate: "2026-08-06",
  internalDueDate: "2026-08-09",
  updatedAt: "2026-08-08T10:00:00.000Z",
  group: "overdue" as const,
  project: {
    id: "project-1",
    name: "Apelación contractual",
    client: { id: "client-1", name: "Constructora Andina" },
  },
  stage: { id: "stage-1", name: "Redacción", position: 2 },
  responsibles: [
    responsible(1),
    responsible(2, false),
    responsible(3),
    responsible(4),
    responsible(5),
  ],
};

function renderRow(value = task, showProjectContext = true) {
  render(
    <MemoryRouter>
      <MyWorkTaskRow
        task={value}
        busy={false}
        showProjectContext={showProjectContext}
        onOpen={vi.fn()}
        onStatus={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("MyWorkTaskRow", () => {
  test("uses compact desktop columns from the iPad landscape breakpoint", () => {
    renderRow();
    const row = screen.getByRole("article");
    const statusCell = screen.getByRole("combobox", {
      name: /Cambiar estado de Redactar demanda/,
    }).parentElement;

    expect(row).toHaveClass(
      "lg:grid-cols-[2.75rem_minmax(11rem,1fr)_7.5rem_8.5rem_6.5rem]",
      "xl:grid-cols-[2.75rem_minmax(15rem,1fr)_8.5rem_9.5rem_7.5rem]",
      "lg:items-center",
    );
    expect(statusCell).toHaveClass(
      "lg:items-center",
      "lg:justify-center",
      "lg:pt-0",
    );
  });

  test("presents client, project, and task in that reading order", () => {
    renderRow();
    const row = screen.getByRole("article");
    const text = row.textContent ?? "";

    expect(text.indexOf("Constructora Andina")).toBeLessThan(
      text.indexOf("Apelación contractual"),
    );
    expect(text.indexOf("Apelación contractual")).toBeLessThan(
      text.indexOf("Redactar demanda"),
    );
    expect(
      within(row).getByRole("link", { name: "Apelación contractual" }),
    ).toHaveAttribute("href", "/projects/project-1");
    expect(
      within(row).getByRole("button", { name: "Abrir Redactar demanda" }),
    ).toBeVisible();
  });

  test("can omit repeated project context while preserving task details", () => {
    renderRow(task, false);

    expect(screen.queryByText("Constructora Andina")).not.toBeInTheDocument();
    expect(screen.queryByText("Apelación contractual")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Abrir Redactar demanda" }),
    ).toBeVisible();
    expect(screen.getByText("Redacción")).toBeVisible();
  });

  test("shows the weekday above each task date", () => {
    renderRow();
    const row = screen.getByRole("article");

    expect(within(row).getByText("jueves")).toBeVisible();
    expect(within(row).getByText("domingo")).toBeVisible();
    expect(row).toHaveTextContent("Iniciojueves6 ago 2026");
    expect(row).toHaveTextContent("Fecha límitedomingo9 ago 2026");
  });

  test("shows task assignees as accessible avatars with overflow", async () => {
    renderRow();

    const active = screen.getByRole("link", {
      name: "I1, Integrante 1, Socio, Encargado",
    });
    expect(active).toHaveAttribute("href", "/team/user-1");
    expect(
      within(active).getByRole("img", { name: "Integrante 1" }),
    ).toHaveTextContent("I1");
    expect(
      screen.getByLabelText("I2, Integrante 2, Junior, Encargado"),
    ).not.toHaveAttribute("href");
    expect(screen.getByLabelText("1 junior más")).toHaveTextContent("+1");

    fireEvent.focus(active);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "I1 · Integrante 1 · Socio · Encargado",
    );
  });

  test("states clearly when a task has no assignee", () => {
    renderRow({ ...task, responsibles: [] });

    expect(screen.getByText("Sin encargado")).toBeVisible();
  });
});
