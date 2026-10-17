import { useEffect, useRef, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { FolderKanban, UserRoundCheck } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppPage, AppPageContent } from "@/features/layout/app-page";
import { AppPageHeader } from "@/features/layout/app-page-header";
import { useOrganizationCalendar } from "@/features/organization/organization-calendar-context";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useListProjects,
  useListProjectsGroupedByClient,
} from "@/lib/api/generated/projects/projects";
import type {
  ProjectOrder,
  ProjectOrderBy,
  ProjectStatus,
  ProjectView,
} from "@/lib/api/generated/models";
import { ProjectClientGroups, ProjectListRow } from "./project-client-groups";
import {
  ProjectPortfolioDisplayOptions,
  type ProjectGrouping,
} from "./project-portfolio-display-options";
import {
  readProjectPortfolioFilters,
  replaceRepeatedParam,
  type ProjectPortfolioFilters,
} from "./project-portfolio-filter-state";
import { ProjectPortfolioFiltersBar } from "./project-portfolio-filters";
import { ProjectStatusGroups } from "./project-status-groups";

const PAGE_SIZE = 25;
const CLIENT_PAGE_SIZE = 10;
const legacyPortfolioKeys = [
  "display",
  "month",
  "project",
  "responsible",
  "taskStatus",
  "overdue",
  "taskProject",
  "task",
] as const;

const projectGroupings = new Set<ProjectGrouping>(["client", "status", "none"]);
const projectViews = new Set<ProjectView>(["current", "completed", "archived"]);
const projectOrderFields = new Set<ProjectOrderBy>([
  "endDate",
  "startDate",
  "name",
  "archivedAt",
]);
const projectOrders = new Set<ProjectOrder>(["asc", "desc"]);

function portfolioDefaults(view: ProjectView) {
  if (view === "archived") {
    return { orderBy: "archivedAt", order: "desc" } as const;
  }
  return {
    orderBy: "endDate",
    order: view === "completed" ? "desc" : "asc",
  } as const;
}

const portfolioViewCopy: Record<
  ProjectView,
  { tab: string; heading: string; emptyTitle: string; emptyDescription: string }
> = {
  current: {
    tab: "En curso",
    heading: "Proyectos en curso",
    emptyTitle: "Tu cartera empieza aquí",
    emptyDescription:
      "Crea el primer proyecto para organizar el trabajo y sus fechas clave.",
  },
  completed: {
    tab: "Completados",
    heading: "Proyectos completados",
    emptyTitle: "Aún no hay proyectos completados",
    emptyDescription:
      "Los proyectos finalizados aparecerán aquí mientras sigan disponibles en la cartera.",
  },
  archived: {
    tab: "Archivados",
    heading: "Proyectos archivados",
    emptyTitle: "Aún no hay proyectos archivados",
    emptyDescription:
      "Los proyectos que archives aparecerán aquí y conservarán todo su historial.",
  },
};

function viewSupportsStatusGrouping(view: ProjectView) {
  return view === "current" || view === "archived";
}

function statusesForView(view: ProjectView): ProjectStatus[] {
  if (view === "current") return ["draft", "active"];
  if (view === "archived") {
    return ["draft", "active", "completed"];
  }
  return [];
}

function readEnumValue<Value extends string>(
  value: string | null,
  values: Set<Value>,
  fallback: Value,
) {
  return value && values.has(value as Value) ? (value as Value) : fallback;
}

