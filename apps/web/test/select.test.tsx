import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

Element.prototype.scrollIntoView = vi.fn();

describe("Select", () => {
  test("exposes visible hover, keyboard-focus, open, and highlighted states", () => {
    render(
      <Select defaultValue="member">
        <SelectTrigger aria-label="Responsabilidad">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="member">Miembro</SelectItem>
          <SelectItem value="responsible">Supervisor</SelectItem>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole("combobox", { name: "Responsabilidad" });
    expect(trigger).toHaveClass(
      "hover:bg-accent",
      "focus-visible:border-ring",
      "focus-visible:ring-[3px]",
      "data-[state=open]:bg-accent",
      "data-[state=open]:border-ring",
    );

    fireEvent.click(trigger);
    expect(screen.getByRole("option", { name: "Supervisor" })).toHaveClass(
      "data-[highlighted]:bg-accent",
      "data-[highlighted]:text-accent-foreground",
    );
  });
});
