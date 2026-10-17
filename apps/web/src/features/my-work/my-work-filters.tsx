import { useEffect, useState } from "react";
import { Check, ChevronLeft, ListFilter, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/calendar-date-picker";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
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
import { PROJECT_TASK_STATUS_LABELS } from "@/features/projects/project-task-labels";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCompactFilters } from "@/hooks/use-compact-filters";
import type { ProjectTaskStatus } from "@/lib/api/generated/models";
import { useListProjects } from "@/lib/api/generated/projects/projects";
import { cn } from "@/lib/utils";

export type MyWorkFilterValue = {
  search: string;
  projectIds: string[];
  statuses: ProjectTaskStatus[];
  dateFrom: string;
  dateTo: string;
  includeCompleted: boolean;
};

type FilterProperty = "project" | "status" | "dates" | "completed";
type FilterOption = { value: string; label: string; detail?: string };

const propertyLabels: Record<FilterProperty, string> = {
  project: "Proyecto",
  status: "Estado de tarea",
  dates: "Fecha límite",
  completed: "Tareas completadas",
};

function activePropertyCount(value: MyWorkFilterValue) {
  return [
    value.projectIds.length > 0,
    value.statuses.length > 0,
    Boolean(value.dateFrom || value.dateTo),
    value.includeCompleted,
  ].filter(Boolean).length;
}

