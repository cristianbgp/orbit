import { ArrowDown, ArrowUp, Check, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCompactFilters } from "@/hooks/use-compact-filters";
import type {
  ProjectOrder,
  ProjectOrderBy,
  ProjectView,
} from "@/lib/api/generated/models";

export type ProjectGrouping = "client" | "status" | "none";

export function ProjectPortfolioDisplayOptions({
  view,
  groupBy,
  orderBy,
  order,
  onGroupingChange,
  onOrderByChange,
  onOrderChange,
}: {
  view: ProjectView;
  groupBy: ProjectGrouping;
  orderBy: ProjectOrderBy;
  order: ProjectOrder;
  onGroupingChange(value: ProjectGrouping): void;
  onOrderByChange(value: ProjectOrderBy): void;
  onOrderChange(value: ProjectOrder): void;
}) {
  const compactFilters = useCompactFilters();
  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label="Opciones de vista"
      className="h-11 gap-2 lg:h-9"
    >
      <Settings2 aria-hidden="true" />
      Vista
    </Button>
  );
  const content = (
    <DisplayContent
      view={view}
      groupBy={groupBy}
      orderBy={orderBy}
      order={order}
      onGroupingChange={onGroupingChange}
      onOrderByChange={onOrderByChange}
      onOrderChange={onOrderChange}
    />
  );

  return compactFilters ? (
    <Drawer>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="min-h-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
        <DrawerHeader className="border-border border-b">
          <DrawerTitle>Opciones de vista</DrawerTitle>
          <DrawerDescription>Configura agrupación y orden.</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 overflow-y-auto p-4">{content}</div>
      </DrawerContent>
    </Drawer>
  ) : (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        {content}
      </PopoverContent>
    </Popover>
  );
}

function DisplayContent({
  view,
  groupBy,
  orderBy,
  order,
  onGroupingChange,
  onOrderByChange,
  onOrderChange,
}: {
  view: ProjectView;
  groupBy: ProjectGrouping;
  orderBy: ProjectOrderBy;
  order: ProjectOrder;
  onGroupingChange(value: ProjectGrouping): void;
  onOrderByChange(value: ProjectOrderBy): void;
  onOrderChange(value: ProjectOrder): void;
}) {
  const groupings: Array<[ProjectGrouping, string]> = [
    ["client", "Cliente"],
    ...(view === "current" || view === "archived"
      ? ([["status", "Estado"]] as Array<[ProjectGrouping, string]>)
      : []),
    ["none", "Sin agrupar"],
  ];
  const orderings: Array<[ProjectOrderBy, string]> = [
    ["endDate", "Fecha final"],
    ["startDate", "Fecha de inicio"],
    ["name", "Nombre"],
    ...(view === "archived"
      ? ([["archivedAt", "Fecha de archivo"]] as Array<
          [ProjectOrderBy, string]
        >)
      : []),
  ];

  return (
    <div className="space-y-4">
      <OptionGroup
        label="Agrupar por"
        value={groupBy}
        options={groupings}
        onChange={(value) => onGroupingChange(value as ProjectGrouping)}
      />
      <OptionGroup
        label="Ordenar por"
        value={orderBy}
        options={orderings}
        onChange={(value) => onOrderByChange(value as ProjectOrderBy)}
      />
      <div className="space-y-1.5">
        <p className="text-muted-foreground px-2 text-xs font-semibold">
          Dirección
        </p>
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full justify-start lg:h-9"
          aria-label="Dirección del orden"
          onClick={() => onOrderChange(order === "asc" ? "desc" : "asc")}
        >
          {order === "asc" ? <ArrowUp /> : <ArrowDown />}
          {order === "asc" ? "Ascendente" : "Descendente"}
        </Button>
      </div>
    </div>
  );
}

function OptionGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange(value: string): void;
}) {
  return (
    <div role="group" aria-label={label} className="space-y-1">
      <p className="text-muted-foreground px-2 text-xs font-semibold">
        {label}
      </p>
      {options.map(([optionValue, optionLabel]) => (
        <button
          key={optionValue}
          type="button"
          role="radio"
          aria-checked={value === optionValue}
          className="hover:bg-muted focus-visible:ring-ring flex h-11 w-full items-center rounded-md px-2 text-sm outline-none focus-visible:ring-2 lg:h-9"
          onClick={() => onChange(optionValue)}
        >
          {optionLabel}
          {value === optionValue ? (
            <Check aria-hidden="true" className="text-primary ml-auto size-4" />
          ) : null}
        </button>
      ))}
    </div>
  );
}
