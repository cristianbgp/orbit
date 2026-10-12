import { useEffect, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  List,
  UserRoundCheck,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useCalendarToday } from "@/components/ui/calendar-today-context";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppPage, AppPageContent } from "@/features/layout/app-page";
import { AppPageHeader } from "@/features/layout/app-page-header";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useListCasesGroupedByClient } from "@/lib/api/generated/cases/cases";
import { formatCasePeriod, getCaseLabel } from "./case-presenters";
import {
  readCasePortfolioFilters,
  replaceCaseFilterParam,
  type CasePortfolioFilters,
} from "./case-portfolio-filter-state";
import { CasePortfolioFiltersBar } from "./case-portfolio-filters";
import { CasePortfolioFollowUp } from "./case-portfolio-follow-up";
import { CaseGlobalActions } from "./case-global-actions";
import { CasePeopleAvatars } from "./case-people-avatars";
import { CaseEventCalendar } from "./case-event-calendar";
import {
  currentCaseEventCalendarMonth,
  parseCaseEventCalendarMonth,
} from "./case-event-calendar-layout";

const caseViews = ["in_progress", "concluded", "archived"] as const;
type CaseView = (typeof caseViews)[number];

function formatCaseCount(count: number) {
  return `${count} ${count === 1 ? "caso" : "casos"}`;
}

const viewCopy: Record<
  CaseView,
  { tab: string; heading: string; empty: string; description: string }
> = {
  in_progress: {
    tab: "En trámite",
    heading: "Casos en trámite",
    empty: "No hay casos en trámite",
    description: "Registra el primer proceso activo del estudio.",
  },
  concluded: {
    tab: "Concluidos",
    heading: "Casos concluidos",
    empty: "No hay casos concluidos",
    description: "Los casos concluidos aparecerán aquí.",
  },
  archived: {
    tab: "Archivados",
    heading: "Casos archivados",
    empty: "No hay casos archivados",
    description: "Los casos que archives aparecerán aquí.",
  },
};

