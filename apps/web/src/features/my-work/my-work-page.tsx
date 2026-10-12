import { useRef, useState } from "react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Check,
  Circle,
  CircleSlash2,
  ListTodo,
  Search,
  SearchX,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppPage, AppPageContent } from "@/features/layout/app-page";
import { AppPageHeader } from "@/features/layout/app-page-header";
import { PortfolioTaskSheet } from "@/features/projects/portfolio-task-sheet";
import { ApiClientError } from "@/lib/api/fetcher";
import type {
  MyAssignedTasksResponse,
  MySupervisionResponse,
  MyWorkTask,
  MyCaseActionsResponse,
  ProjectTask,
  ProjectTaskStatus,
} from "@/lib/api/generated/models";
import {
  getListMyAssignedTasksQueryKey,
  getListMySupervisionQueryKey,
  useListMyAssignedTasks,
  useListMySupervision,
  getListMyCaseActionsQueryKey,
  useListMyCaseActions,
} from "@/lib/api/generated/my-work/my-work";
import {
  useCompleteCaseAction,
  useReopenCaseAction,
} from "@/lib/api/generated/case-actions/case-actions";
import { useListCases } from "@/lib/api/generated/cases/cases";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  getGetProjectTaskScheduleQueryKey,
  getListProjectTaskCalendarQueryKey,
  getListProjectTasksQueryKey,
  getListUndatedProjectTasksQueryKey,
  useUpdateProjectTask,
} from "@/lib/api/generated/project-tasks/project-tasks";
import { MyWorkFilters, type MyWorkFilterValue } from "./my-work-filters";
import { MyWorkSupervisionRow } from "./my-work-supervision-row";
import { MyWorkTaskRow } from "./my-work-task-row";
import { readMyWorkUrlState, type MyWorkView } from "./my-work-url-state";

const PAGE_SIZE = 25;
const groupLabels = {
  overdue: "Vencidas",
  today: "Hoy",
  this_week: "Esta semana",
  future: "A futuro",
  undated: "Sin fecha",
  completed: "Completadas",
} as const;
const groupOrder = [
  "overdue",
  "today",
  "this_week",
  "future",
  "undated",
  "completed",
] as const;

const calendarDateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const calendarMonthFormatter = new Intl.DateTimeFormat("es-PE", {
  month: "short",
  timeZone: "UTC",
});

function calendarDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function addCalendarDays(value: string, days: number) {
  const date = calendarDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatCalendarDate(value: string) {
  return calendarDateFormatter.format(calendarDate(value)).replaceAll(".", "");
}

function formatCalendarRange(start: string, end: string) {
  const startDate = calendarDate(start);
  const endDate = calendarDate(end);
  if (
    startDate.getUTCFullYear() === endDate.getUTCFullYear() &&
    startDate.getUTCMonth() === endDate.getUTCMonth()
  ) {
    const month = calendarMonthFormatter
      .format(endDate)
      .replaceAll(".", "")
      .toLocaleLowerCase("es-PE");
    return `${startDate.getUTCDate()}-${endDate.getUTCDate()} ${month} ${endDate.getUTCFullYear()}`;
  }
  return `${formatCalendarDate(start)}-${formatCalendarDate(end)}`;
}

function groupCalendarScope(group: (typeof groupOrder)[number], today: string) {
  const weekday = calendarDate(today).getUTCDay();
  const mondayOffset = (weekday + 6) % 7;
  const weekStart = addCalendarDays(today, -mondayOffset);
  const weekEnd = addCalendarDays(weekStart, 6);

  if (group === "overdue")
    return `Hasta ${formatCalendarDate(addCalendarDays(today, -1))}`;
  if (group === "today") return formatCalendarDate(today);
  if (group === "this_week") return formatCalendarRange(weekStart, weekEnd);
  if (group === "future")
    return `Desde ${formatCalendarDate(addCalendarDays(weekEnd, 1))}`;
  if (group === "undated") return "Sin periodo completo";
  return "Cualquier periodo";
}
const viewCopy: Record<
  MyWorkView,
  { tab: string; heading: string; description: string }
> = {
  tasks: {
    tab: "Mis tareas",
    heading: "Mis tareas",
    description: "Tareas en las que figuras como encargado activo.",
  },
  supervision: {
    tab: "Bajo mi supervisión",
    heading: "Bajo mi supervisión",
    description: "Proyectos donde eres supervisor principal o compartido.",
  },
  "case-actions": {
    tab: "Acciones de casos",
    heading: "Acciones de casos",
    description: "Acciones pendientes que tienes encargadas dentro de casos.",
  },
};

function PageButtons({
  page,
  totalPages,
  onPage,
  label,
}: {
  page: number;
  totalPages: number;
  onPage(page: number): void;
  label: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label={label}
      className="border-border flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-5"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Anterior
      </Button>
      <span className="text-muted-foreground text-xs font-medium">
        Página {page} de {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        Siguiente
      </Button>
    </nav>
  );
}

function SectionState({
  label,
  message,
  retry,
}: {
  label: string;
  message: string;
  retry?(): void;
}) {
  return (
    <div className="space-y-4 p-7 text-center sm:p-10">
      {retry ? (
        <CircleSlash2
          aria-hidden="true"
          className="text-danger mx-auto size-6"
        />
      ) : (
        <SearchX
          aria-hidden="true"
          className="text-muted-foreground mx-auto size-6"
        />
      )}
      <p className="text-muted-foreground text-sm leading-6">{message}</p>
      {retry ? (
        <Button variant="outline" size="sm" onClick={retry}>
          Intentar de nuevo
        </Button>
      ) : null}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function MyWorkPage() {
  const [params, setParams] = useSearchParams();
  const state = readMyWorkUrlState(params);
  const queryClient = useQueryClient();
  const openerRef = useRef<HTMLElement | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [actionSearch, setActionSearch] = useState(state.search);
  const debouncedActionSearch = useDebouncedValue(actionSearch).trim();
  const updateMutation = useUpdateProjectTask();
  const queryParams = {
    pageSize: PAGE_SIZE,
    ...(state.search ? { search: state.search } : {}),
    ...(state.projectIds.length ? { projectId: state.projectIds } : {}),
    ...(state.statuses.length ? { status: state.statuses } : {}),
    ...(state.dateFrom ? { dateFrom: state.dateFrom } : {}),
    ...(state.dateTo ? { dateTo: state.dateTo } : {}),
    ...(state.includeCompleted ? { includeCompleted: "true" } : {}),
  };
  const assigned = useListMyAssignedTasks(
    { ...queryParams, page: state.assignedPage },
    {
      query: {
        enabled: state.view === "tasks",
        placeholderData: keepPreviousData,
      },
    },
  );
  const supervision = useListMySupervision(
    { ...queryParams, page: state.supervisionPage },
    {
      query: {
        enabled: state.view === "supervision",
        placeholderData: keepPreviousData,
      },
    },
  );
  const caseActions = useListMyCaseActions(
    {
      page: state.actionPage,
      pageSize: PAGE_SIZE,
      ...(debouncedActionSearch ? { search: debouncedActionSearch } : {}),
      ...(state.caseClientIds.length ? { clientId: state.caseClientIds } : {}),
      ...(state.caseIds.length ? { caseId: state.caseIds } : {}),
      ...(state.caseTypes.length ? { type: state.caseTypes } : {}),
      ...(state.includeCompletedActions ? { includeCompleted: "true" } : {}),
    },
    {
      query: {
        enabled: state.view === "case-actions",
        placeholderData: keepPreviousData,
      },
    },
  );
  const cases = useListCases(
    { page: 1, pageSize: 100 },
    { query: { enabled: state.view === "case-actions" } },
  );
  const completeAction = useCompleteCaseAction();
  const reopenAction = useReopenCaseAction();

  function updateUrl(update: (next: URLSearchParams) => void, replace = true) {
    const next = new URLSearchParams(params);
    update(next);
    setParams(next, { replace });
  }

  function selectView(view: MyWorkView) {
    updateUrl((next) => {
      if (view === "tasks") {
        next.delete("view");
        next.delete("assignedPage");
      } else if (view === "supervision") {
        next.set("view", "supervision");
        next.delete("supervisionPage");
      } else {
        next.set("view", "case-actions");
        next.delete("actionPage");
      }
      next.delete("expanded");
      next.delete("expandedPage");
    });
  }

  function setCaseActionFilter(
    key: "caseClient" | "case" | "caseType",
    value: string,
  ) {
    updateUrl((next) => {
      next.delete(key);
      if (value !== "all") next.append(key, value);
      next.delete("actionPage");
    });
  }

  async function toggleCaseAction(
    action: MyCaseActionsResponse["actions"][number],
  ) {
    setMutationError(null);
    try {
      const input = {
        caseId: action.case.id,
        actionId: action.id,
        data: { expectedUpdatedAt: action.updatedAt },
      };
      if (action.status === "completed") await reopenAction.mutateAsync(input);
      else await completeAction.mutateAsync(input);
      await queryClient.invalidateQueries({
        queryKey: getListMyCaseActionsQueryKey(),
      });
    } catch {
      setMutationError(
        "No pudimos cambiar el estado de la acción. Recarga la información e inténtalo nuevamente.",
      );
    }
  }

  function setFilters(filters: MyWorkFilterValue) {
    updateUrl((next) => {
      for (const key of [
        "q",
        "project",
        "status",
        "from",
        "to",
        "completed",
        "assignedPage",
        "supervisionPage",
      ])
        next.delete(key);
      if (filters.search) next.set("q", filters.search);
      filters.projectIds.forEach((id) => next.append("project", id));
      filters.statuses.forEach((status) => next.append("status", status));
      if (filters.dateFrom) next.set("from", filters.dateFrom);
      if (filters.dateTo) next.set("to", filters.dateTo);
      if (filters.includeCompleted) next.set("completed", "1");
    });
  }

  function openTask(projectId: string, taskId: string, opener: HTMLElement) {
    openerRef.current = opener;
    updateUrl((next) => {
      next.set("taskProject", projectId);
      next.set("task", taskId);
    }, false);
  }

  function closeTask() {
    updateUrl((next) => {
      next.delete("taskProject");
      next.delete("task");
    });
  }

  async function invalidate(projectId: string) {
    await Promise.allSettled([
      queryClient.invalidateQueries({
        queryKey: getListMyAssignedTasksQueryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: getListMySupervisionQueryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: getListProjectTasksQueryKey(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: getGetProjectTaskScheduleQueryKey(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: getListProjectTaskCalendarQueryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: getListUndatedProjectTasksQueryKey(),
      }),
    ]);
  }

  async function changeStatus(
    task: { id: string; status: ProjectTaskStatus; project: { id: string } },
    status: ProjectTaskStatus,
  ) {
    if (status === task.status || busyTaskId) return;
    setMutationError(null);
    setBusyTaskId(task.id);
    try {
      await updateMutation.mutateAsync({
        projectId: task.project.id,
        taskId: task.id,
        data: { status },
      });
      await invalidate(task.project.id);
    } catch (error) {
      await invalidate(task.project.id);
      setMutationError(
        error instanceof ApiClientError && error.status === 409
          ? "La tarea cambió mientras actualizabas su estado. Recargamos la información; revísala e inténtalo nuevamente."
          : "No pudimos cambiar el estado. Recarga la información e inténtalo nuevamente.",
      );
    } finally {
      setBusyTaskId(null);
    }
  }

  const grouped = new Map(
    groupOrder.map((group) => [
      group,
      (assigned.data?.tasks ?? []).filter((task) => task.group === group),
    ]),
  );
  const activeQuery =
    state.view === "tasks"
      ? assigned
      : state.view === "supervision"
        ? supervision
        : caseActions;
  const activeTotal = activeQuery.data?.pagination.total;
  const activeResultSummary =
    activeTotal !== undefined && !activeQuery.isPending
      ? `${activeTotal} ${
          state.view === "tasks"
            ? activeTotal === 1
              ? "tarea"
              : "tareas"
            : state.view === "supervision"
              ? activeTotal === 1
                ? "proyecto"
                : "proyectos"
              : activeTotal === 1
                ? "acción"
                : "acciones"
        }`
      : undefined;

  return (
    <AppPage aria-busy={activeQuery.isFetching}>
      <AppPageHeader
        icon={ListTodo}
        eyebrow="Espacio personal"
        title="Mi trabajo"
        description="Tus tareas y los proyectos que supervisas, reunidos en un solo espacio."
      />

      <AppPageContent>
        <section
          aria-label="Cartera de Mi trabajo"
          className="rounded-card border-border bg-card shadow-panel min-w-0 overflow-hidden border"
        >
          <div className="border-border space-y-3 border-b p-4 sm:p-5">
            <Tabs
              value={state.view}
              onValueChange={(view) => selectView(view as MyWorkView)}
            >
              <div className="max-w-full overflow-x-auto pb-1">
                <TabsList aria-label="Vistas de Mi trabajo" variant="line">
                  {(Object.keys(viewCopy) as MyWorkView[]).map((view) => (
                    <TabsTrigger key={view} value={view}>
                      {viewCopy[view].tab}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </Tabs>
            <div className="space-y-1">
              <h2
                id="my-work-list-title"
                className="font-display text-lg font-semibold"
              >
                {viewCopy[state.view].heading}
              </h2>
              <p className="text-muted-foreground text-sm">
                {viewCopy[state.view].description}
              </p>
            </div>
            {state.view !== "case-actions" ? (
              <div className="min-w-0">
                <MyWorkFilters
                  value={{
                    search: state.search,
                    projectIds: state.projectIds,
                    statuses: state.statuses,
                    dateFrom: state.dateFrom,
                    dateTo: state.dateTo,
                    includeCompleted: state.includeCompleted,
                  }}
                  resultSummary={activeResultSummary}
                  onChange={setFilters}
                />
              </div>
            ) : (
              <CaseActionFilters
                search={actionSearch}
                onSearch={(value) => {
                  setActionSearch(value);
                  updateUrl((next) => {
                    const normalized = value.trim();
                    if (normalized) next.set("q", normalized);
                    else next.delete("q");
                    next.delete("actionPage");
                  });
                }}
                cases={cases.data?.cases ?? []}
                clientId={state.caseClientIds[0] ?? "all"}
                caseId={state.caseIds[0] ?? "all"}
                type={state.caseTypes[0] ?? "all"}
                includeCompleted={state.includeCompletedActions}
                resultSummary={activeResultSummary}
                onClient={(value) => setCaseActionFilter("caseClient", value)}
                onCase={(value) => setCaseActionFilter("case", value)}
                onType={(value) => setCaseActionFilter("caseType", value)}
                onCompleted={(checked) =>
                  updateUrl((next) => {
                    if (checked) next.set("actionCompleted", "1");
                    else next.delete("actionCompleted");
                    next.delete("actionPage");
                  })
                }
              />
            )}
            {activeQuery.isPlaceholderData ? (
              <p className="text-muted-foreground text-xs">Actualizando…</p>
            ) : null}
            {mutationError ? (
              <p role="alert" className="text-danger text-sm">
                {mutationError}
              </p>
            ) : null}
          </div>

          {state.view === "tasks" ? (
            <AssignedTasksContent
              grouped={grouped}
              assigned={assigned}
              today={assigned.data?.today ?? ""}
              busyTaskId={busyTaskId}
              onOpenTask={openTask}
              onStatus={(task, status) => void changeStatus(task, status)}
              onPage={(page) =>
                updateUrl((next) =>
                  page === 1
                    ? next.delete("assignedPage")
                    : next.set("assignedPage", String(page)),
                )
              }
            />
          ) : state.view === "supervision" ? (
            <SupervisionContent
              supervision={supervision}
              expandedProjectId={state.expandedProjectId}
              expandedPage={state.expandedPage}
              busyTaskId={busyTaskId}
              onToggle={(projectId) =>
                updateUrl((next) => {
                  if (state.expandedProjectId === projectId) {
                    next.delete("expanded");
                    next.delete("expandedPage");
                  } else {
                    next.set("expanded", projectId);
                    next.delete("expandedPage");
                  }
                })
              }
              onExpandedPage={(page) =>
                updateUrl((next) =>
                  page === 1
                    ? next.delete("expandedPage")
                    : next.set("expandedPage", String(page)),
                )
              }
              onOpenTask={openTask}
              onStatus={(task, projectId, status) =>
                void changeStatus(
                  { ...task, project: { id: projectId } },
                  status,
                )
              }
              onPage={(page) =>
                updateUrl((next) =>
                  page === 1
                    ? next.delete("supervisionPage")
                    : next.set("supervisionPage", String(page)),
                )
              }
            />
          ) : (
            <CaseActionsContent
              query={caseActions}
              busy={completeAction.isPending || reopenAction.isPending}
              onToggle={(action) => void toggleCaseAction(action)}
              onPage={(page) =>
                updateUrl((next) =>
                  page === 1
                    ? next.delete("actionPage")
                    : next.set("actionPage", String(page)),
                )
              }
            />
          )}
        </section>
      </AppPageContent>

      <PortfolioTaskSheet
        taskProjectId={state.taskProjectId}
        taskId={state.taskId}
        open={state.taskId !== null && state.taskProjectId !== null}
        openerRef={openerRef}
        onOpenChange={(open) => {
          if (!open) closeTask();
        }}
        onSaved={() => {
          if (state.taskProjectId) void invalidate(state.taskProjectId);
        }}
      />
    </AppPage>
  );
}

const caseTypeLabels = {
  administrative: "Administrativo",
  judicial: "Judicial",
  constitutional: "Constitucional",
  other: "Otros",
} as const;

function CaseActionFilters({
  search,
  onSearch,
  cases,
  clientId,
  caseId,
  type,
  includeCompleted,
  resultSummary,
  onClient,
  onCase,
  onType,
  onCompleted,
}: {
  search: string;
  onSearch(value: string): void;
  cases: Array<{
    id: string;
    identification: string;
    type: keyof typeof caseTypeLabels | null;
    client: { id: string; name: string };
  }>;
  clientId: string;
  caseId: string;
  type: string;
  includeCompleted: boolean;
  resultSummary?: string;
  onClient(value: string): void;
  onCase(value: string): void;
  onType(value: string): void;
  onCompleted(value: boolean): void;
}) {
  const clients = [
    ...new Map(cases.map((item) => [item.client.id, item.client])).values(),
  ];
  return (
    <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center">
      <label className="relative min-w-0 flex-1 xl:max-w-xl">
        <span className="sr-only">Buscar acciones de casos</span>
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Buscar acción, caso o cliente"
          className="h-11 pl-9 lg:h-9"
        />
      </label>
      <div className="flex max-w-full gap-2 overflow-x-auto pb-1 xl:pb-0">
        <Select value={clientId} onValueChange={onClient}>
          <SelectTrigger size="sm" className="min-w-36">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={caseId} onValueChange={onCase}>
          <SelectTrigger size="sm" className="min-w-36">
            <SelectValue placeholder="Caso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los casos</SelectItem>
            {cases
              .filter(
                (item) => clientId === "all" || item.client.id === clientId,
              )
              .map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.identification}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={onType}>
          <SelectTrigger size="sm" className="min-w-32">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(caseTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant={includeCompleted ? "secondary" : "outline"}
          size="sm"
          className="whitespace-nowrap"
          onClick={() => onCompleted(!includeCompleted)}
        >
          {includeCompleted ? <Check aria-hidden="true" /> : null}Incluir
          completadas
        </Button>
      </div>
      {resultSummary ? (
        <span className="text-muted-foreground shrink-0 text-xs font-medium">
          {resultSummary}
        </span>
      ) : null}
    </div>
  );
}

function CaseActionsContent({
  query,
  busy,
  onToggle,
  onPage,
}: {
  query: {
    data?: MyCaseActionsResponse;
    isPending: boolean;
    isError: boolean;
    refetch(): unknown;
  };
  busy: boolean;
  onToggle(action: MyCaseActionsResponse["actions"][number]): void;
  onPage(page: number): void;
}) {
  if (query.isPending && !query.data)
    return (
      <div aria-label="Cargando acciones de casos" className="space-y-3 p-5">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  if (query.isError && !query.data)
    return (
      <SectionState
        label="Error en acciones"
        message="No pudimos cargar tus acciones de casos."
        retry={() => void query.refetch()}
      />
    );
  if (!query.data?.actions.length)
    return (
      <SectionState
        label="Sin acciones"
        message="No tienes acciones de casos que coincidan con estos filtros."
      />
    );
  const groups = new Map<
    string,
    {
      case: MyCaseActionsResponse["actions"][number]["case"];
      actions: MyCaseActionsResponse["actions"];
    }
  >();
  for (const action of query.data.actions) {
    const current = groups.get(action.case.id);
    if (current) current.actions.push(action);
    else groups.set(action.case.id, { case: action.case, actions: [action] });
  }
  return (
    <>
      <div className="divide-border divide-y">
        {[...groups.values()].map((group) => (
          <section key={group.case.id}>
            <div className="border-border bg-muted/35 flex min-w-0 items-center justify-between gap-4 border-b px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <span className="text-muted-foreground block truncate text-xs font-medium">
                  {group.case.client.name}
                </span>
                <Link
                  to={`/cases/${group.case.id}`}
                  className="focus-visible:ring-ring hover:text-primary mt-0.5 block w-fit max-w-full rounded-sm text-sm font-semibold outline-none hover:underline focus-visible:ring-2"
                >
                  <span className="block truncate">
                    {group.case.identification}
                  </span>
                </Link>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-muted-foreground hidden text-xs sm:inline">
                  {group.case.type
                    ? caseTypeLabels[group.case.type]
                    : "Sin tipo"}
                </span>
                <span className="text-muted-foreground text-xs font-medium">
                  {group.actions.length}{" "}
                  {group.actions.length === 1 ? "acción" : "acciones"}
                </span>
              </div>
            </div>
            <ul className="divide-border divide-y">
              {group.actions.map((action) => (
                <li
                  key={action.id}
                  className="flex min-w-0 items-center gap-3 px-4 py-3 sm:px-5"
                >
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={
                      action.status === "completed"
                        ? "Reabrir acción"
                        : "Completar acción"
                    }
                    onClick={() => onToggle(action)}
                    className="border-border focus-visible:ring-ring hover:border-primary flex size-6 shrink-0 items-center justify-center rounded-full border outline-none focus-visible:ring-2"
                  >
                    {action.status === "completed" ? (
                      <Check
                        aria-hidden="true"
                        className="text-success size-4"
                      />
                    ) : (
                      <Circle
                        aria-hidden="true"
                        className="text-muted-foreground size-3"
                      />
                    )}
                  </button>
                  <p
                    className={
                      action.status === "completed"
                        ? "text-muted-foreground min-w-0 flex-1 text-sm line-through"
                        : "min-w-0 flex-1 text-sm"
                    }
                  >
                    {action.description}
                  </p>
                  <Link
                    to={`/cases/${group.case.id}`}
                    className="text-primary shrink-0 text-xs font-semibold hover:underline"
                  >
                    Ver caso
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <PageButtons
        page={query.data.pagination.page}
        totalPages={query.data.pagination.totalPages}
        onPage={onPage}
        label="Paginación de acciones de casos"
      />
    </>
  );
}

function AssignedTasksContent({
  grouped,
  assigned,
  today,
  busyTaskId,
  onOpenTask,
  onStatus,
  onPage,
}: {
  grouped: Map<(typeof groupOrder)[number], MyWorkTask[]>;
  assigned: {
    data?: MyAssignedTasksResponse;
    isPending: boolean;
    isError: boolean;
    refetch(): unknown;
  };
  today: string;
  busyTaskId: string | null;
  onOpenTask(projectId: string, taskId: string, opener: HTMLElement): void;
  onStatus(task: MyWorkTask, status: ProjectTaskStatus): void;
  onPage(page: number): void;
}) {
  if (assigned.isPending && !assigned.data) {
    return (
      <div aria-label="Cargando mis tareas" className="space-y-3 p-5">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }
  if (assigned.isError && !assigned.data) {
    return (
      <SectionState
        label="Error en mis tareas"
        message="No pudimos cargar tus tareas asignadas."
        retry={() => void assigned.refetch()}
      />
    );
  }
  if (assigned.data && !assigned.data.tasks.length) {
    return (
      <SectionState
        label="Sin tareas"
        message="No tienes tareas asignadas que coincidan con estos filtros."
      />
    );
  }
  return (
    <>
      {assigned.isError && assigned.data ? (
        <div className="border-border border-b">
          <SectionState
            label="Error de actualización"
            message="Mostramos la última información disponible. No pudimos actualizar tus tareas."
            retry={() => void assigned.refetch()}
          />
        </div>
      ) : null}
      <div className="divide-border divide-y">
        {groupOrder.map((group) => {
          const tasks = grouped.get(group) ?? [];
          const projectGroups = groupAssignedTasksByProject(tasks);
          return tasks.length ? (
            <section key={group} aria-labelledby={`my-work-group-${group}`}>
              <div className="border-border bg-muted/35 flex min-h-11 items-center gap-2 border-b px-4 py-2 sm:px-5">
                <CalendarClock
                  aria-hidden="true"
                  className="text-primary size-4 shrink-0"
                />
                <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-3">
                  <div className="flex items-baseline gap-2">
                    <h3
                      id={`my-work-group-${group}`}
                      className="text-sm font-semibold"
                    >
                      {groupLabels[group]}
                    </h3>
                    <span className="text-muted-foreground text-xs font-medium">
                      {tasks.length}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs font-medium tabular-nums sm:ml-auto">
                    {groupCalendarScope(group, today)}
                  </span>
                </div>
              </div>
              <div className="divide-border divide-y">
                {projectGroups.map(({ project, tasks: projectTasks }) => {
                  const taskCountLabel =
                    projectTasks.length === 1
                      ? "1 tarea"
                      : `${projectTasks.length} tareas`;
                  return (
                    <div
                      key={project.id}
                      role="group"
                      aria-label={`${project.client.name}, ${project.name}, ${taskCountLabel}`}
                    >
                      <div className="border-border bg-background flex min-h-12 min-w-0 items-center justify-between gap-4 border-b px-4 py-2.5 sm:px-5">
                        <div className="min-w-0">
                          <span className="text-muted-foreground block truncate text-xs font-medium">
                            {project.client.name}
                          </span>
                          <Link
                            to={`/projects/${project.id}`}
                            className="text-foreground hover:text-primary focus-visible:ring-ring mt-0.5 block w-fit max-w-full rounded-sm text-sm font-semibold outline-none hover:underline focus-visible:ring-2"
                          >
                            <span className="block truncate">
                              {project.name}
                            </span>
                          </Link>
                        </div>
                        <span className="text-muted-foreground shrink-0 text-xs font-medium">
                          {taskCountLabel}
                        </span>
                      </div>
                      <div className="divide-border divide-y">
                        {projectTasks.map((task) => (
                          <MyWorkTaskRow
                            key={task.id}
                            task={task}
                            busy={busyTaskId !== null}
                            showProjectContext={false}
                            onOpen={(opener) =>
                              onOpenTask(task.project.id, task.id, opener)
                            }
                            onStatus={(status) => onStatus(task, status)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null;
        })}
      </div>
      {assigned.data ? (
        <PageButtons
          page={assigned.data.pagination.page}
          totalPages={assigned.data.pagination.totalPages}
          onPage={onPage}
          label="Paginación de mis tareas"
        />
      ) : null}
    </>
  );
}

function groupAssignedTasksByProject(tasks: MyWorkTask[]) {
  const groups = new Map<
    string,
    { project: MyWorkTask["project"]; tasks: MyWorkTask[] }
  >();

  for (const task of tasks) {
    const existing = groups.get(task.project.id);
    if (existing) existing.tasks.push(task);
    else groups.set(task.project.id, { project: task.project, tasks: [task] });
  }

  return [...groups.values()];
}

function SupervisionContent({
  supervision,
  expandedProjectId,
  expandedPage,
  busyTaskId,
  onToggle,
  onExpandedPage,
  onOpenTask,
  onStatus,
  onPage,
}: {
  supervision: {
    data?: MySupervisionResponse;
    isPending: boolean;
    isError: boolean;
    refetch(): unknown;
  };
  expandedProjectId: string | null;
  expandedPage: number;
  busyTaskId: string | null;
  onToggle(projectId: string): void;
  onExpandedPage(page: number): void;
  onOpenTask(projectId: string, taskId: string, opener: HTMLElement): void;
  onStatus(
    task: MyWorkTask | ProjectTask,
    projectId: string,
    status: ProjectTaskStatus,
  ): void;
  onPage(page: number): void;
}) {
  if (supervision.isPending && !supervision.data) {
    return (
      <div
        aria-label="Cargando proyectos supervisados"
        className="space-y-3 p-5"
      >
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }
  if (supervision.isError && !supervision.data) {
    return (
      <SectionState
        label="Error en supervisión"
        message="No pudimos cargar tus proyectos supervisados."
        retry={() => void supervision.refetch()}
      />
    );
  }
  if (supervision.data && !supervision.data.projects.length) {
    return (
      <SectionState
        label="Sin supervisión"
        message="No supervisas proyectos activos que coincidan con estos filtros."
      />
    );
  }
  return (
    <>
      {supervision.isError && supervision.data ? (
        <div className="border-border border-b">
          <SectionState
            label="Error de actualización"
            message="Mostramos la última información disponible. No pudimos actualizar la supervisión."
            retry={() => void supervision.refetch()}
          />
        </div>
      ) : null}
      <div className="divide-border divide-y">
        {(supervision.data?.projects ?? []).map((project) => (
          <MyWorkSupervisionRow
            key={project.id}
            project={project}
            expanded={expandedProjectId === project.id}
            expandedPage={expandedPage}
            busyTaskId={busyTaskId}
            onToggle={() => onToggle(project.id)}
            onExpandedPage={onExpandedPage}
            onOpenTask={(task, opener) =>
              onOpenTask(project.id, task.id, opener)
            }
            onStatus={(task, status) => onStatus(task, project.id, status)}
          />
        ))}
      </div>
      {supervision.data ? (
        <PageButtons
          page={supervision.data.pagination.page}
          totalPages={supervision.data.pagination.totalPages}
          onPage={onPage}
          label="Paginación de proyectos supervisados"
        />
      ) : null}
    </>
  );
}
