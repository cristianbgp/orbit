import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";

import { TeamDirectory } from "@/features/team/team-directory";

Element.prototype.scrollIntoView = vi.fn();

const members = [
  {
    memberId: "member-owner",
    userId: "user-owner",
    alias: "AT",
    avatarColor: "#11182b",
    name: "Ana Torres",
    email: "ana@orbit.pe",
    image: null,
    role: "owner",
    position: null,
    memberSince: "2026-08-01T10:00:00.000Z",
    isCurrentUser: true,
  },
  {
    memberId: "member-2",
    userId: "user-2",
    alias: "Didi",
    avatarColor: "#4657d9",
    name: "Diego Salazar",
    email: "diego@orbit.pe",
    image: null,
    role: "member",
    position: "junior" as const,
    memberSince: "2026-08-02T10:00:00.000Z",
    isCurrentUser: false,
  },
];

function renderDirectory(
  props: Partial<React.ComponentProps<typeof TeamDirectory>> = {},
) {
  return render(
    <MemoryRouter>
      <TeamDirectory members={members} {...props} />
    </MemoryRouter>,
  );
}

describe("TeamDirectory", () => {
  test("uses a compact shared grid at iPad widths and expands it on wide desktops", () => {
    renderDirectory({ canManage: true, onUpdatePosition: vi.fn() });

    const directory = screen.getByRole("table", {
      name: "Directorio de miembros",
    });
    expect(directory).toHaveClass(
      "lg:grid",
      "lg:grid-cols-[minmax(12rem,1fr)_7rem_7rem_minmax(10rem,auto)]",
      "xl:grid-cols-[minmax(15rem,1fr)_10rem_9rem_minmax(13rem,auto)]",
    );
    expect(directory).not.toHaveClass("md:grid");
    expect(within(directory).getAllByRole("columnheader")).toHaveLength(4);
    expect(within(directory).getAllByRole("row")).toHaveLength(3);

    const diegoRow = screen.getByRole("row", { name: /Diego Salazar/ });
    expect(diegoRow).toHaveClass("lg:col-span-4", "lg:grid-cols-subgrid");
    const positionCell = screen.getByText("Junior").closest('[role="cell"]');
    expect(positionCell).toHaveClass("lg:block");
    expect(positionCell).not.toHaveClass("md:block");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Cambiar posición de Diego Salazar",
      }),
    );
    expect(
      screen.getByRole("group", {
        name: "Editar posición de Diego Salazar",
      }),
    ).toHaveClass("sm:flex-row");
    expect(
      screen.getByRole("group", {
        name: "Editar posición de Diego Salazar",
      }).parentElement,
    ).toHaveClass("lg:col-span-4");
  });

  test("shows active studio members with localized roles", () => {
    renderDirectory();

    expect(screen.getAllByText("AT").length).toBeGreaterThan(0);
    expect(screen.getByText("ana@orbit.pe")).toBeInTheDocument();
    expect(screen.getByText("Propietario")).toBeInTheDocument();
    expect(screen.getAllByText("Didi").length).toBeGreaterThan(0);
    expect(screen.getByText("diego@orbit.pe")).toBeInTheDocument();
    expect(screen.getAllByText("Miembro").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Posición").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Acceso").length).toBeGreaterThan(0);
    expect(screen.getByText("Sin posición")).toBeInTheDocument();
    expect(screen.getByText("Junior")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Diego Salazar/ })).toHaveAttribute(
      "href",
      "/team/user-2",
    );
  });

  test("lets an owner update a member position", async () => {
    const onUpdatePosition = vi.fn().mockResolvedValue(undefined);
    renderDirectory({ canManage: true, onUpdatePosition });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Cambiar posición de Diego Salazar",
      }),
    );
    fireEvent.click(
      screen.getByRole("combobox", { name: "Posición de Diego Salazar" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Senior" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar posición" }));

    await waitFor(() =>
      expect(onUpdatePosition).toHaveBeenCalledWith(members[1], "senior"),
    );
  });

  test("guards a pending position update and keeps an actionable error", async () => {
    let rejectUpdate: (error: Error) => void = () => undefined;
    const onUpdatePosition = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectUpdate = reject;
        }),
    );
    renderDirectory({ canManage: true, onUpdatePosition });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Cambiar posición de Diego Salazar",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar posición" }));

    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    await act(async () => rejectUpdate(new Error("network")));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cambiar la posición. Inténtalo nuevamente.",
    );
    expect(
      screen.getByRole("combobox", { name: "Posición de Diego Salazar" }),
    ).toBeInTheDocument();
  });

  test("keeps position editing hidden from ordinary members", () => {
    renderDirectory({ canManage: false });

    expect(
      screen.queryByRole("button", { name: /Cambiar posición/ }),
    ).not.toBeInTheDocument();
  });

  test("lets an owner confirm removal of an ordinary member", () => {
    const onRemove = vi.fn();
    renderDirectory({ canManage: true, onRemove });

    expect(
      screen.queryByRole("button", { name: "Quitar a Ana Torres" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Quitar a Diego Salazar" }),
    );
    expect(
      screen.getByText(/Diego Salazar perderá el acceso al estudio/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Su participación anterior en proyectos permanecerá en el historial/,
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar retiro" }));

    expect(onRemove).toHaveBeenCalledWith(members[1]);
  });

  test("keeps the confirmation open after removal fails", async () => {
    const onRemove = vi.fn().mockRejectedValue(new Error("failed"));
    renderDirectory({ canManage: true, onRemove });

    fireEvent.click(
      screen.getByRole("button", { name: "Quitar a Diego Salazar" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar retiro" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos quitar a este miembro",
    );
    expect(
      screen.getByRole("button", { name: "Confirmar retiro" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(onRemove).toHaveBeenCalledOnce());
  });
});
