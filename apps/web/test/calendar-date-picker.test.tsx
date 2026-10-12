import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import {
  calendarDateToDate,
  DatePicker,
  DateRangePicker,
  dateToCalendarDate,
} from "@/components/ui/calendar-date-picker";
import { CalendarTodayProvider } from "@/components/ui/calendar-today-context";
import { OrganizationCalendarProvider } from "@/features/organization/organization-calendar-context";

const orbitTheme = readFileSync(
  resolve(process.cwd(), "src/styles/globals.css"),
  "utf8",
);

describe("calendar date fields", () => {
  test("provides an opaque semantic surface for calendar popovers", () => {
    expect(orbitTheme).toMatch(/--color-popover:\s*var\(--popover\);/);
    expect(orbitTheme).toMatch(/--popover:\s*#[0-9a-f]{6};/i);
    expect(orbitTheme).toMatch(
      /--color-popover-foreground:\s*var\(--popover-foreground\);/,
    );
  });

  test("round-trips calendar dates through UTC without shifting the day", () => {
    const date = calendarDateToDate("2026-08-14");

    expect(date.toISOString()).toBe("2026-08-14T00:00:00.000Z");
    expect(dateToCalendarDate(date)).toBe("2026-08-14");
  });

  test("marks today using the organization time zone after UTC enters the next day", () => {
    render(
      <OrganizationCalendarProvider
        timeZone="America/Lima"
        now={new Date("2026-08-14T04:30:00.000Z")}
      >
        <DatePicker
          id="organization-date"
          label="Fecha"
          value="2026-08-14"
          onChange={vi.fn()}
        />
      </OrganizationCalendarProvider>,
    );

    fireEvent.click(screen.getByLabelText("Fecha"));

    expect(
      screen.getByRole("button", {
        name: /^Hoy, jueves, 13 de agosto de 2026$/i,
      }),
    ).toBeVisible();
    const selectedDate = screen.getByRole("button", {
      name: /viernes, 14 de agosto de 2026/i,
    });
    expect(selectedDate).toBeVisible();
    expect(selectedDate.closest("td")).not.toHaveAttribute(
      "data-today",
      "true",
    );
  });

  test("selects and clears a single date from a Spanish calendar", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DatePicker
        id="internal-date"
        label="Fecha límite interna"
        value="2026-08-14"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByLabelText("Fecha límite interna"));
    expect(screen.getByText(/agosto.*2026/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ir al mes anterior" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /15 de agosto de 2026/i }),
    );
    expect(onChange).toHaveBeenCalledWith("2026-08-15");

    rerender(
      <DatePicker
        id="internal-date"
        label="Fecha límite interna"
        value="2026-08-15"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("Fecha límite interna"));
    fireEvent.click(screen.getByRole("button", { name: "Limpiar fecha" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  test("completes and clears a date range without inventing an end date", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DateRangePicker
        id="task-period"
        label="Fechas planificadas"
        from="2026-08-10"
        to=""
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByLabelText("Fechas planificadas"));
    fireEvent.click(
      screen.getByRole("button", { name: /14 de agosto de 2026/i }),
    );
    expect(onChange).toHaveBeenCalledWith({
      from: "2026-08-10",
      to: "2026-08-14",
    });

    rerender(
      <DateRangePicker
        id="task-period"
        label="Fechas planificadas"
        from="2026-08-10"
        to="2026-08-14"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("Fechas planificadas"));
    fireEvent.click(screen.getByRole("button", { name: "Limpiar fechas" }));
    expect(onChange).toHaveBeenLastCalledWith({ from: "", to: "" });
  });

  test("starts a new range with one click when the current range is complete", () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker
        id="replace-period"
        label="Fechas planificadas"
        from="2026-08-10"
        to="2026-08-14"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByLabelText("Fechas planificadas"));
    fireEvent.click(
      screen.getByRole("button", { name: /20 de agosto de 2026/i }),
    );

    expect(onChange).toHaveBeenCalledWith({
      from: "2026-08-20",
      to: "",
    });
  });

  test("presents a completed range as solid endpoints and a soft Orbit band", () => {
    render(
      <DateRangePicker
        id="colored-period"
        label="Fechas planificadas"
        from="2026-08-10"
        to="2026-08-14"
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText("Fechas planificadas"));

    const start = screen.getByRole("button", {
      name: /lunes, 10 de agosto de 2026/i,
    });
    const middle = screen.getByRole("button", {
      name: /martes, 11 de agosto de 2026/i,
    });
    const end = screen.getByRole("button", {
      name: /viernes, 14 de agosto de 2026/i,
    });
    const outside = screen.getByRole("button", {
      name: /sábado, 15 de agosto de 2026/i,
    });

    expect(start).toHaveAttribute("data-range-start", "true");
    expect(start).toHaveClass(
      "data-[range-start=true]:bg-primary",
      "data-[range-start=true]:text-primary-foreground",
    );
    expect(middle).toHaveAttribute("data-range-middle", "true");
    expect(middle).toHaveClass(
      "data-[range-middle=true]:bg-primary/10",
      "data-[range-middle=true]:text-primary-strong",
    );
    expect(end).toHaveAttribute("data-range-end", "true");
    expect(end).toHaveClass(
      "data-[range-end=true]:bg-primary",
      "data-[range-end=true]:text-primary-foreground",
    );
    expect(outside).toHaveAttribute("data-range-start", "false");
    expect(outside).toHaveAttribute("data-range-middle", "false");
    expect(outside).toHaveAttribute("data-range-end", "false");
  });

  test("tints weekends without interrupting a selected range", () => {
    render(
      <DateRangePicker
        id="weekend-period"
        label="Fechas planificadas"
        from="2026-08-14"
        to="2026-08-17"
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText("Fechas planificadas"));

    const friday = screen.getByRole("button", {
      name: /viernes, 14 de agosto de 2026/i,
    });
    const saturday = screen.getByRole("button", {
      name: /sábado, 15 de agosto de 2026/i,
    });
    const sunday = screen.getByRole("button", {
      name: /domingo, 16 de agosto de 2026/i,
    });

    expect(friday.closest("td")).not.toHaveClass("bg-muted/35");
    expect(saturday.closest("td")).toHaveClass("bg-muted/35");
    expect(sunday.closest("td")).toHaveClass("bg-muted/35");
    expect(saturday).toHaveAttribute("data-range-middle", "true");
    expect(saturday).toHaveClass("data-[range-middle=true]:bg-primary/10");
    expect(sunday).toHaveAttribute("data-range-middle", "true");
  });

  test("exposes validation and disables dates outside the allowed interval", () => {
    render(
      <CalendarTodayProvider today="2026-08-14">
        <DatePicker
          id="bounded-date"
          label="Fecha límite interna"
          value="2026-08-14"
          min="2026-08-10"
          max="2026-08-20"
          error="Revisa esta fecha."
          onChange={vi.fn()}
        />
      </CalendarTodayProvider>,
    );

    expect(screen.getByLabelText("Fecha límite interna")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Revisa esta fecha.");

    fireEvent.click(screen.getByLabelText("Fecha límite interna"));
    expect(
      screen.getByRole("button", {
        name: /^domingo, 9 de agosto de 2026$/i,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: /^viernes, 21 de agosto de 2026$/i,
      }),
    ).toBeDisabled();
  });

  test("disables range dates before the allowed minimum", () => {
    render(
      <DateRangePicker
        id="bounded-period"
        label="Fechas planificadas"
        from=""
        to=""
        min="2026-08-10"
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText("Fechas planificadas"));

    expect(
      screen.getByRole("button", {
        name: /^domingo, 9 de agosto de 2026$/i,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: /lunes, 10 de agosto de 2026/i,
      }),
    ).toBeEnabled();
  });
});
