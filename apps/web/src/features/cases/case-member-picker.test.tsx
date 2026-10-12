import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { CaseMemberPicker } from "./case-member-picker";

Element.prototype.scrollIntoView = vi.fn();
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const members = [
  {
    userId: "user-1",
    name: "Ana Torres",
    email: "ana@orbit.pe",
    alias: "AT",
    avatarColor: "#3156d3",
    position: "partner",
  },
  {
    userId: "user-2",
    name: "Bruno Díaz",
    email: "bruno@orbit.pe",
    alias: "BD",
    avatarColor: "#111827",
    position: "senior",
  },
];

vi.mock("@/hooks/use-debounced-value", () => ({
  useDebouncedValue: (value: string) => value,
}));

vi.mock("./use-case-option-pages", () => ({
  useAllCaseMembers: (q: string) => ({
    data: q ? members.filter((member) => member.userId === "user-2") : members,
    isPending: false,
    isError: false,
  }),
}));

describe("CaseMemberPicker", () => {
  test("adds and removes members with the command selector", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CaseMemberPicker value={[]} onChange={onChange} />,
    );
    fireEvent.click(
      screen.getByRole("combobox", { name: "Añadir miembros al caso" }),
    );
    fireEvent.click(screen.getByRole("option", { name: /Ana Torres/ }));
    expect(onChange).toHaveBeenLastCalledWith(["user-1"]);

    rerender(<CaseMemberPicker value={["user-1"]} onChange={onChange} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Quitar a Ana Torres" }),
    );
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  test("keeps the selected member identity as informative as the project selector", () => {
    render(<CaseMemberPicker value={["user-1"]} onChange={vi.fn()} />);

    expect(screen.getByRole("img", { name: "Ana Torres" })).toBeVisible();
    expect(screen.getByText("ana@orbit.pe")).toBeVisible();
    expect(screen.getByText("Socio")).toBeVisible();
  });

  test("groups selected members by their studio position", () => {
    render(
      <CaseMemberPicker value={["user-2", "user-1"]} onChange={vi.fn()} />,
    );

    const groups = screen.getAllByRole("group", { name: /^(Socio|Senior)$/ });
    expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual([
      "Socio",
      "Senior",
    ]);
    expect(groups[0]).toHaveTextContent("ana@orbit.pe");
    expect(groups[1]).toHaveTextContent("bruno@orbit.pe");
  });

  test("keeps selected member details visible while searching for another member", () => {
    render(<CaseMemberPicker value={["user-1"]} onChange={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("combobox", { name: "Añadir miembros al caso" }),
    );
    fireEvent.change(
      screen.getByPlaceholderText("Buscar por alias, nombre o correo"),
      {
        target: { value: "Bruno" },
      },
    );

    expect(
      screen.getByRole("button", { name: "Quitar a Ana Torres" }),
    ).toBeVisible();
    expect(screen.getByText("ana@orbit.pe")).toBeVisible();
    expect(screen.getByRole("option", { name: /Bruno Díaz/ })).toBeVisible();
  });
});
