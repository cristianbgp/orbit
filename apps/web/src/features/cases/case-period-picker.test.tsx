import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { CasePeriodPicker } from "./case-period-picker";

Element.prototype.scrollIntoView = vi.fn();

function chooseOption(label: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(screen.getByRole("option", { name: option }));
}

describe("CasePeriodPicker", () => {
  test("confirms the current year shown by default", () => {
    const onChange = vi.fn();
    render(<CasePeriodPicker value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Período del caso" }));
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));

    expect(onChange).toHaveBeenLastCalledWith({
      kind: "year",
      year: new Date().getUTCFullYear(),
    });
  });

  test("uses shadcn controls to select a month without asking for a day", () => {
    const onChange = vi.fn();
    render(<CasePeriodPicker value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Período del caso" }));
    chooseOption("Forma del período", "Mes");
    chooseOption("Mes", "Marzo");
    chooseOption("Año", "2024");

    expect(onChange).toHaveBeenLastCalledWith({
      kind: "month",
      month: "2024-03",
    });
  });

  test("shows the normalized period summary and can clear it", () => {
    const onChange = vi.fn();
    render(
      <CasePeriodPicker
        value={{
          kind: "month_range",
          startMonth: "2023-11",
          endMonth: "2024-02",
        }}
        onChange={onChange}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Período del caso" }),
    ).toHaveTextContent("nov 2023 - feb 2024");
    fireEvent.click(screen.getByRole("button", { name: "Período del caso" }));
    fireEvent.click(screen.getByRole("button", { name: "Limpiar período" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
