import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { CaseActionSheet } from "./case-action-sheet";

Element.prototype.scrollIntoView = vi.fn();
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const members = [
  {
    id: "assignment-1",
    userId: "user-1",
    userName: "Ana Torres",
    userEmail: "ana@orbit.test",
    userAlias: "AT",
    userAvatarColor: "#4057ed",
    position: "partner" as const,
    activeStudioMember: true,
    assignedAt: "2026-09-03T12:00:00.000Z",
    endedAt: null,
  },
];

describe("CaseActionSheet", () => {
  test("selects a single assignee through grouped member identities", () => {
    const onSubmit = vi.fn();
    render(
      <CaseActionSheet
        open
        action={null}
        members={members}
        busy={false}
        error={null}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(
      screen.getByRole("combobox", { name: "Elegir encargado" }),
    ).toHaveTextContent("Sin encargado");
    fireEvent.click(screen.getByRole("combobox", { name: "Elegir encargado" }));
    expect(screen.getByRole("group", { name: "Socio" })).toBeVisible();
    expect(screen.getByRole("option", { name: /Ana Torres/ })).toContainElement(
      screen.getByRole("img", { name: "Ana Torres" }),
    );
    fireEvent.click(screen.getByRole("option", { name: /Ana Torres/ }));
    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: "Preparar informe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar acción" }));

    expect(onSubmit).toHaveBeenCalledWith({
      description: "Preparar informe",
      assigneeUserId: "user-1",
    });
  });
});
