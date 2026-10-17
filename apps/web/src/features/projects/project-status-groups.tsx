import { useEffect, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useListProjects } from "@/lib/api/generated/projects/projects";
import type {
  ProjectOrder,
  ProjectOrderBy,
  ProjectStatus,
  ProjectType,
  ProjectView,
} from "@/lib/api/generated/models";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_LABELS } from "./project-labels";
import { ProjectListRow } from "./project-client-groups";

const STATUS_PAGE_SIZE = 10;
const statusOrder = ["active", "draft", "completed"] as const;

function statusesForView(view: ProjectView): readonly ProjectStatus[] {
  return view === "current" ? ["active", "draft"] : statusOrder;
}

type StatusFilters = {
  search?: string;
  types?: ProjectType[];
  clientIds?: string[];
  memberUserIds?: string[];
  selectedStatuses?: ProjectStatus[];
  view: ProjectView;
  orderBy: ProjectOrderBy;
  order: ProjectOrder;
};

function useStatusQuery(
  status: ProjectStatus,
  page: number,
  filters: StatusFilters,
) {
  return useListProjects(
    {
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.types?.length ? { type: filters.types } : {}),
      ...(filters.clientIds?.length ? { client: filters.clientIds } : {}),
      ...(filters.memberUserIds?.length
        ? { member: filters.memberUserIds }
        : {}),
      status: [status],
      view: filters.view,
      orderBy: filters.orderBy,
      order: filters.order,
      page,
      pageSize: STATUS_PAGE_SIZE,
    },
    {
      query: {
        enabled:
          statusesForView(filters.view).includes(status) &&
          (filters.selectedStatuses === undefined ||
            filters.selectedStatuses.includes(status)),
        placeholderData: keepPreviousData,
      },
    },
  );
}

export function ProjectStatusGroups({
  filters,
  today,
  onOpenProject,
}: {
  filters: StatusFilters;
  today: string;
  onOpenProject(projectId: string): void;
}) {
  const [pages, setPages] = useState<Record<ProjectStatus, number>>({
    active: 1,
    draft: 1,
    completed: 1,
  });
  const [collapsed, setCollapsed] = useState<Set<ProjectStatus>>(
    () => new Set(),
  );
  const active = useStatusQuery("active", pages.active, filters);
  const draft = useStatusQuery("draft", pages.draft, filters);
  const completed = useStatusQuery("completed", pages.completed, filters);
  const queryByStatus = { active, draft, completed };
  const typeKey = filters.types?.join("\u0000");
  const clientKey = filters.clientIds?.join("\u0000");
  const memberKey = filters.memberUserIds?.join("\u0000");
  const statusKey = filters.selectedStatuses?.join("\u0000");

  useEffect(() => {
    setPages({ active: 1, draft: 1, completed: 1 });
  }, [
    filters.search,
    typeKey,
    clientKey,
    memberKey,
    statusKey,
    filters.view,
    filters.orderBy,
    filters.order,
  ]);

  const visibleStatuses = filters.selectedStatuses
    ? filters.selectedStatuses.filter((status) =>
        statusesForView(filters.view).includes(status),
      )
    : statusesForView(filters.view);

  return (
    <div className="divide-border divide-y">
      {visibleStatuses.map((status) => {
        const query = queryByStatus[status];
        const isCollapsed = collapsed.has(status);
        const projects = query.data?.projects ?? [];
        const pagination = query.data?.pagination;
        const contentId = `project-status-${status}`;

        return (
          <section key={status} aria-labelledby={`${contentId}-title`}>
            <button
              type="button"
              aria-controls={contentId}
              aria-expanded={!isCollapsed}
              className="bg-muted/35 focus-visible:ring-ring flex min-h-12 w-full items-center gap-3 px-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset sm:px-5"
              onClick={() =>
                setCollapsed((current) => {
                  const next = new Set(current);
                  if (next.has(status)) next.delete(status);
                  else next.add(status);
                  return next;
                })
              }
            >
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "text-primary size-4 transition-transform",
                  isCollapsed && "-rotate-90",
                )}
              />
              <span
                id={`${contentId}-title`}
                className="flex-1 text-sm font-semibold"
              >
                {PROJECT_STATUS_LABELS[status]}
              </span>
              {pagination ? (
                <span className="text-muted-foreground text-xs font-medium">
                  {pagination.total}{" "}
                  {pagination.total === 1 ? "proyecto" : "proyectos"}
                </span>
              ) : null}
            </button>
            {!isCollapsed ? (
              <div id={contentId}>
                {query.isPending ? (
                  <div
                    aria-label={`Cargando proyectos ${PROJECT_STATUS_LABELS[status]}`}
                    className="p-5"
                  >
                    <div className="rounded-control bg-muted h-20 animate-pulse" />
                  </div>
                ) : query.isError ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <p className="text-danger text-sm">
                      No pudimos cargar este grupo.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void query.refetch()}
                    >
                      Intentar de nuevo
                    </Button>
                  </div>
                ) : projects.length === 0 ? (
                  <p className="text-muted-foreground p-5 text-sm">
                    No hay proyectos en este estado.
                  </p>
                ) : (
                  <>
                    {query.isPlaceholderData ? (
                      <p className="text-muted-foreground px-5 pt-3 text-xs">
                        Actualizando…
                      </p>
                    ) : null}
                    <div className="divide-border divide-y">
                      {projects.map((project) => (
                        <ProjectListRow
                          key={project.id}
                          project={project}
                          showClient
                          today={today}
                          onOpen={onOpenProject}
                        />
                      ))}
                    </div>
                    {pagination && pagination.totalPages > 1 ? (
                      <div className="border-border flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
                        <span className="text-muted-foreground text-xs">
                          Página {pagination.page} de {pagination.totalPages}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pages[status] <= 1}
                            onClick={() =>
                              setPages((current) => ({
                                ...current,
                                [status]: Math.max(1, current[status] - 1),
                              }))
                            }
                          >
                            Anterior
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pages[status] >= pagination.totalPages}
                            onClick={() =>
                              setPages((current) => ({
                                ...current,
                                [status]: current[status] + 1,
                              }))
                            }
                          >
                            Siguiente
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
