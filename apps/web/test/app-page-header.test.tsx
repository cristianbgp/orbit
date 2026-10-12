import { render, screen } from "@testing-library/react";
import { FolderKanban } from "lucide-react";
import { describe, expect, test } from "vitest";

import { AppPageHeader } from "@/features/layout/app-page-header";

describe("AppPageHeader", () => {
  test("provides the shared icon-led page heading and responsive action layout", () => {
    render(
      <AppPageHeader
        icon={FolderKanban}
        eyebrow="Cartera legal"
        title="Proyectos"
        description="Organiza los asuntos del estudio."
        actions={<button type="button">Nuevo proyecto</button>}
        aria-label="Encabezado de proyectos"
      />,
    );

    const header = screen.getByLabelText("Encabezado de proyectos");
    expect(header).toHaveAttribute("data-slot", "app-page-header");
    expect(header).toHaveClass(
      "border-b",
      "pb-6",
      "sm:flex-row",
      "sm:items-end",
      "sm:justify-between",
    );
    expect(screen.getByText("Cartera legal")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Proyectos" })).toHaveClass(
      "font-display",
      "text-3xl",
      "sm:text-4xl",
    );
    expect(screen.getByText("Organiza los asuntos del estudio.")).toHaveClass(
      "max-w-2xl",
      "leading-6",
    );
    expect(
      screen.getByRole("button", { name: "Nuevo proyecto" }),
    ).toBeVisible();

    const iconContainer = header.querySelector(
      '[data-slot="app-page-header-icon"]',
    );
    expect(iconContainer).toHaveClass(
      "size-11",
      "shrink-0",
      "bg-primary-soft",
      "text-primary-strong",
    );
    expect(iconContainer?.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  test("renders without optional eyebrow, description, or actions", () => {
    render(<AppPageHeader icon={FolderKanban} title="Proyecto" />);

    expect(screen.getByRole("heading", { name: "Proyecto" })).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
