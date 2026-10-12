import type { RefObject } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  getListProjectActivitiesQueryKey,
  listProjectActivities,
} from "@/lib/api/generated/activity/activity";
import { ProjectActivityMessage } from "./project-activity-message";

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Lima",
});

export function ProjectActivityFeed({
  projectId,
  taskOpenerRef,
}: {
  projectId: string;
  taskOpenerRef?: RefObject<HTMLElement | null>;
}) {
  const query = useInfiniteQuery({
    queryKey: [...getListProjectActivitiesQueryKey(projectId), "recent", 10],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      listProjectActivities(
        projectId,
        { page: pageParam, pageSize: 10 },
        { signal },
      ),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
  });

  if (query.isPending) {
    return (
      <section
        aria-label="Cargando actividad"
        className="rounded-card border-border bg-muted h-48 animate-pulse border"
      />
    );
  }

  if ((query.isError && !query.data) || !query.data) {
    return (
      <section className="rounded-card border-danger/25 bg-card border p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Actividad</h2>
        <p className="text-danger mt-2 text-sm">
          No pudimos cargar la actividad del proyecto.
        </p>
        <Button
          className="mt-4"
          variant="outline"
          size="sm"
          onClick={() => void query.refetch()}
        >
          Intentar de nuevo
        </Button>
      </section>
    );
  }

  const activities = query.data.pages.flatMap((page) => page.activities);

  return (
    <section
      aria-labelledby="project-activity-title"
      aria-busy={query.isFetchingNextPage}
      className="rounded-card border-border bg-card shadow-panel max-h-80 overflow-y-auto border p-5 sm:p-6"
    >
      <div>
        <h2
          id="project-activity-title"
          className="font-display text-lg font-semibold"
        >
          Actividad
        </h2>
        <p className="text-muted-foreground mt-1 text-sm leading-none">
          Cambios del equipo registrados automáticamente.
        </p>
      </div>

      {activities.length === 0 ? (
        <div className="border-primary/40 mt-6 border-l-2 pl-4">
          <h3 className="text-sm font-semibold">
            Aún no hay actividad registrada
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Los cambios del equipo aparecerán aquí.
          </p>
        </div>
      ) : (
        <ol className="mt-6" aria-label="Actividad del proyecto">
          {activities.map((activity, index) => (
            <li
              key={activity.id}
              className="relative grid grid-cols-[1.25rem_1fr] gap-3 pb-3 last:pb-0"
            >
              <span
                aria-hidden="true"
                className="bg-primary ring-primary/10 mt-1.5 size-2.5 rounded-full ring-4"
              />
              {index < activities.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="bg-border absolute top-5 bottom-0 left-[0.28rem] w-px"
                />
              ) : null}
              <div>
                <p className="text-foreground text-xs leading-none">
                  <ProjectActivityMessage
                    activity={activity}
                    projectId={projectId}
                    taskOpenerRef={taskOpenerRef}
                  />
                </p>
                <time
                  role="time"
                  dateTime={activity.createdAt}
                  className="text-muted-foreground mt-1 block text-[10px] font-medium"
                >
                  {dateTimeFormatter.format(new Date(activity.createdAt))}
                </time>
              </div>
            </li>
          ))}
        </ol>
      )}

      {query.isFetchNextPageError ? (
        <div
          role="alert"
          className="border-border mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
        >
          <p className="text-danger text-sm">
            No pudimos cargar más actividad.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            Intentar de nuevo
          </Button>
        </div>
      ) : query.hasNextPage ? (
        <div className="border-border mt-5 border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage
              ? "Cargando más…"
              : "Cargar más actividad"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