export function MyWorkFilters({
  value,
  resultSummary,
  onChange,
}: {
  value: MyWorkFilterValue;
  resultSummary?: string;
  onChange(value: MyWorkFilterValue): void;
}) {
  const compactFilters = useCompactFilters();
  const [search, setSearch] = useState(value.search);
  const [projectSearch, setProjectSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [property, setProperty] = useState<FilterProperty | null>(null);
  const debouncedSearch = useDebouncedValue(search);
  const debouncedProjectSearch = useDebouncedValue(projectSearch).trim();
  const projectsQuery = useListProjects({
    view: "current",
    page: 1,
    pageSize: 100,
    ...(debouncedProjectSearch ? { search: debouncedProjectSearch } : {}),
  });

  useEffect(() => setSearch(value.search), [value.search]);
  useEffect(() => {
    const normalized = debouncedSearch.trim();
    if (normalized !== value.search) onChange({ ...value, search: normalized });
  }, [debouncedSearch, onChange, value]);

  const projectOptions = (projectsQuery.data?.projects ?? []).map(
    (project) => ({
      value: project.id,
      label: project.name,
      detail: project.client.name,
    }),
  );
  const statusOptions = Object.entries(PROJECT_TASK_STATUS_LABELS).map(
    ([status, label]) => ({ value: status, label }),
  );
  const activeCount = activePropertyCount(value);

  function closeFilters(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setProperty(null);
      setProjectSearch("");
    }
  }

  const content = (
    <MyWorkFilterContent
      property={property}
      value={value}
      projectOptions={projectOptions}
      statusOptions={statusOptions}
      projectSearch={projectSearch}
      onProjectSearchChange={setProjectSearch}
      onPropertyChange={setProperty}
      onChange={onChange}
    />
  );
  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={`Filtrar Mi trabajo${activeCount ? `, ${activeCount} activos` : ""}`}
      className="h-11 gap-2 lg:h-9"
    >
      <ListFilter aria-hidden="true" />
      Filtro
      {activeCount ? (
        <span className="bg-primary text-primary-foreground inline-flex size-5 items-center justify-center rounded-full text-[11px] font-bold">
          {activeCount}
        </span>
      ) : null}
    </Button>
  );

  return (
    <div
      aria-label="Filtros de Mi trabajo"
      className="w-full min-w-0 flex-1 space-y-2"
    >
      <div className="flex min-w-0 items-center gap-2">
        <label className="relative min-w-0 flex-1 md:max-w-xl">
          <span className="sr-only">Buscar en Mi trabajo</span>
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            type="search"
            aria-label="Buscar en Mi trabajo"
            placeholder="Buscar tarea, proyecto, cliente o referencia"
            className="h-11 pl-9 lg:h-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div
          data-slot="my-work-filter-actions"
          className="flex shrink-0 items-center gap-2"
        >
          {compactFilters ? (
            <Drawer autoFocus={false} open={open} onOpenChange={closeFilters}>
              <DrawerTrigger asChild>{trigger}</DrawerTrigger>
              <DrawerContent className="min-h-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
                <DrawerHeader className="border-border border-b">
                  <DrawerTitle>Filtrar Mi trabajo</DrawerTitle>
                  <DrawerDescription>
                    Combina propiedades para acotar tu trabajo.
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
          {resultSummary ? (
            <span className="text-muted-foreground text-xs font-medium whitespace-nowrap">
              {resultSummary}
            </span>
          ) : null}
        </div>
      </div>
      <MyWorkFilterChips
        value={value}
        projectOptions={projectOptions}
        statusOptions={statusOptions}
        onEdit={(nextProperty) => {
          setProperty(nextProperty);
          setOpen(true);
        }}
        onChange={onChange}
      />
    </div>
  );
}

function MyWorkFilterContent({
  property,
  value,
  projectOptions,
  statusOptions,
  projectSearch,
  onProjectSearchChange,
  onPropertyChange,
  onChange,
}: {
  property: FilterProperty | null;
  value: MyWorkFilterValue;
  projectOptions: FilterOption[];
  statusOptions: FilterOption[];
  projectSearch: string;
  onProjectSearchChange(value: string): void;
  onPropertyChange(property: FilterProperty | null): void;
  onChange(value: MyWorkFilterValue): void;
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
                {propertyIsActive(item, value) ? (
                  <Check aria-hidden="true" className="text-primary ml-auto" />
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    );
  }

  if (property === "dates") {
    return (
      <div className="min-h-0 overflow-y-auto">
        <FilterBackHeader property={property} onBack={onPropertyChange} />
        <div className="p-4">
          <DateRangePicker
            id="my-work-filter-dates"
            label="Fecha límite"
            from={value.dateFrom}
            to={value.dateTo}
            onChange={({ from, to }) =>
              onChange({ ...value, dateFrom: from, dateTo: to })
            }
          />
        </div>
      </div>
    );
  }

  if (property === "completed") {
    return (
      <Command className="max-h-[min(32rem,70dvh)]">
        <FilterBackHeader property={property} onBack={onPropertyChange} />
        <CommandList className="max-h-none min-h-0 flex-1 overscroll-contain">
          <CommandGroup>
            <CommandItem
              aria-checked={value.includeCompleted}
              onSelect={() =>
                onChange({
                  ...value,
                  includeCompleted: !value.includeCompleted,
                })
              }
            >
              <CheckBox checked={value.includeCompleted} />
              Incluir tareas completadas
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    );
  }

  const options = property === "project" ? projectOptions : statusOptions;
  const selected = property === "project" ? value.projectIds : value.statuses;
  return (
    <Command
      className="max-h-[min(32rem,70dvh)]"
      shouldFilter={property !== "project"}
    >
      <FilterBackHeader property={property} onBack={onPropertyChange} />
      <CommandInput
        placeholder={`Buscar ${propertyLabels[property].toLowerCase()}`}
        value={property === "project" ? projectSearch : undefined}
        onValueChange={
          property === "project" ? onProjectSearchChange : undefined
        }
      />
      <CommandList
        aria-multiselectable="true"
        className="max-h-none min-h-0 flex-1 overscroll-contain"
      >
        <CommandEmpty>No encontramos opciones.</CommandEmpty>
        <CommandGroup>
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <CommandItem
                key={option.value}
                value={`${option.label} ${option.detail ?? ""}`}
                aria-checked={checked}
                onSelect={() => {
                  const next = checked
                    ? selected.filter((item) => item !== option.value)
                    : [...selected, option.value];
                  onChange(
                    property === "project"
                      ? { ...value, projectIds: next as string[] }
                      : {
                          ...value,
                          statuses: next as ProjectTaskStatus[],
                        },
                  );
                }}
              >
                <CheckBox checked={checked} />
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

function FilterBackHeader({
  property,
  onBack,
}: {
  property: FilterProperty;
  onBack(property: null): void;
}) {
  return (
    <div className="border-border flex items-center border-b px-2 py-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Volver a propiedades"
        onClick={() => onBack(null)}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <span className="text-sm font-semibold">{propertyLabels[property]}</span>
    </div>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "border-border flex size-4 items-center justify-center rounded-sm border",
        checked && "border-primary bg-primary text-primary-foreground",
      )}
    >
      {checked ? <Check aria-hidden="true" className="size-3" /> : null}
    </span>
  );
}

function propertyIsActive(property: FilterProperty, value: MyWorkFilterValue) {
  if (property === "project") return value.projectIds.length > 0;
  if (property === "status") return value.statuses.length > 0;
  if (property === "dates") return Boolean(value.dateFrom || value.dateTo);
  return value.includeCompleted;
}

function MyWorkFilterChips({
  value,
  projectOptions,
  statusOptions,
  onEdit,
  onChange,
}: {
  value: MyWorkFilterValue;
  projectOptions: FilterOption[];
  statusOptions: FilterOption[];
  onEdit(property: FilterProperty): void;
  onChange(value: MyWorkFilterValue): void;
}) {
  const entries: Array<[FilterProperty, string]> = [];
  if (value.projectIds.length) {
    entries.push([
      "project",
      summarizeOptions(value.projectIds, projectOptions),
    ]);
  }
  if (value.statuses.length) {
    entries.push(["status", summarizeOptions(value.statuses, statusOptions)]);
  }
  if (value.dateFrom || value.dateTo) {
    entries.push([
      "dates",
      value.dateFrom && value.dateTo
        ? `${value.dateFrom} – ${value.dateTo}`
        : value.dateFrom || value.dateTo,
    ]);
  }
  if (value.includeCompleted) entries.push(["completed", "Incluir"]);
  if (!entries.length) return null;

  function clear(property: FilterProperty) {
    onChange({
      ...value,
      ...(property === "project"
        ? { projectIds: [] }
        : property === "status"
          ? { statuses: [] }
          : property === "dates"
            ? { dateFrom: "", dateTo: "" }
            : { includeCompleted: false }),
    });
  }

  return (
    <div className="flex max-w-full scrollbar-none gap-2 overflow-x-auto pb-1">
      {entries.map(([property, summary]) => (
        <span
          key={property}
          className="border-border bg-muted inline-flex h-8 shrink-0 items-center rounded-full border text-xs font-medium"
        >
          <button
            type="button"
            className="focus-visible:ring-ring hover:bg-muted-foreground/10 h-full rounded-l-full px-3 outline-none focus-visible:ring-2"
            onClick={() => onEdit(property)}
          >
            {propertyLabels[property]}: {summary}
          </button>
          <button
            type="button"
            aria-label={`Quitar filtro ${propertyLabels[property]}`}
            className="focus-visible:ring-ring hover:bg-muted-foreground/10 mr-1 inline-flex size-7 items-center justify-center rounded-full outline-none focus-visible:ring-2"
            onClick={() => clear(property)}
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        </span>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 shrink-0"
        onClick={() => {
          onChange({
            search: "",
            projectIds: [],
            statuses: [],
            dateFrom: "",
            dateTo: "",
            includeCompleted: false,
          });
        }}
      >
        Limpiar filtros
      </Button>
    </div>
  );
}

function summarizeOptions(values: readonly string[], options: FilterOption[]) {
  const labels = values.map(
    (value) => options.find((option) => option.value === value)?.label ?? value,
  );
  return `${labels.slice(0, 2).join(" + ")}${labels.length > 2 ? ` +${labels.length - 2}` : ""}`;
}
