import { useInfiniteQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { useOrganizationCalendar } from "@/features/organization/organization-calendar-context";
import {
  getListCaseActivitiesQueryKey,
  listCaseActivities,
} from "@/lib/api/generated/cases/cases";
import { CaseActivityMessage } from "./case-activity-message";

function formatActivityTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export function CaseActivityList({ caseId }: { caseId: string }) {
  const { timeZone } = useOrganizationCalendar();
  const query = useInfiniteQuery({
    queryKey: [...getListCaseActivitiesQueryKey(caseId), "recent", 10],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      listCaseActivities(caseId, { page: pageParam, pageSize: 10 }, { signal }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
  });

  if (query.isPending)
    return (
      <section
        aria-label="Cargando actividad"
        className="bg-muted rounded-card h-40 animate-pulse"
      />
    );
  if (query.isError || !query.data)
    return (
      <section className="rounded-card border-danger/25 bg-card border p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold">Actividad</h2>
        <p className="text-danger mt-2 text-sm">
          No pudimos cargar la actividad del caso.
        </p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => void query.refetch()}
        >
          Intentar de nuevo
        </Button>
      </section>
    );

  const activities = query.data.pages.flatMap((page) => page.activities);
  return (
    <section
      aria-labelledby="case-activity-title"
      aria-busy={query.isFetchingNextPage}
      className="rounded-card border-border bg-card shadow-panel max-h-96 overflow-y-auto border p-5 sm:p-6"
    >
      <div>
        <h2
          id="case-activity-title"
          className="font-display text-xl font-semibold"
        >
          Actividad
        </h2>
        <p className="text-muted-foreground mt-1 text-sm leading-none">
          Cambios del caso registrados automáticamente.
        </p>
      </div>
      {activities.length ? (
        <ol className="mt-6" aria-label="Actividad del caso">
          {activities.map((event, index) => (
            <li
              key={event.id}
              className="relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3 pb-5 text-sm last:pb-0"
            >
              <div className="relative flex justify-center">
                <span
                  data-slot="case-activity-timeline-marker"
                  aria-hidden="true"
                  className="bg-primary ring-primary/10 mt-1.5 size-2.5 rounded-full ring-4"
                />
                {index < activities.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="bg-border absolute top-5 bottom-0 left-1/2 w-px -translate-x-1/2"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="text-foreground text-sm leading-6">
                  <CaseActivityMessage activity={event} />
                </div>
                <time
                  role="time"
                  dateTime={event.createdAt}
                  className="text-muted-foreground mt-1.5 block text-xs font-medium"
                >
                  {formatActivityTime(event.createdAt, timeZone)}
                </time>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="border-primary/40 mt-6 border-l-2 pl-4">
          <h3 className="text-sm font-semibold">
            Aún no hay actividad registrada
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Los cambios del caso aparecerán aquí.
          </p>
        </div>
      )}
      {query.hasNextPage ? (
        <Button
          className="mt-4"
          variant="outline"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Cargando más…" : "Cargar más actividad"}
        </Button>
      ) : null}
    </section>
  );
}
