import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

Element.prototype.scrollIntoView = vi.fn();
vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

describe("Command search", () => {
  test("matches case and Spanish diacritics without changing the displayed label", () => {
    render(
      <Command>
        <CommandInput aria-label="Buscar opción" />
        <CommandList>
          <CommandEmpty>Sin resultados</CommandEmpty>
          <CommandItem value="Señor Álvarez">Señor Álvarez</CommandItem>
          <CommandItem value="Consulta ordinaria">
            Consulta ordinaria
          </CommandItem>
        </CommandList>
      </Command>,
    );

    fireEvent.change(screen.getByLabelText("Buscar opción"), {
      target: { value: "SENOR ALVAREZ" },
    });

    expect(screen.getByText("Señor Álvarez")).toBeVisible();
    expect(screen.queryByText("Consulta ordinaria")).not.toBeInTheDocument();
    expect(screen.queryByText("Sin resultados")).not.toBeInTheDocument();
  });
});
