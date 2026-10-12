import { FolderKanban } from "lucide-react";
import type { Project } from "@/lib/api/generated/models";
import { PROJECT_TYPE_LABELS } from "./project-labels";
import {
  formatProjectCalendarDate,
  ProjectStatusBadge,
} from "./project-presentation";

function ProjectDate({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0 space-y-0.5">
      <span className="text-muted-foreground block text-[0.69rem] font-semibold tracking-[0.08em] uppercase">
        {label}
      </span>
      <span className="block text-sm font-semibold tabular-nums">
        {formatProjectCalendarDate(value)}
      </span>
    </span>
  );
}

export function ProjectSummaryHeader({ project }: { project: Project }) {
  return (
    <header className="flex min-w-0 items-start gap-3 sm:gap-4">
      <span
        data-slot="app-page-header-icon"
        className="bg-primary-soft text-primary-strong flex size-11 shrink-0 items-center justify-center rounded-xl"
      >
        <FolderKanban aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <ProjectStatusBadge status={project.status} />
          {project.archivedAt ? (
            <span className="bg-muted text-muted-foreground inline-flex rounded-full px-2.5 py-1 text-xs font-semibold">
              Archivado
            </span>
          ) : null}
          <span className="text-primary text-xs font-semibold">
            {PROJECT_TYPE_LABELS[project.type]}
          </span>
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
          {project.name}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <p className="text-foreground font-medium">{project.client.name}</p>
          {project.internalReference ? (
            <p className="border-border text-muted-foreground border-l pl-3 text-xs font-medium">
              Referencia {project.internalReference}
            </p>
          ) : null}
        </div>
        {project.description ? (
          <p className="text-muted-foreground max-w-3xl text-sm leading-5">
            {project.description}
          </p>
        ) : null}
      </div>
    </header>
  );
}

export function ProjectSummary({ project }: { project: Project }) {
  return (
    <section
      aria-label="Resumen del proyecto"
      className="rounded-card border-border bg-card shadow-panel relative overflow-hidden border"
    >
      <div
        aria-hidden="true"
        className="bg-primary absolute inset-x-0 top-0 h-1"
      />
      <div className="grid gap-5 p-5 pt-6 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <ProjectSummaryHeader project={project} />
        <div
          aria-label="Fechas del proyecto"
          className="border-border bg-muted/25 rounded-control grid grid-cols-2 gap-x-6 border px-4 py-3 lg:min-w-72"
        >
          <ProjectDate label="Inicio" value={project.startDate} />
          <ProjectDate label="Final" value={project.endDate} />
        </div>
      </div>
    </section>
  );
}
