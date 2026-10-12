import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PositionAvatarGroups } from "@/features/identity/position-avatar-groups";

describe("responsive UI contract", () => {
  test("keeps shared buttons and tabs touch-safe through tablet widths", () => {
    render(
      <>
        <Button>Guardar</Button>
        <Button size="sm">Filtrar</Button>
        <Button size="icon" aria-label="Acción">
          A
        </Button>
        <Select defaultValue="active">
          <SelectTrigger aria-label="Estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Activo</SelectItem>
          </SelectContent>
        </Select>
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Activos</TabsTrigger>
          </TabsList>
        </Tabs>
      </>,
    );

    expect(screen.getByRole("button", { name: "Guardar" })).toHaveClass(
      "h-11",
      "lg:h-9",
    );
    expect(screen.getByRole("button", { name: "Filtrar" })).toHaveClass(
      "h-11",
      "lg:h-8",
    );
    expect(screen.getByRole("button", { name: "Acción" })).toHaveClass(
      "size-11",
      "lg:size-9",
    );
    expect(screen.getByRole("combobox", { name: "Estado" })).toHaveClass(
      "data-[size=default]:h-11",
      "lg:data-[size=default]:h-9",
    );
    expect(screen.getByRole("tablist")).toHaveClass(
      "group-data-[orientation=horizontal]/tabs:h-11",
      "lg:group-data-[orientation=horizontal]/tabs:h-9",
    );
  });

  test("keeps side sheets above the home indicator safe area", () => {
    render(
      <Sheet open>
        <SheetContent side="right">
          <SheetTitle>Detalle</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    expect(document.querySelector('[data-slot="sheet-content"]')).toHaveClass(
      "pb-[env(safe-area-inset-bottom)]",
    );
  });

  test("separates compact grouped avatars from their mobile touch targets", () => {
    render(
      <MemoryRouter>
        <PositionAvatarGroups
          ariaLabel="Equipo"
          emptyLabel="Sin equipo"
          people={["Ana", "Bea", "Carla", "Diana"].map((name, index) => ({
            identityId: `identity-${index}`,
            userId: `user-${index}`,
            alias: name.slice(0, 2).toUpperCase(),
            fullName: name,
            avatarColor: null,
            position: "partner" as const,
            activeStudioMember: true,
          }))}
        />
      </MemoryRouter>,
    );

    const avatarTrigger = screen.getByRole("link", {
      name: "AN, Ana, Socio",
    });
    expect(avatarTrigger).toHaveClass("min-h-11", "w-8");
    expect(
      avatarTrigger.querySelector('[data-slot="position-avatar-visual"]'),
    ).toHaveClass("size-8", "border-2");

    const overflowTrigger = screen.getByRole("button", {
      name: "1 socio más",
    });
    expect(overflowTrigger).toHaveClass("min-h-11", "w-8");
    expect(
      overflowTrigger.querySelector(
        '[data-slot="position-avatar-overflow-visual"]',
      ),
    ).toHaveClass("size-8", "border-2");
  });
});
