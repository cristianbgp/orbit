import { useEffect, useMemo, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import {
  Eye,
  ChevronsDownUp,
  ChevronsUpDown,
  Presentation,
  ArrowLeft,
  LogOut,
  Maximize2,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useGetCasePresentation } from "@/lib/api/generated/cases/cases";
import type { CasePortfolioFilters } from "./case-portfolio-filter-state";
import { CasePortfolioFiltersBar } from "./case-portfolio-filters";
import { CasePresentationCase } from "./case-presentation-case";
import {
  readCasePresentationState,
  writeCasePresentationState,
  type CasePresentationState,
} from "./case-presentation-state";

function countCases(clients: Array<{ cases: unknown[] }> | undefined) {
  return (
    clients?.reduce((total, client) => total + client.cases.length, 0) ?? 0
  );
}

export function CasePresentationPage() {
  const [params, setParams] = useSearchParams();
  const state = readCasePresentationState(params);
  const query = useGetCasePresentation(
    {
      statuses: state.statuses,
      ...(state.clientIds.length ? { clientIds: state.clientIds } : {}),
      ...(state.types.length ? { types: state.types } : {}),
      ...(state.memberUserIds.length
        ? { memberUserIds: state.memberUserIds }
        : {}),
      ...(state.includeCompletedActions
        ? { includeCompletedActions: "true" }
        : {}),
      ...(state.includePastEvents ? { includePastEvents: "true" } : {}),
    },
    { query: { placeholderData: keepPreviousData } },
  );
  const caseIds = useMemo(
    () =>
      query.data?.clients.flatMap((client) =>
        client.cases.map((item) => item.id),
      ) ?? [],
    [query.data?.clients],
  );
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());
  const [expandedClients, setExpandedClients] = useState<Set<string>>(
    new Set(),
  );
  const [initialized, setInitialized] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);

  useEffect(() => {
    if (!initialized && caseIds.length) {
      setExpandedCases(new Set(caseIds));
      setExpandedClients(
        new Set(query.data?.clients.map((client) => client.id)),
      );
      setInitialized(true);
    }
  }, [caseIds, initialized, query.data?.clients]);

  useEffect(() => {
    setFullscreenSupported(Boolean(document.fullscreenEnabled));
    const sync = () => setNativeFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  function changeState(next: CasePresentationState) {
    const nextParams = new URLSearchParams(params);
    writeCasePresentationState(nextParams, next);
    setParams(nextParams, { replace: true });
  }

  function changeFilters(filters: CasePortfolioFilters) {
    changeState({
      ...state,
      types: filters.types,
      clientIds: filters.clientIds,
      memberUserIds: filters.memberUserIds,
    });
  }

  function toggleAll() {
    const collapse =
      expandedCases.size === caseIds.length &&
      expandedClients.size === (query.data?.clients.length ?? 0);
    setExpandedCases(collapse ? new Set() : new Set(caseIds));
    setExpandedClients(
      collapse
        ? new Set()
        : new Set(query.data?.clients.map((client) => client.id)),
    );
  }

  const allExpanded =
    caseIds.length > 0 &&
    expandedCases.size === caseIds.length &&
    expandedClients.size === (query.data?.clients.length ?? 0);
  const additionalContentCount =
    Number(state.statuses.includes("concluded")) +
    Number(state.includeCompletedActions) +
    Number(state.includePastEvents);
  const content = (
    <>
      <div className="border-border bg-background/95 sticky top-0 z-20 flex min-w-0 flex-col gap-3 border-b px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/cases">
              <ArrowLeft aria-hidden="true" /> Volver a casos
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={toggleAll}>
            {allExpanded ? (
              <ChevronsDownUp aria-hidden="true" />
            ) : (
              <ChevronsUpDown aria-hidden="true" />
            )}
            {allExpanded ? "Contraer todo" : "Expandir todo"}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={additionalContentCount ? "secondary" : "outline"}
                size="sm"
              >
                <Eye aria-hidden="true" />
                Contenido adicional
                {additionalContentCount ? ` · ${additionalContentCount}` : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-3">
              <div className="px-1 pb-2">
                <p className="font-semibold">Mostrar también</p>
                <p className="text-muted-foreground mt-0.5 text-sm leading-5">
                  Agrega información histórica a la presentación.
                </p>
              </div>
              <div className="space-y-1">
                <label className="hover:bg-accent focus-within:bg-accent flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    checked={state.statuses.includes("concluded")}
                    onChange={(event) =>
                      changeState({
                        ...state,
                        statuses: event.target.checked
                          ? ["in_progress", "concluded"]
                          : ["in_progress"],
                      })
                    }
                  />
                  Casos concluidos
                </label>
                <label className="hover:bg-accent focus-within:bg-accent flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    checked={state.includeCompletedActions}
                    onChange={() =>
                      changeState({
                        ...state,
                        includeCompletedActions: !state.includeCompletedActions,
                      })
                    }
                  />
                  Acciones completadas
                </label>
                <label className="hover:bg-accent focus-within:bg-accent flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    checked={state.includePastEvents}
                    onChange={() =>
                      changeState({
                        ...state,
                        includePastEvents: !state.includePastEvents,
                      })
                    }
                  />
                  Eventos pasados
                </label>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <span className="text-muted-foreground mr-auto text-xs sm:mr-0">
            {countCases(query.data?.clients)} casos
          </span>
          <Button asChild variant="outline" size="sm">
            <Link
              to="/cases"
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen();
              }}
            >
              <LogOut aria-hidden="true" />
              Salir de presentación
            </Link>
          </Button>
          {fullscreenSupported ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen();
                else
                  void document.documentElement
                    .requestFullscreen()
                    .catch(() => undefined);
              }}
            >
              <Maximize2 aria-hidden="true" />
              {nativeFullscreen
                ? "Salir de pantalla completa"
                : "Pantalla completa"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="py-4">
        <CasePortfolioFiltersBar
          search=""
          showSearch={false}
          filters={{
            types: state.types,
            clientIds: state.clientIds,
            memberUserIds: state.memberUserIds,
          }}
          onSearchChange={() => undefined}
          onFiltersChange={changeFilters}
        />
      </div>

      {query.isPending ? (
        <div role="status" className="space-y-4">
          <span className="sr-only">Cargando presentación</span>
          {[0, 1, 2].map((value) => (
            <div
              key={value}
              className="bg-muted rounded-card h-48 animate-pulse"
            />
          ))}
        </div>
      ) : query.isError ? (
        <div className="border-danger/30 bg-danger/5 rounded-card border p-5">
          <p className="font-semibold">No pudimos preparar la presentación.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void query.refetch()}
          >
            Reintentar
          </Button>
        </div>
      ) : query.data.clients.length === 0 ? (
        <div className="border-border bg-card rounded-card border p-8 text-center">
          <p className="font-semibold">No hay casos para esta presentación.</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Prueba retirando alguno de los filtros.
          </p>
        </div>
      ) : (
        <div className="space-y-6" aria-busy={query.isPlaceholderData}>
          {query.data.truncated.value ? (
            <p
              role="alert"
              className="border-warning/30 bg-warning-soft rounded-control border px-3 py-2 text-sm"
            >
              La cartera supera el límite de esta vista. Acota la presentación
              con filtros.
            </p>
          ) : null}
          {query.data.clients.map((client) => (
            <section
              key={client.id}
              aria-labelledby={`presentation-client-${client.id}`}
            >
              <div className="mb-2 flex items-center justify-between gap-3 px-1">
                <h2 id={`presentation-client-${client.id}`} className="min-w-0">
                  <Button
                    type="button"
                    variant="ghost"
                    className="font-display min-w-0 justify-start px-1 text-xl font-semibold"
                    aria-expanded={expandedClients.has(client.id)}
                    aria-controls={`presentation-client-cases-${client.id}`}
                    onClick={() =>
                      setExpandedClients((current) => {
                        const next = new Set(current);
                        if (next.has(client.id)) next.delete(client.id);
                        else next.add(client.id);
                        return next;
                      })
                    }
                  >
                    {expandedClients.has(client.id) ? (
                      <ChevronsDownUp aria-hidden="true" />
                    ) : (
                      <ChevronsUpDown aria-hidden="true" />
                    )}
                    <span className="truncate">{client.name}</span>
                  </Button>
                </h2>
                <span className="text-muted-foreground text-sm">
                  {client.cases.length}{" "}
                  {client.cases.length === 1 ? "caso" : "casos"}
                </span>
              </div>
              {expandedClients.has(client.id) ? (
                <div
                  id={`presentation-client-cases-${client.id}`}
                  className="space-y-3"
                >
                  {client.cases.map((item) => (
                    <CasePresentationCase
                      key={item.id}
                      item={item}
                      clientName={client.name}
                      organizationDate={query.data.organizationDate}
                      open={expandedCases.has(item.id)}
                      onOpenChange={(open) =>
                        setExpandedCases((current) => {
                          const next = new Set(current);
                          if (open) next.add(item.id);
                          else next.delete(item.id);
                          return next;
                        })
                      }
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="bg-background fixed inset-0 z-50 overflow-y-auto overscroll-contain">
      <div className="mx-auto min-h-dvh w-full max-w-[1920px] px-4 pb-12 sm:px-7 lg:px-10">
        <header className="flex items-center gap-3 pt-5 pb-2">
          <span className="bg-primary-soft text-primary flex size-10 items-center justify-center rounded-xl">
            <Presentation aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold">
              Presentación semanal
            </h1>
            <p className="text-muted-foreground text-sm">
              Estado del portafolio de casos
            </p>
          </div>
        </header>
        {content}
      </div>
    </div>
  );
}
