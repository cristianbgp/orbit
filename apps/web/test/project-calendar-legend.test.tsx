import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProjectCalendarLegend } from "@/features/projects/project-calendar-legend";

describe("ProjectCalendarLegend", () => {
  test("explains project period and event symbols without a horizontal scroller", () => {
    render(<ProjectCalendarLegend />);

    const legend = screen.getByRole("group", {
      name: "Leyenda del calendario",
    });
    expect(within(legend).getByText("Inicio del proyecto")).toBeInTheDocument();
    expect(within(legend).getByText("Fin del proyecto")).toBeInTheDocument();
    expect(within(legend).getByText("Evento legal")).toBeInTheDocument();
    expect(within(legend).getByText("Fin de semana")).toBeInTheDocument();
    expect(
      within(legend).getByText("Color de barra: proyecto"),
    ).toBeInTheDocument();
    expect(within(legend).getByText("Completada")).toBeInTheDocument();
    expect(within(legend).getByText("Suspendida")).toBeInTheDocument();
    expect(within(legend).getByText("Vencida")).toBeInTheDocument();
    expect(within(legend).getByTestId("weekend-swatch")).toHaveClass(
      "bg-muted/60",
    );
    expect(within(legend).getByTestId("project-color-swatch")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(
      within(legend).getByText("Fin del proyecto").firstElementChild,
    ).toHaveClass("border-danger", "text-danger");
    expect(
      within(legend).getByText("Evento legal").firstElementChild,
    ).toHaveClass("border-primary", "text-primary-strong");
    expect(legend.querySelector(".lucide-calendar-days")).toBeInTheDocument();
    expect(legend.querySelector(".lucide-scale")).not.toBeInTheDocument();
    expect(legend).toHaveClass("flex-wrap");
    expect(legend.className).not.toContain("overflow-x");
  });
});
