import { useState } from "react";
import { CalendarDays, ChevronDown, Flag } from "lucide-react";

import type {
  ProjectClientGroup,
  ProjectListItem,
} from "@/lib/api/generated/models";
import { formatCalendarWeekday } from "@/lib/calendar-date-presentation";
import { cn } from "@/lib/utils";
import { PROJECT_TYPE_LABELS } from "./project-labels";
import { deriveProjectDeadlineState } from "./project-deadline-status";
import {
  formatProjectCalendarDate,
  ProjectStatusBadge,
} from "./project-presentation";
import { ProjectTeamAvatars } from "./project-team-avatars";

export function ProjectListRow({
  project,
  showClient,
  today,
  onOpen,
}: {
  project: ProjectListItem;
  showClient: boolean;
  today: string;
  onOpen(projectId: string): void;
}) {
  return (
    <article
      aria-label={project.name}
      className="hover:bg-muted/60 grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 transition-colors sm:px-5 lg:grid-cols-[minmax(0,1fr)_8.5rem_9.5rem_14rem] lg:items-center"
    >
      <button
        type="button"
        className="focus-visible:ring-ring col-span-2 min-h-11 min-w-0 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2 lg:col-span-1"
        onClick={() => onOpen(project.id)}
      >
        <span className="min-w-0 space-y-1.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold">
              {project.name}
            </span>
            <ProjectStatusBadge status={project.status} />
            {project.archivedAt ? (
              <span className="bg-muted text-muted-foreground inline-flex rounded-full px-2.5 py-1 text-xs font-semibold">
                Archivado
              </span>
            ) : null}
          </span>
          {showClient ? (
            <span className="text-muted-foreground block truncate text-xs">
              {project.client.name}
            </span>
          ) : null}
          <span className="text-primary block text-xs font-medium">
            {PROJECT_TYPE_LABELS[project.type]}
            {project.internalReference ? ` · ${project.internalReference}` : ""}
          </span>
        </span>
      </button>
      <ProjectStartDate date={project.startDate} />
      <ProjectEndDate project={project} today={today} />
      <div
        role="group"
        aria-label="Equipo del proyecto"
        className="col-span-2 min-w-0 lg:col-span-1"
      >
        <ProjectTeamAvatars projectName={project.name} team={project.team} />
      </div>
    </article>
  );
}

function ProjectStartDate({ date }: { date: string }) {
  return (
    <span
      aria-label="Inicio del proyecto"
      className="text-muted-foreground inline-flex min-w-0 items-center gap-1.5 text-xs"
    >
      <CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />
      <span>
        <span className="block font-medium">Inicio</span>
        <span className="block capitalize">{formatCalendarWeekday(date)}</span>
        <span className="text-foreground block font-semibold tabular-nums">
          {formatProjectCalendarDate(date)}
        </span>
      </span>
    </span>
  );
}

function ProjectEndDate({
  project,
  today,
}: {
  project: ProjectListItem;
  today: string;
}) {
  const deadlineState = deriveProjectDeadlineState({
    projectStatus: project.status,
    deadline: project.endDate,
    today,
  });
  const warning =
    deadlineState === "overdue"
      ? "Fecha final excedida"
      : deadlineState === "due_today"
        ? "Finaliza hoy"
        : deadlineState === "upcoming"
          ? "Finaliza pronto"
          : null;

  return (
    <span
      aria-label="Fecha final del proyecto"
      data-deadline-state={deadlineState}
      className={cn(
        "text-muted-foreground inline-flex min-w-0 items-center gap-1.5 text-xs",
        warning && "text-warning",
        deadlineState === "overdue" && "text-danger",
      )}
    >
      <Flag aria-hidden="true" className="size-3.5 shrink-0" />
      <span>
        <span className="block font-medium">Final</span>
        <span className="block capitalize">
          {formatCalendarWeekday(project.endDate)}
        </span>
        <span className="text-foreground block font-semibold tabular-nums">
          {formatProjectCalendarDate(project.endDate)}
        </span>
        {warning ? (
          <span className="block font-semibold">{warning}</span>
        ) : null}
      </span>
    </span>
  );
}

export function ProjectClientGroups({
  groups,
  today,
  onOpenProject,
}: {
  groups: ProjectClientGroup[];
  today: string;
  onOpenProject(projectId: string): void;
}) {
  const [collapsedClientIds, setCollapsedClientIds] = useState<Set<string>>(
    () => new Set(),
  );

  function toggleClient(clientId: string) {
    setCollapsedClientIds((current) => {
      const next = new Set(current);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  return (
    <div className="divide-border divide-y">
      {groups.map((group) => {
        const collapsed = collapsedClientIds.has(group.client.id);
        const headingId = `project-client-${group.client.id}`;
        const contentId = `project-client-projects-${group.client.id}`;
        const projectLabel =
          group.projects.length === 1
            ? "1 proyecto"
            : `${group.projects.length} proyectos`;

        return (
          <section key={group.client.id} aria-labelledby={headingId}>
            <div className="border-border bg-muted/35 flex min-w-0 items-stretch border-b">
              <button
                type="button"
                aria-controls={contentId}
                aria-expanded={!collapsed}
                aria-label={`${collapsed ? "Expandir" : "Contraer"} proyectos de ${group.client.name}`}
                className="focus-visible:ring-ring flex min-h-12 min-w-0 flex-1 items-center gap-3 px-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset sm:px-5"
                onClick={() => toggleClient(group.client.id)}
              >
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "text-primary size-4 shrink-0 transition-transform",
                    collapsed && "-rotate-90",
                  )}
                />
                <span
                  id={headingId}
                  className="min-w-0 flex-1 truncate text-sm font-semibold"
                >
                  {group.client.name}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs font-medium">
                  {projectLabel}
                </span>
              </button>
            </div>
            {!collapsed ? (
              <div
                id={contentId}
                role="group"
                aria-labelledby={headingId}
                className="divide-border divide-y"
              >
                {group.projects.map((project) => (
                  <ProjectListRow
                    key={project.id}
                    project={project}
                    showClient={false}
                    today={today}
                    onOpen={onOpenProject}
                  />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
