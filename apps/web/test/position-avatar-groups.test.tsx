import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, test, vi } from "vitest";

import { PositionAvatarGroups } from "@/features/identity/position-avatar-groups";

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

const person = (
  index: number,
  position: "partner" | "senior" | "junior" | null,
) => ({
  identityId: `identity-${index}`,
  userId: `user-${index}`,
  alias: `P${index}`,
  fullName: `Persona ${index}`,
  avatarColor: "#4657d9",
  position,
  activeStudioMember: true,
  contextualRole: index === 1 ? "Supervisor" : "Miembro",
});

function renderGroups() {
  render(
    <MemoryRouter>
      <PositionAvatarGroups
        ariaLabel="Equipo del proyecto"
        emptyLabel="Sin equipo"
        people={[
          person(5, null),
          person(6, "junior"),
          person(1, "partner"),
          person(2, "partner"),
          person(3, "partner"),
          person(4, "partner"),
        ]}
      />
    </MemoryRouter>,
  );
}

describe("PositionAvatarGroups", () => {
  test("groups only present positions in canonical order", () => {
    renderGroups();
    const group = screen.getByRole("group", { name: "Equipo del proyecto" });
    const text = group.textContent ?? "";

    expect(text.indexOf("Socio")).toBeLessThan(text.indexOf("Junior"));
    expect(text.indexOf("Junior")).toBeLessThan(text.indexOf("Sin posición"));
    expect(within(group).queryByText("Senior")).not.toBeInTheDocument();
    expect(within(group).queryByText("Asistente")).not.toBeInTheDocument();
  });

  test("shows three avatars and opens position-specific overflow", async () => {
    renderGroups();

    expect(
      screen.getByRole("link", { name: /P1, Persona 1, Socio/ }),
    ).toHaveAttribute("href", "/team/user-1");
    const more = screen.getByRole("button", { name: "1 socio más" });
    fireEvent.click(more);

    const dialog = await screen.findByRole("dialog", {
      name: "Socio: integrantes adicionales",
    });
    expect(
      within(dialog).getByRole("link", { name: /Persona 4/ }),
    ).toBeVisible();
    expect(within(dialog).queryByText("Persona 6")).not.toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", {
        name: "Socio: integrantes adicionales",
      }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(more).toHaveFocus());
  });

  test("uses position and contextual role in the avatar tooltip", async () => {
    renderGroups();
    fireEvent.focus(screen.getByRole("link", { name: /P1, Persona 1, Socio/ }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "P1 · Persona 1 · Socio · Supervisor",
    );
  });
});
