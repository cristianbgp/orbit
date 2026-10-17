import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { ProjectTaskStatus } from "@/lib/api/generated/models";
import { useListProjects } from "@/lib/api/generated/projects/projects";
import { useListTeamMembers } from "@/lib/api/generated/team/team";
import { cn } from "@/lib/utils";
import { PROJECT_TASK_STATUS_LABELS } from "./project-task-labels";

export type ProjectTaskCalendarFilterState = {
  search: string;
  projectIds: string[];
  responsibleUserIds: string[];
  statuses: ProjectTaskStatus[];
  overdueOnly: boolean;
};

export const EMPTY_PROJECT_TASK_CALENDAR_FILTERS: ProjectTaskCalendarFilterState =
  {
    search: "",
    projectIds: [],
    responsibleUserIds: [],
    statuses: [],
    overdueOnly: false,
  };

type FilterOption = { value: string; label: string; detail?: string };

export function MultiSelectFilter({
  label,
  searchLabel,
  emptyLabel,
  options,
  selected,
  searchValue,
  onSearchValueChange,
  onSelectedChange,
}: {
  label: string;
  searchLabel: string;
  emptyLabel: string;
  options: FilterOption[];
  selected: string[];
  searchValue?: string;
  onSearchValueChange?(value: string): void;
  onSelectedChange(selected: string[]): void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-11 justify-between lg:h-9">
          <span>
            {label}
            {selected.length > 0 ? ` (${selected.length})` : ""}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="text-muted-foreground size-4"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <Command>
          <CommandInput
            placeholder={searchLabel}
            {...(onSearchValueChange
              ? { value: searchValue, onValueChange: onSearchValueChange }
              : {})}
          />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const checked = selected.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.detail ?? ""}`}
                    aria-label={`${option.label}${option.detail ? ` ${option.detail}` : ""}`}
                    onSelect={() =>
                      onSelectedChange(
                        checked
                          ? selected.filter((item) => item !== option.value)
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
                      <input
                        type="checkbox"
                        aria-label={`${option.label}${option.detail ? ` ${option.detail}` : ""}`}
                        checked={checked}
                        readOnly
                        tabIndex={-1}
                        className="sr-only"
                      />
                      {checked ? <Check className="size-3" /> : null}
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
      </PopoverContent>
    </Popover>
  );
}

function FilterChip({
  label,
  removeLabel,
  onRemove,
}: {
  label: string;
  removeLabel: string;
  onRemove(): void;
}) {
  return (
    <span className="border-border bg-muted text-foreground inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-medium">
      <span className="max-w-48 truncate">{label}</span>
      <button
        type="button"
        aria-label={removeLabel}
        className="hover:bg-border focus-visible:ring-ring inline-flex size-6 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
        onClick={onRemove}
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </span>
  );
}

export function ProjectTaskCalendarFilters({
  value,
  onChange,
}: {
  value: ProjectTaskCalendarFilterState;
  onChange(value: ProjectTaskCalendarFilterState): void;
}) {
  const [search, setSearch] = useState(value.search);
  const [projectOptionSearch, setProjectOptionSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const debouncedProjectSearch = useDebouncedValue(projectOptionSearch).trim();
  const projectsQuery = useListProjects({
    view: "current",
    page: 1,
    pageSize: 100,
    ...(debouncedProjectSearch ? { search: debouncedProjectSearch } : {}),
  });
  const membersQuery = useListTeamMembers({ page: 1, pageSize: 100 });
  const projectLabelCache = useRef(new Map<string, string>());
  const memberLabelCache = useRef(new Map<string, string>());

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
  const memberOptions = (membersQuery.data?.members ?? []).map((member) => ({
    value: member.userId,
    label: member.alias,
    detail: member.name,
  }));
  const statusOptions = Object.entries(PROJECT_TASK_STATUS_LABELS).map(
    ([status, label]) => ({ value: status, label }),
  );
  for (const option of projectOptions) {
    projectLabelCache.current.set(option.value, option.label);
  }
  for (const option of memberOptions) {
    memberLabelCache.current.set(option.value, option.label);
  }
  const hasFilters =
    value.search !== "" ||
    value.projectIds.length > 0 ||
    value.responsibleUserIds.length > 0 ||
    value.statuses.length > 0 ||
    value.overdueOnly;

  return (
    <div className="space-y-3" aria-label="Filtros del calendario de tareas">
      <div className="grid gap-2 lg:grid-cols-[minmax(14rem,1fr)_auto_auto_auto_auto]">
        <Input
          type="search"
          aria-label="Buscar tareas"
          placeholder="Buscar tarea, proyecto o cliente"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <MultiSelectFilter
          label="Proyectos"
          searchLabel="Buscar proyecto"
          emptyLabel="No encontramos proyectos."
          options={projectOptions}
          selected={value.projectIds}
          searchValue={projectOptionSearch}
          onSearchValueChange={setProjectOptionSearch}
          onSelectedChange={(projectIds) => onChange({ ...value, projectIds })}
        />
        <MultiSelectFilter
          label="Encargados"
          searchLabel="Buscar encargado"
          emptyLabel="No encontramos encargados."
          options={memberOptions}
          selected={value.responsibleUserIds}
          onSelectedChange={(responsibleUserIds) =>
            onChange({ ...value, responsibleUserIds })
          }
        />
        <MultiSelectFilter
          label="Estados"
          searchLabel="Buscar estado"
          emptyLabel="No encontramos estados."
          options={statusOptions}
          selected={value.statuses}
          onSelectedChange={(statuses) =>
            onChange({ ...value, statuses: statuses as ProjectTaskStatus[] })
          }
        />
        <label className="border-border bg-background inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium shadow-xs">
          <input
            type="checkbox"
            checked={value.overdueOnly}
            onChange={(event) =>
              onChange({ ...value, overdueOnly: event.target.checked })
            }
          />
          Solo vencidas
        </label>
      </div>

      {(projectsQuery.data?.pagination.total ?? 0) > 100 ? (
        <p className="text-muted-foreground text-xs">
          Busca por nombre para encontrar proyectos fuera de los primeros 100
          resultados.
        </p>
      ) : null}
      {(membersQuery.data?.pagination.total ?? 0) > 100 ? (
        <p className="text-muted-foreground text-xs">
          Solo se muestran los primeros 100 integrantes del estudio.
        </p>
      ) : null}

      {hasFilters ? (
        <div className="flex flex-wrap items-center gap-2">
          {value.projectIds.map((id) => (
            <FilterChip
              key={id}
              label={projectLabelCache.current.get(id) ?? id}
              removeLabel={`Quitar proyecto ${projectLabelCache.current.get(id) ?? id}`}
              onRemove={() =>
                onChange({
                  ...value,
                  projectIds: value.projectIds.filter((item) => item !== id),
                })
              }
            />
          ))}
          {value.responsibleUserIds.map((id) => (
            <FilterChip
              key={id}
              label={memberLabelCache.current.get(id) ?? id}
              removeLabel={`Quitar encargado ${memberLabelCache.current.get(id) ?? id}`}
              onRemove={() =>
                onChange({
                  ...value,
                  responsibleUserIds: value.responsibleUserIds.filter(
                    (item) => item !== id,
                  ),
                })
              }
            />
          ))}
          {value.statuses.map((status) => (
            <FilterChip
              key={status}
              label={PROJECT_TASK_STATUS_LABELS[status]}
              removeLabel={`Quitar estado ${PROJECT_TASK_STATUS_LABELS[status]}`}
              onRemove={() =>
                onChange({
                  ...value,
                  statuses: value.statuses.filter((item) => item !== status),
                })
              }
            />
          ))}
          <Button
            variant="ghost"
            size="sm"
            aria-label="Limpiar filtros del calendario"
            onClick={() => onChange(EMPTY_PROJECT_TASK_CALENDAR_FILTERS)}
          >
            Limpiar filtros
          </Button>
        </div>
      ) : null}
    </div>
  );
}
