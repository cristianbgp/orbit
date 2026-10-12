import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProjectStatusBadge } from "../src/features/projects/project-presentation";

describe("project status presentation", () => {
  test.each([
    ["draft", "Borrador"],
    ["active", "Activo"],
    ["completed", "Completado"],
  ] as const)("presents %s in Spanish", (status, label) => {
    render(<ProjectStatusBadge status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
