import { useState } from "react";
import { Check, ChevronLeft, ListFilter, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCompactFilters } from "@/hooks/use-compact-filters";
import { cn } from "@/lib/utils";
import {
  countActiveCaseFilters,
  type CasePortfolioFilters,
  type CaseTypeFilter,
} from "./case-portfolio-filter-state";
import { getCaseLabel } from "./case-presenters";
import { useAllCaseClients, useAllCaseMembers } from "./use-case-option-pages";

type FilterProperty = "type" | "client" | "member";
type FilterOption = { value: string; label: string; detail?: string };

const propertyLabels: Record<FilterProperty, string> = {
  type: "Tipo",
  client: "Cliente",
  member: "Miembro",
};

const caseTypes: CaseTypeFilter[] = [
  "administrative",
  "judicial",
  "constitutional",
  "other",
];

export function CasePortfolioFiltersBar({
  search,
  filters,
  onSearchChange,
  onFiltersChange,
  showSearch = true,
}: {
  search: string;
  filters: CasePortfolioFilters;
  onSearchChange(value: string): void;
  onFiltersChange(filters: CasePortfolioFilters): void;
  showSearch?: boolean;
}) {
  const compactFilters = useCompactFilters();
  const [open, setOpen] = useState(false);
  const [property, setProperty] = useState<FilterProperty | null>(null);
  const clients = useAllCaseClients();
  const members = useAllCaseMembers();
  const activeCount = countActiveCaseFilters(filters);
  const options: Record<FilterProperty, FilterOption[]> = {
    type: caseTypes.map((value) => ({
      value,
      label: getCaseLabel("type", value),
    })),
    client: (clients.data ?? []).map((client) => ({
      value: client.id,
      label: client.name,
    })),
    member: (members.data ?? []).map((member) => ({
      value: member.userId,
      label: member.alias,
      detail: member.name,
    })),
  };

  function selectedValues(selectedProperty: FilterProperty) {
    return {
      type: filters.types,
      client: filters.clientIds,
      member: filters.memberUserIds,
    }[selectedProperty];
  }

  function changeProperty(selectedProperty: FilterProperty, values: string[]) {
    onFiltersChange({
      ...filters,
      ...(selectedProperty === "type"
        ? { types: values as CaseTypeFilter[] }
        : selectedProperty === "client"
          ? { clientIds: values }
          : { memberUserIds: values }),
    });
  }

  function closeFilters(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setProperty(null);
  }

  const content = (
    <CaseFilterCommand
      property={property}
      options={options}
      selectedValues={selectedValues}
      onPropertyChange={setProperty}
      onSelectedChange={changeProperty}
    />
  );
  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={`Filtrar casos${activeCount ? `, ${activeCount} activos` : ""}`}
      className="h-11 gap-2 lg:h-9"
    >
      <ListFilter aria-hidden="true" />
      <span>Filtro</span>
      {activeCount ? (
        <span className="bg-primary text-primary-foreground inline-flex size-5 items-center justify-center rounded-full text-[11px] font-bold">
          {activeCount}
        </span>
      ) : null}
    </Button>
  );

  return (
    <div className="w-full min-w-0 flex-1 space-y-2">
      <div className="flex min-w-0 items-center gap-2">
        {showSearch ? (
          <label className="relative min-w-0 flex-1 md:max-w-xl">
            <span className="sr-only">Buscar casos</span>
            <Search
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <Input
              type="search"
              aria-label="Buscar casos"
              placeholder="Buscar caso, expediente, cliente o materia"
              className="h-11 pl-9 lg:h-9"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
        ) : null}
        {compactFilters ? (
          <Drawer autoFocus={false} open={open} onOpenChange={closeFilters}>
            <DrawerTrigger asChild>{trigger}</DrawerTrigger>
            <DrawerContent className="min-h-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
              <DrawerHeader className="border-border border-b">
                <DrawerTitle>Filtrar casos</DrawerTitle>
                <DrawerDescription>
                  Combina propiedades para acotar la cartera procesal.
                </DrawerDescription>
              </DrawerHeader>
              <div className="min-h-0 flex-1 overflow-hidden">{content}</div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Popover open={open} onOpenChange={closeFilters}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent className="w-80 overflow-hidden p-0">
              {content}
            </PopoverContent>
          </Popover>
        )}
      </div>
      <CaseFilterChips
        filters={filters}
        options={options}
        onEdit={(nextProperty) => {
          setProperty(nextProperty);
          setOpen(true);
        }}
        onClear={(nextProperty) => changeProperty(nextProperty, [])}
      />
    </div>
  );
}

