import { useInfiniteQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AppPage, AppPageContent } from "@/features/layout/app-page";
import { AppPageHeader } from "@/features/layout/app-page-header";
import {
  getListDashboardActivityQueryKey,
  listDashboardActivity,
} from "@/lib/api/generated/dashboard/dashboard";
import type { DashboardActivityPreview } from "@/lib/api/generated/models";
import { StudioActivityList } from "./studio-activity-list";

const PAGE_SIZE = 25;

function uniqueActivities(activities: DashboardActivityPreview[]) {
  return [
    ...new Map(activities.map((activity) => [activity.id, activity])).values(),
  ];
}

export function StudioActivityPage({
  organizationId = "active-organization",
}: {
  organizationId?: string;
}) {
  const query = useInfiniteQuery({
    queryKey: [
      ...getListDashboardActivityQueryKey({ pageSize: PAGE_SIZE }),
      organizationId,
      "infinite",
    ],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      listDashboardActivity(
        {
          pageSize: PAGE_SIZE,
          ...(pageParam ? { cursor: pageParam } : {}),
        },
        { signal },
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const pages = query.data?.pages ?? [];
  const activities = uniqueActivities(pages.flatMap((page) => page.activities));
  const timeZone = pages[0]?.timeZone ?? "America/Lima";

  return (
    <AppPage aria-busy={query.isFetching}>
      <AppPageHeader
        icon={Activity}
        eyebrow="Historial del estudio"
        title="Actividad"
        description="Los movimientos de todos los proyectos y casos, del más reciente al más antiguo."
      />

      <AppPageContent>
        {query.isPending ? (
          <div
            aria-label="Cargando actividad del estudio"
            className="rounded-card border-border bg-card overflow-hidden border shadow-sm"
          >
            <div className="divide-border animate-pulse divide-y">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="space-y-3 px-5 py-5 sm:px-6">
                  <div className="bg-muted h-4 w-3/4 rounded" />
                  <div className="bg-muted h-3 w-2/5 rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {query.isError && activities.length === 0 ? (
          <section
            className="rounded-card border-danger/20 bg-card border px-5 py-8 shadow-sm"
            role="alert"
          >
            <h2 className="font-display text-lg font-semibold">
              No pudimos cargar la actividad del estudio.
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Revisa tu conexión e inténtalo nuevamente.
            </p>
            <Button className="mt-5" onClick={() => void query.refetch()}>
              Intentar de nuevo
            </Button>
          </section>
        ) : null}

        {!query.isPending && !query.isError && activities.length === 0 ? (
          <section className="rounded-card border-border bg-card border px-5 py-10 text-center shadow-sm">
            <Activity
              aria-hidden="true"
              className="text-muted-foreground mx-auto size-6"
            />
            <p className="text-muted-foreground mt-3 text-sm">
              Todavía no hay actividad en el estudio.
            </p>
          </section>
        ) : null}

        {activities.length > 0 ? (
          <section
            aria-label="Actividad del estudio"
            className="rounded-card border-border bg-card overflow-hidden border shadow-sm"
          >
            <StudioActivityList activities={activities} timeZone={timeZone} />
            {query.hasNextPage || query.isFetchNextPageError ? (
              <div className="border-border flex flex-col items-center gap-3 border-t px-5 py-5">
                {query.isFetchNextPageError ? (
                  <p className="text-danger text-sm" role="alert">
                    No pudimos cargar más actividad.
                  </p>
                ) : null}
                <Button
                  variant="outline"
                  disabled={query.isFetchingNextPage}
                  onClick={() => void query.fetchNextPage()}
                >
                  {query.isFetchingNextPage
                    ? "Cargando…"
                    : query.isFetchNextPageError
                      ? "Reintentar"
                      : "Cargar más"}
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}
      </AppPageContent>
    </AppPage>
  );
}
