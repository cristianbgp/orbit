import { useRef } from "react";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { AppPage } from "@/features/layout/app-page";
import { useGetProject } from "@/lib/api/generated/projects/projects";
import { ApiClientError } from "@/lib/api/fetcher";
import { ProjectTasks } from "./project-tasks";
import { ProjectActivityFeed } from "./project-activity-feed";
import { ProjectCompletionSuggestion } from "./project-completion-suggestion";
import { ProjectSummary } from "./project-summary";
import { ProjectEventsSettings } from "./project-events-settings";

function BackToProjectsLink() {
  return (
    <Link
      to="/projects"
      className="text-primary hover:text-primary-strong focus-visible:ring-ring inline-flex text-sm font-semibold outline-none focus-visible:ring-2"
    >
      Volver a proyectos
    </Link>
  );
}

function ProjectDetailSkeleton() {
  return (
    <AppPage aria-label="Cargando proyecto" className="space-y-6 py-5 lg:py-7">
      <div className="rounded-control bg-muted h-5 w-32 animate-pulse" />
      <div className="border-border space-y-3 border-b pb-5">
        <div className="rounded-control bg-muted h-6 w-36 animate-pulse" />
        <div className="rounded-control bg-muted h-10 max-w-xl animate-pulse" />
        <div className="rounded-control bg-muted h-5 w-64 animate-pulse" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="rounded-control bg-muted h-22 animate-pulse"
          />
        ))}
      </div>
      <div className="rounded-card bg-muted h-44 animate-pulse" />
    </AppPage>
  );
}

function ProjectNotFound() {
  return (
    <AppPage className="grid place-items-center py-12">
      <div className="rounded-card border-border bg-card shadow-panel w-full max-w-lg space-y-5 border p-7">
        <div className="border-primary space-y-2 border-l-2 pl-4">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.03em]">
            Proyecto no encontrado
          </h1>
          <p className="text-muted-foreground text-sm leading-6">
            El proyecto no está disponible en este estudio.
          </p>
        </div>
        <BackToProjectsLink />
      </div>
    </AppPage>
  );
}

function ProjectLoadError({ onRetry }: { onRetry(): void }) {
  return (
    <AppPage className="grid place-items-center py-12">
      <div className="rounded-card border-border bg-card shadow-panel w-full max-w-lg space-y-5 border p-7">
        <div className="border-danger space-y-2 border-l-2 pl-4">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.03em]">
            No pudimos cargar el proyecto
          </h1>
          <p className="text-muted-foreground text-sm leading-6">
            Revisa tu conexión e inténtalo nuevamente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="outline" size="sm" onClick={onRetry}>
            Intentar de nuevo
          </Button>
          <BackToProjectsLink />
        </div>
      </div>
    </AppPage>
  );
}

export function ProjectDetailPage() {
  const { projectId = "" } = useParams();
  const taskOpenerRef = useRef<HTMLElement | null>(null);
  const projectQuery = useGetProject(projectId, {
    query: { enabled: Boolean(projectId) },
  });
  const notFound =
    !projectId ||
    (projectQuery.error instanceof ApiClientError &&
      projectQuery.error.status === 404);

  if (projectQuery.isPending && projectId) return <ProjectDetailSkeleton />;
  if (notFound) return <ProjectNotFound />;
  if (projectQuery.isError || !projectQuery.data) {
    return <ProjectLoadError onRetry={() => void projectQuery.refetch()} />;
  }

  const project = projectQuery.data.project;
  const readOnly = project.archivedAt !== null;

  return (
    <AppPage className="py-5 lg:py-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <BackToProjectsLink />
        <Button asChild>
          <Link to={`/projects/${project.id}/settings`}>
            Configurar proyecto
          </Link>
        </Button>
      </div>

      {readOnly ? (
        <div
          role="status"
          className="rounded-control border-border bg-muted text-muted-foreground mb-5 border px-4 py-3 text-sm font-medium"
        >
          Este proyecto está archivado y es de solo lectura.
        </div>
      ) : null}
      <div>
        <ProjectSummary project={project} />
        <div className="mt-5">
          <ProjectEventsSettings
            projectId={project.id}
            projectStartDate={project.startDate}
            readOnly
          />
        </div>

        <ProjectCompletionSuggestion project={project} />

        <section
          aria-label="Panel del proyecto"
          className="mt-5 grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-12"
        >
          <section
            aria-label="Flujo de trabajo del proyecto"
            className="min-w-0 space-y-5 xl:col-span-12"
          >
            <ProjectTasks
              projectId={project.id}
              projectStartDate={project.startDate}
              projectStatus={project.status}
              taskOpenerRef={taskOpenerRef}
              readOnly={readOnly}
            />
          </section>
        </section>

        <div className="mt-5">
          <ProjectActivityFeed
            projectId={project.id}
            taskOpenerRef={taskOpenerRef}
          />
        </div>
      </div>
    </AppPage>
  );
}