function CaseFilterCommand({
  property,
  options,
  selectedValues,
  onPropertyChange,
  onSelectedChange,
}: {
  property: FilterProperty | null;
  options: Record<FilterProperty, FilterOption[]>;
  selectedValues(property: FilterProperty): string[];
  onPropertyChange(property: FilterProperty | null): void;
  onSelectedChange(property: FilterProperty, values: string[]): void;
}) {
  if (!property) {
    return (
      <Command className="max-h-[min(32rem,70dvh)]">
        <CommandInput placeholder="Buscar propiedad" />
        <CommandList className="max-h-none min-h-0 flex-1 overscroll-contain">
          <CommandGroup heading="Filtrar por">
            {(Object.keys(propertyLabels) as FilterProperty[]).map((item) => (
              <CommandItem key={item} onSelect={() => onPropertyChange(item)}>
                {propertyLabels[item]}
                {selectedValues(item).length ? (
                  <span className="text-muted-foreground ml-auto text-xs">
                    {selectedValues(item).length}
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    );
  }

  const selected = selectedValues(property);
  return (
    <Command className="max-h-[min(32rem,70dvh)]">
      <div className="border-border flex items-center border-b px-2 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Volver a propiedades"
          onClick={() => onPropertyChange(null)}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span className="text-sm font-semibold">
          {propertyLabels[property]}
        </span>
      </div>
      <CommandInput
        placeholder={`Buscar ${propertyLabels[property].toLowerCase()}`}
      />
      <CommandList
        aria-multiselectable="true"
        className="max-h-none min-h-0 flex-1 overscroll-contain"
      >
        <CommandEmpty>No encontramos opciones.</CommandEmpty>
        <CommandGroup>
          {options[property].map((option) => {
            const checked = selected.includes(option.value);
            return (
              <CommandItem
                key={option.value}
                value={`${option.label} ${option.detail ?? ""}`}
                aria-checked={checked}
                onSelect={() =>
                  onSelectedChange(
                    property,
                    checked
                      ? selected.filter((value) => value !== option.value)
                      : [...selected, option.value],
                  )
                }
              >
                <span
                  className={cn(
                    "border-border flex size-4 items-center justify-center rounded-sm border",
                    checked &&
                      "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {checked ? (
                    <Check aria-hidden="true" className="size-3" />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                  {option.detail ? (
                    <span className="text-muted-foreground block truncate text-xs">
                      {option.detail}
                    </span>
                  ) : null}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function CaseFilterChips({
  filters,
  options,
  onEdit,
  onClear,
}: {
  filters: CasePortfolioFilters;
  options: Record<FilterProperty, FilterOption[]>;
  onEdit(property: FilterProperty): void;
  onClear(property: FilterProperty): void;
}) {
  const entries: Array<[FilterProperty, string[]]> = [
    ["type", filters.types],
    ["client", filters.clientIds],
    ["member", filters.memberUserIds],
  ];
  const active = entries.filter(([, values]) => values.length > 0);
  if (!active.length) return null;

  return (
    <div className="flex max-w-full scrollbar-none gap-2 overflow-x-auto pb-1">
      {active.map(([property, values]) => {
        const labels = values.map(
          (value) =>
            options[property].find((option) => option.value === value)?.label ??
            value,
        );
        const summary = `${propertyLabels[property]}: ${labels.slice(0, 2).join(" + ")}${labels.length > 2 ? ` +${labels.length - 2}` : ""}`;
        return (
          <span
            key={property}
            className="border-border bg-muted inline-flex h-8 shrink-0 items-center rounded-full border text-xs font-medium"
          >
            <button
              type="button"
              className="focus-visible:ring-ring hover:bg-muted-foreground/10 h-full rounded-l-full px-3 outline-none focus-visible:ring-2"
              onClick={() => onEdit(property)}
            >
              {summary}
            </button>
            <button
              type="button"
              aria-label={`Quitar filtro ${propertyLabels[property]}`}
              className="focus-visible:ring-ring hover:bg-muted-foreground/10 mr-1 inline-flex size-7 items-center justify-center rounded-full outline-none focus-visible:ring-2"
              onClick={() => onClear(property)}
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </span>
        );
      })}
    </div>
  );
}