export function CasesPage({ currentUserId }: { currentUserId: string }) {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const debounced = useDebouncedValue(search).trim();
  const contextToday = useCalendarToday();
  const today = contextToday ?? format(new Date(), "yyyy-MM-dd");
  const filters = readCasePortfolioFilters(params);
  const isMyCases = filters.memberUserIds.includes(currentUserId);
  const requestedView = params.get("view");
  const view: CaseView = caseViews.includes(requestedView as CaseView)
    ? (requestedView as CaseView)
    : params.get("archived") === "true"
      ? "archived"
      : "in_progress";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const requestedDisplay = params.get("display");
  const display =
    requestedDisplay === "calendar" && view !== "archived"
      ? "calendar"
      : "list";
  const requestedMonth = params.get("month") ?? "";
  const month = parseCaseEventCalendarMonth(requestedMonth)
    ? requestedMonth
    : currentCaseEventCalendarMonth(today);
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (debounced) next.set("q", debounced);
    else next.delete("q");
    setParams(next, { replace: true });
  }, [debounced]);
  const query = useListCasesGroupedByClient(
    {
      ...(debounced ? { search: debounced } : {}),
      ...(view !== "archived" ? { status: view } : {}),
      ...(filters.types.length ? { type: filters.types } : {}),
      ...(filters.clientIds.length ? { client: filters.clientIds } : {}),
      ...(filters.memberUserIds.length
        ? { member: filters.memberUserIds }
        : {}),
      ...(view === "archived" ? { archived: "true" } : {}),
      page,
      pageSize: 10,
    },
    {
      query: {
        placeholderData: keepPreviousData,
        enabled: display === "list",
      },
    },
  );
  useEffect(() => {
    if (query.data?.groups)
      setOpen((current) =>
        current.size
          ? current
          : new Set(query.data.groups.map((group) => group.client.id)),
      );
  }, [query.data?.groups]);
  const changeView = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "in_progress") next.delete("view");
    else next.set("view", value);
    next.delete("archived");
    next.delete("page");
    if (value === "archived") {
      next.delete("display");
      next.delete("month");
    }
    setParams(next);
  };
  const changeDisplay = (value: "list" | "calendar") => {
    const next = new URLSearchParams(params);
    if (value === "calendar") {
      next.set("display", "calendar");
      next.set("month", month);
      next.delete("page");
    } else {
      next.delete("display");
      next.delete("month");
    }
    setParams(next);
  };
  const changeMonth = (value: string) => {
    const next = new URLSearchParams(params);
    next.set("display", "calendar");
    next.set("month", value);
    next.delete("page");
    setParams(next);
  };
  const changeFilters = (nextFilters: CasePortfolioFilters) => {
    const next = new URLSearchParams(params);
    replaceCaseFilterParam(next, "type", nextFilters.types);
    replaceCaseFilterParam(next, "client", nextFilters.clientIds);
    replaceCaseFilterParam(next, "member", nextFilters.memberUserIds);
    next.delete("page");
    setParams(next);
  };
  const toggleMyCases = () => {
    changeFilters({
      ...filters,
      memberUserIds: isMyCases
        ? filters.memberUserIds.filter((userId) => userId !== currentUserId)
        : [currentUserId],
    });
  };
  const changePage = (value: number) => {
    const next = new URLSearchParams(params);
    if (value <= 1) next.delete("page");
    else next.set("page", String(value));
    setParams(next);
  };
  return (
    <AppPage>
      <AppPageHeader
        icon={BriefcaseBusiness}
        eyebrow="Cartera procesal"
        title="Casos"
        description="Consulta los procesos legales y tributarios del estudio por cliente, tipo y estado."
        actions={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button asChild className="min-w-0 flex-1 sm:flex-none">
              <Link to="/cases/new">Nuevo caso</Link>
            </Button>
            <CaseGlobalActions />
          </div>
        }
      />
      <AppPageContent>
        <section
          aria-labelledby="case-list-heading"
          aria-busy={query.isPlaceholderData}
          className="rounded-card border-border bg-card shadow-panel min-w-0 overflow-hidden border"
        >
          <div className="border-border space-y-3 border-b p-4 sm:p-5">
            <Tabs value={view} onValueChange={changeView}>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <div className="max-w-full overflow-x-auto pb-1">
                  <TabsList aria-label="Vistas de casos" variant="line">
                    {caseViews.map((value) => (
                      <TabsTrigger key={value} value={value}>
                        {viewCopy[value].tab}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
                {view !== "archived" ? (
                  <div
                    role="group"
                    aria-label="Presentación de casos"
                    className="border-border bg-muted/40 rounded-control flex border p-1"
                  >
                    <Button
                      variant={display === "list" ? "secondary" : "ghost"}
                      size="sm"
                      aria-label="Vista de lista"
                      onClick={() => changeDisplay("list")}
                    >
                      <List aria-hidden="true" />
                      Lista
                    </Button>
                    <Button
                      variant={display === "calendar" ? "secondary" : "ghost"}
                      size="sm"
                      aria-label="Vista de calendario"
                      onClick={() => changeDisplay("calendar")}
                    >
                      <CalendarDays aria-hidden="true" />
                      Calendario
                    </Button>
                  </div>
                ) : null}
              </div>
            </Tabs>
            <h2
              id="case-list-heading"
              className="font-display text-lg font-semibold"
            >
              {viewCopy[view].heading}
            </h2>
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <CasePortfolioFiltersBar
                search={search}
                filters={filters}
                onSearchChange={(value) => {
                  setSearch(value);
                  if (page > 1) {
                    const next = new URLSearchParams(params);
                    next.delete("page");
                    setParams(next);
                  }
                }}
                onFiltersChange={changeFilters}
              />
              <div className="flex shrink-0 items-center justify-between gap-2 lg:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={isMyCases}
                  className="aria-pressed:border-primary/40 aria-pressed:bg-primary/10 aria-pressed:text-primary-strong h-11 gap-2 lg:h-9"
                  onClick={toggleMyCases}
                >
                  <UserRoundCheck aria-hidden="true" />
                  Mis casos
                </Button>
                {display === "list" && !query.isPending && !query.isError ? (
                  <span className="text-muted-foreground shrink-0 text-xs font-medium">
                    {formatCaseCount(query.data?.caseTotal ?? 0)}
                  </span>
                ) : null}
              </div>
              {query.isPlaceholderData ? (
                <span className="sr-only" role="status">
                  Actualizando casos…
                </span>
              ) : null}
            </div>
          </div>
          {display === "calendar" && view !== "archived" ? (
            <div className="p-4 sm:p-5">
              <CaseEventCalendar
                month={month}
                today={today}
                caseStatus={view}
                search={debounced}
                filters={filters}
                onMonthChange={changeMonth}
              />
            </div>
          ) : query.isPending ? (
            <p role="status" className="text-muted-foreground p-8 text-center">
              Cargando casos…
            </p>
          ) : query.isError ? (
            <div className="p-8 text-center">
              <p className="text-danger">No pudimos cargar los casos.</p>
              <Button variant="ghost" onClick={() => void query.refetch()}>
                Intentar de nuevo
              </Button>
            </div>
          ) : !query.data?.groups.length ? (
            <div className="p-10 text-center">
              <h2 className="font-display text-xl font-semibold">
                {debounced ||
                filters.types.length ||
                filters.clientIds.length ||
                filters.memberUserIds.length
                  ? "No encontramos casos"
                  : viewCopy[view].empty}
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">
                {debounced ||
                filters.types.length ||
                filters.clientIds.length ||
                filters.memberUserIds.length
                  ? "Prueba con otra búsqueda o ajusta los filtros."
                  : viewCopy[view].description}
              </p>
            </div>
          ) : (
            query.data.groups.map((group) => {
              const expanded = open.has(group.client.id);
              return (
                <div
                  key={group.client.id}
                  className="border-border border-b last:border-0"
                >
                  <button
                    className="hover:bg-muted/50 flex w-full items-center gap-2 px-5 py-3 text-left"
                    onClick={() =>
                      setOpen((current) => {
                        const next = new Set(current);
                        if (expanded) next.delete(group.client.id);
                        else next.add(group.client.id);
                        return next;
                      })
                    }
                  >
                    {expanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                    <span className="font-semibold">{group.client.name}</span>
                    <span className="text-muted-foreground ml-auto text-sm">
                      {formatCaseCount(group.cases.length)}
                    </span>
                  </button>
                  {expanded ? (
                    <div>
                      {group.cases.map((record) => (
                        <div key={record.id} className="border-border border-t">
                          <div className="hover:bg-muted/35 grid gap-3 px-5 py-4 lg:grid-cols-[minmax(16rem,2fr)_minmax(8rem,.85fr)_minmax(8rem,.85fr)_minmax(9rem,.8fr)_14rem] lg:items-center">
                            <div className="min-w-0">
                              <Link
                                to={`/cases/${record.id}`}
                                className="focus-visible:ring-ring rounded-sm font-semibold outline-none hover:underline focus-visible:ring-2"
                              >
                                <span className="line-clamp-2">
                                  {record.identification}
                                </span>
                              </Link>
                              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                <span
                                  className={
                                    record.status === "concluded"
                                      ? "text-success"
                                      : "text-primary"
                                  }
                                >
                                  {getCaseLabel("status", record.status)}
                                </span>
                                <span className="text-muted-foreground">
                                  {getCaseLabel("type", record.type)}
                                </span>
                              </div>
                            </div>
                            <div className="text-sm">
                              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                                Período
                              </p>
                              <p className="mt-1">
                                {formatCasePeriod(
                                  record.periodKind,
                                  record.periodStart,
                                  record.periodEnd,
                                )}
                              </p>
                            </div>
                            <div className="text-sm">
                              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                                Expediente
                              </p>
                              <p className="mt-1 truncate">
                                {record.docketNumber ?? "Sin expediente"}
                              </p>
                            </div>
                            <div className="text-sm">
                              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                                Etapa
                              </p>
                              <p className="mt-1 truncate">
                                {getCaseLabel("stage", record.stage)}
                              </p>
                            </div>
                            <CasePeopleAvatars
                              caseName={record.identification}
                              team={record.team}
                              followers={record.followers}
                            />
                          </div>
                          <CasePortfolioFollowUp
                            caseId={record.id}
                            caseName={record.identification}
                            clientName={record.client.name}
                            actionCount={record.activeActionCount}
                            updateCount={record.activeUpdateCount}
                            readOnly={Boolean(record.archivedAt)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
          {display === "list" &&
          query.data &&
          query.data.pagination.totalPages > 1 ? (
            <div className="border-border flex items-center justify-between gap-3 border-t px-5 py-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || query.isPlaceholderData}
                onClick={() => changePage(page - 1)}
              >
                Anterior
              </Button>
              <span className="text-muted-foreground text-sm">
                Página {page} de {query.data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  page >= query.data.pagination.totalPages ||
                  query.isPlaceholderData
                }
                onClick={() => changePage(page + 1)}
              >
                Siguiente
              </Button>
            </div>
          ) : null}
        </section>
      </AppPageContent>
    </AppPage>
  );
}