export function ProjectsPage({
  currentUserId,
  today: todayOverride,
}: {
  currentUserId: string;
  today?: string;
}) {
  const { today: organizationToday } = useOrganizationCalendar();
  const today = todayOverride ?? organizationToday;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const previousUrlSearch = useRef(searchParams.get("q") ?? "");
  const [page, setPage] = useState(1);
  const normalizedSearch = useDebouncedValue(search).trim();
  const parsedFilters = readProjectPortfolioFilters(searchParams);
  const view = readEnumValue(searchParams.get("view"), projectViews, "current");
  const allowedStatuses = statusesForView(view);
  const filters = {
    ...parsedFilters,
    statuses: parsedFilters.statuses.filter((status) =>
      allowedStatuses.includes(status),
    ),
  };
  const defaults = portfolioDefaults(view);
  const requestedGrouping = readEnumValue(
    searchParams.get("groupBy"),
    projectGroupings,
    "client",
  );
  const groupBy =
    requestedGrouping === "status" && !viewSupportsStatusGrouping(view)
      ? "client"
      : requestedGrouping;
  const requestedOrderBy = readEnumValue(
    searchParams.get("orderBy"),
    projectOrderFields,
    defaults.orderBy,
  );
  const hasUnsupportedOrderBy =
    requestedOrderBy === "archivedAt" && view !== "archived";
  const hasUnsupportedStatusFilter =
    parsedFilters.statuses.length !== filters.statuses.length;
  const rawFilterCounts =
    searchParams.getAll("status").length +
    searchParams.getAll("type").length +
    searchParams.getAll("client").length +
    searchParams.getAll("member").length;
  const canonicalFilterCount =
    filters.statuses.length +
    filters.types.length +
    filters.clientIds.length +
    filters.memberUserIds.length;
  const hasInvalidContentFilters = rawFilterCounts !== canonicalFilterCount;
  const orderBy = hasUnsupportedOrderBy ? defaults.orderBy : requestedOrderBy;
  const order = hasUnsupportedOrderBy
    ? defaults.order
    : readEnumValue(searchParams.get("order"), projectOrders, defaults.order);
  const typeKey = filters.types.join("\u0000");
  const statusKey = filters.statuses.join("\u0000");
  const clientKey = filters.clientIds.join("\u0000");
  const memberKey = filters.memberUserIds.join("\u0000");
  const isMyProjects = filters.memberUserIds.includes(currentUserId);

  useEffect(() => {
    if (searchParams.get("action") === "create") {
      navigate("/projects/new", { replace: true });
    }
  }, [navigate, searchParams]);

  useEffect(() => {
    const urlSearch = searchParams.get("q") ?? "";
    if (urlSearch === previousUrlSearch.current) return;
    previousUrlSearch.current = urlSearch;
    if (urlSearch !== search) setSearch(urlSearch);
  }, [search, searchParams]);

  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (current === normalizedSearch) return;
    const next = new URLSearchParams(searchParams);
    if (normalizedSearch) next.set("q", normalizedSearch);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  }, [normalizedSearch, searchParams, setSearchParams]);

  useEffect(() => {
    const hasLegacyState = legacyPortfolioKeys.some((key) =>
      searchParams.has(key),
    );
    const requestedView = searchParams.get("view");
    const hasInvalidView =
      requestedView !== null && !projectViews.has(requestedView as ProjectView);
    const hasUnsupportedGrouping =
      requestedGrouping === "status" && !viewSupportsStatusGrouping(view);
    const hasInvalidState =
      hasInvalidView ||
      hasUnsupportedGrouping ||
      hasUnsupportedOrderBy ||
      hasUnsupportedStatusFilter ||
      hasInvalidContentFilters ||
      (searchParams.has("groupBy") &&
        !projectGroupings.has(
          searchParams.get("groupBy") as ProjectGrouping,
        )) ||
      (searchParams.has("orderBy") &&
        !projectOrderFields.has(
          searchParams.get("orderBy") as ProjectOrderBy,
        )) ||
      (searchParams.has("order") &&
        !projectOrders.has(searchParams.get("order") as ProjectOrder));
    if (!hasLegacyState && !hasInvalidState) return;

    const next = new URLSearchParams(searchParams);
    for (const key of legacyPortfolioKeys) next.delete(key);
    if (hasInvalidView) next.delete("view");
    if (hasInvalidContentFilters) {
      replaceRepeatedParam(next, "status", filters.statuses);
      replaceRepeatedParam(next, "type", filters.types);
      replaceRepeatedParam(next, "client", filters.clientIds);
      replaceRepeatedParam(next, "member", filters.memberUserIds);
    }
    if (hasUnsupportedStatusFilter) next.delete("status");
    next.set("groupBy", groupBy);
    next.set("orderBy", orderBy);
    next.set("order", order);
    setSearchParams(next, { replace: true });
  }, [
    groupBy,
    hasInvalidContentFilters,
    hasUnsupportedStatusFilter,
    hasUnsupportedOrderBy,
    order,
    orderBy,
    requestedGrouping,
    searchParams,
    setSearchParams,
    view,
    clientKey,
    memberKey,
    statusKey,
    typeKey,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    normalizedSearch,
    typeKey,
    statusKey,
    clientKey,
    memberKey,
    view,
    groupBy,
    orderBy,
    order,
  ]);

  const sharedParams = {
    ...(normalizedSearch ? { search: normalizedSearch } : {}),
    ...(filters.types.length ? { type: filters.types } : {}),
    ...(filters.statuses.length ? { status: filters.statuses } : {}),
    ...(filters.clientIds.length ? { client: filters.clientIds } : {}),
    ...(filters.memberUserIds.length ? { member: filters.memberUserIds } : {}),
    view,
    orderBy,
    order,
  };
  const projectsQuery = useListProjects(
    { ...sharedParams, page, pageSize: PAGE_SIZE },
    {
      query: {
        placeholderData: keepPreviousData,
        enabled: groupBy === "none",
      },
    },
  );
  const groupedProjectsQuery = useListProjectsGroupedByClient(
    { ...sharedParams, page, pageSize: CLIENT_PAGE_SIZE },
    {
      query: {
        placeholderData: keepPreviousData,
        enabled: groupBy === "client",
      },
    },
  );
  const activeListQuery =
    groupBy === "client" ? groupedProjectsQuery : projectsQuery;
  const projects = projectsQuery.data?.projects ?? [];
  const projectGroups = groupedProjectsQuery.data?.groups ?? [];
  const pagination = activeListQuery.data?.pagination;
  const projectTotal =
    groupBy === "client"
      ? (groupedProjectsQuery.data?.projectTotal ?? 0)
      : (projectsQuery.data?.pagination.total ?? 0);
  const hasListResults =
    groupBy === "client" ? projectGroups.length > 0 : projects.length > 0;
  const hasFilters = Boolean(
    normalizedSearch ||
    filters.types.length ||
    filters.statuses.length ||
    filters.clientIds.length ||
    filters.memberUserIds.length,
  );

  function updateSearchParams(update: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams);
    update(next);
    setSearchParams(next, { replace: true });
  }

  function selectView(nextView: ProjectView) {
    const nextDefaults = portfolioDefaults(nextView);
    setPage(1);
    updateSearchParams((next) => {
      if (nextView === "current") next.delete("view");
      else next.set("view", nextView);
      replaceRepeatedParam(
        next,
        "status",
        filters.statuses.filter((status) =>
          statusesForView(nextView).includes(status),
        ),
      );
      if (!viewSupportsStatusGrouping(nextView) && groupBy === "status") {
        next.set("groupBy", "client");
      }
      next.set("orderBy", nextDefaults.orderBy);
      next.set("order", nextDefaults.order);
    });
  }

  function changeFilters(nextFilters: ProjectPortfolioFilters) {
    setPage(1);
    updateSearchParams((next) => {
      replaceRepeatedParam(next, "status", nextFilters.statuses);
      replaceRepeatedParam(next, "type", nextFilters.types);
      replaceRepeatedParam(next, "client", nextFilters.clientIds);
      replaceRepeatedParam(next, "member", nextFilters.memberUserIds);
    });
  }

  function toggleMyProjects() {
    changeFilters({
      ...filters,
      memberUserIds: isMyProjects
        ? filters.memberUserIds.filter((userId) => userId !== currentUserId)
        : [currentUserId],
    });
  }

  function selectGrouping(grouping: ProjectGrouping) {
    setPage(1);
    updateSearchParams((next) => next.set("groupBy", grouping));
  }

  function selectOrderBy(nextOrderBy: ProjectOrderBy) {
    setPage(1);
    updateSearchParams((next) => next.set("orderBy", nextOrderBy));
  }

  function selectOrder(nextOrder: ProjectOrder) {
    setPage(1);
    updateSearchParams((next) => next.set("order", nextOrder));
  }

  return (
    <AppPage>
      <AppPageHeader
        icon={FolderKanban}
        eyebrow="Cartera legal"
        title="Proyectos"
        description="Revisa los asuntos del estudio por cliente o estado, junto con su periodo y equipo activo."
        actions={
          <Button
            className="w-full active:translate-y-px sm:w-auto"
            onClick={() => navigate("/projects/new")}
          >
            Nuevo proyecto
          </Button>
        }
      />

      <AppPageContent>
        <section
          aria-labelledby="project-list-title"
          aria-busy={groupBy !== "status" && activeListQuery.isPlaceholderData}
          className="rounded-card border-border bg-card shadow-panel min-w-0 overflow-hidden border"
        >
          <div className="border-border space-y-3 border-b p-4 sm:p-5">
            <Tabs
              value={view}
              onValueChange={(next) => selectView(next as ProjectView)}
            >
              <div className="max-w-full overflow-x-auto pb-1">
                <TabsList aria-label="Vistas de proyectos" variant="line">
                  {(Object.keys(portfolioViewCopy) as ProjectView[]).map(
                    (tabView) => (
                      <TabsTrigger key={tabView} value={tabView}>
                        {portfolioViewCopy[tabView].tab}
                      </TabsTrigger>
                    ),
                  )}
                </TabsList>
              </div>
            </Tabs>
            <div className="flex items-center gap-3">
              <h2
                id="project-list-title"
                className="font-display text-lg font-semibold"
              >
                {portfolioViewCopy[view].heading}
              </h2>
            </div>

            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <ProjectPortfolioFiltersBar
                search={search}
                filters={filters}
                statusOptions={allowedStatuses}
                onSearchChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
                onFiltersChange={changeFilters}
              />
              <div
                data-slot="project-portfolio-actions"
                className="flex shrink-0 items-center justify-between gap-2 lg:justify-end"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={isMyProjects}
                  className="aria-pressed:border-primary/40 aria-pressed:bg-primary/10 aria-pressed:text-primary-strong h-11 gap-2 lg:h-9"
                  onClick={toggleMyProjects}
                >
                  <UserRoundCheck aria-hidden="true" />
                  Mis proyectos
                </Button>
                {groupBy !== "status" &&
                !activeListQuery.isPending &&
                !activeListQuery.isError ? (
                  <span className="text-muted-foreground text-xs font-medium">
                    {projectTotal}{" "}
                    {projectTotal === 1 ? "proyecto" : "proyectos"}
                  </span>
                ) : null}
                <ProjectPortfolioDisplayOptions
                  view={view}
                  groupBy={groupBy}
                  orderBy={orderBy}
                  order={order}
                  onGroupingChange={selectGrouping}
                  onOrderByChange={selectOrderBy}
                  onOrderChange={selectOrder}
                />
              </div>
            </div>
            {groupBy !== "status" && activeListQuery.isPlaceholderData ? (
              <p className="text-muted-foreground text-xs">Actualizando…</p>
            ) : null}
          </div>

          {groupBy === "status" ? (
            <ProjectStatusGroups
              filters={{
                ...(normalizedSearch ? { search: normalizedSearch } : {}),
                ...(filters.types.length ? { types: filters.types } : {}),
                ...(filters.clientIds.length
                  ? { clientIds: filters.clientIds }
                  : {}),
                ...(filters.memberUserIds.length
                  ? { memberUserIds: filters.memberUserIds }
                  : {}),
                ...(filters.statuses.length
                  ? { selectedStatuses: filters.statuses }
                  : {}),
                view,
                orderBy,
                order,
              }}
              today={today}
              onOpenProject={(projectId) => navigate(`/projects/${projectId}`)}
            />
          ) : activeListQuery.isPending ? (
            <div aria-label="Cargando proyectos" className="space-y-3 p-5">
              {[0, 1, 2].map((item) => (
                <div key={item} className="space-y-2">
                  {groupBy === "client" ? (
                    <div className="rounded-control bg-muted h-12 animate-pulse" />
                  ) : null}
                  <div className="rounded-control bg-muted h-24 animate-pulse" />
                </div>
              ))}
            </div>
          ) : activeListQuery.isError ? (
            <div className="space-y-4 p-6">
              <div className="border-danger space-y-2 border-l-2 pl-4">
                <h3 className="font-display text-lg font-semibold">
                  No pudimos cargar tus proyectos
                </h3>
                <p className="text-muted-foreground text-sm leading-6">
                  Revisa tu conexión e inténtalo nuevamente.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void activeListQuery.refetch()}
              >
                Intentar de nuevo
              </Button>
            </div>
          ) : !hasListResults ? (
            <ProjectEmptyState
              hasFilters={hasFilters}
              view={view}
              onClear={() => {
                setSearch("");
                changeFilters({
                  statuses: [],
                  types: [],
                  clientIds: [],
                  memberUserIds: [],
                });
                setPage(1);
              }}
              onCreate={() => navigate("/projects/new")}
              onViewCurrent={() => selectView("current")}
            />
          ) : groupBy === "client" ? (
            <ProjectClientGroups
              groups={projectGroups}
              today={today}
              onOpenProject={(projectId) => navigate(`/projects/${projectId}`)}
            />
          ) : (
            <div className="divide-border divide-y">
              {projects.map((project) => (
                <ProjectListRow
                  key={project.id}
                  project={project}
                  showClient
                  today={today}
                  onOpen={(projectId) => navigate(`/projects/${projectId}`)}
                />
              ))}
            </div>
          )}

          {groupBy !== "status" &&
          !activeListQuery.isPending &&
          !activeListQuery.isError &&
          pagination &&
          pagination.totalPages > 1 ? (
            <nav
              aria-label="Paginación de proyectos"
              className="border-border flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-5"
            >
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || activeListQuery.isPlaceholderData}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </Button>
              <span className="text-muted-foreground text-xs font-medium">
                Página {pagination.page} de {pagination.totalPages}
                {groupBy === "client"
                  ? ` · ${pagination.total} ${pagination.total === 1 ? "cliente" : "clientes"}`
                  : ""}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  page >= pagination.totalPages ||
                  activeListQuery.isPlaceholderData
                }
                onClick={() => setPage((current) => current + 1)}
              >
                Siguiente
              </Button>
            </nav>
          ) : null}
        </section>
      </AppPageContent>
    </AppPage>
  );
}

function ProjectEmptyState({
  hasFilters,
  view,
  onClear,
  onCreate,
  onViewCurrent,
}: {
  hasFilters: boolean;
  view: ProjectView;
  onClear(): void;
  onCreate(): void;
  onViewCurrent(): void;
}) {
  return (
    <div className="space-y-5 p-7 text-center sm:p-10">
      <div className="mx-auto max-w-sm space-y-2">
        <h3 className="font-display text-xl font-semibold tracking-[-0.025em]">
          {hasFilters
            ? "No encontramos coincidencias"
            : portfolioViewCopy[view].emptyTitle}
        </h3>
        <p className="text-muted-foreground text-sm leading-6">
          {hasFilters
            ? "Prueba con otros términos o limpia los filtros."
            : portfolioViewCopy[view].emptyDescription}
        </p>
      </div>
      {hasFilters ? (
        <Button variant="outline" size="sm" onClick={onClear}>
          Limpiar filtros
        </Button>
      ) : view === "current" ? (
        <Button onClick={onCreate}>Crear primer proyecto</Button>
      ) : (
        <Button variant="outline" size="sm" onClick={onViewCurrent}>
          Ver proyectos en curso
        </Button>
      )}
    </div>
  );
}
