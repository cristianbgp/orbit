import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";

import { MemberIdentity } from "@/features/identity/member-identity";
import type { MemberIdentityData } from "@/features/identity/member-identity-types";

const member: MemberIdentityData = {
  userId: "user-1",
  alias: "Cristian",
  fullName: "Cristian Granda",
  activeStudioMember: true,
};

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

describe("MemberIdentity", () => {
  test("renders a link with the member full name when a destination is provided", () => {
    render(
      <MemoryRouter>
        <MemberIdentity member={member} to="/team/user-1" />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: /Cristian Granda/ }),
    ).toHaveAttribute("href", "/team/user-1");
    expect(screen.getByText("Cristian")).toBeInTheDocument();
  });

  test("renders a non-anchor focusable identity when the member has no destination", () => {
    render(<MemberIdentity member={member} secondary="Propietario" />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Cristian")).toBeInTheDocument();
    expect(screen.getByText("Propietario")).toBeInTheDocument();
  });

  test("shows the full name tooltip on pointer hover and keyboard focus", async () => {
    render(<MemberIdentity member={member} />);

    const trigger = screen.getByText("Cristian").closest("span[tabindex]");
    expect(trigger).not.toBeNull();

    fireEvent.mouseEnter(trigger!);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Cristian Granda",
    );

    fireEvent.mouseLeave(trigger!);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.focus(trigger!);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Cristian Granda",
    );

    fireEvent.mouseEnter(trigger!);
    fireEvent.mouseLeave(trigger!);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Cristian Granda");

    fireEvent.blur(trigger!);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  test("uses the full name as primary text when an alias is absent", () => {
    render(<MemberIdentity member={{ ...member, alias: undefined }} />);

    expect(screen.getByText("Cristian Granda")).toBeInTheDocument();
  });
});
