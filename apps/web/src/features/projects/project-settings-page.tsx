import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FolderKanban } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppPage, AppPageContent } from "@/features/layout/app-page";
import { AppPageHeader } from "@/features/layout/app-page-header";
import { getListProjectActivitiesQueryKey } from "@/lib/api/generated/activity/activity";
import type { Project, ProjectInput } from "@/lib/api/generated/models";
import {
  getGetProjectQueryKey,
  getListProjectsQueryKey,
  useArchiveProject,
  useGetProject,
  useRestoreProject,
  useUpdateProject,
} from "@/lib/api/generated/projects/projects";
import { ApiClientError } from "@/lib/api/fetcher";
import { ProjectForm } from "./project-form";
import { ProjectEventsSettings } from "./project-events-settings";
import { ProjectStages } from "./project-stages";
import { ProjectTeam } from "./project-team";

function ProjectLifecycleSettings({
  project,
  confirmingArchive,
  lifecyclePending,
  archivePending,
  restorePending,
  error,
  onBeginArchive,
  onCancelArchive,
  onArchive,
  onRestore,
}: {
  project: Project;
  confirmingArchive: boolean;
  lifecyclePending: boolean;
  archivePending: boolean;
  restorePending: boolean;
  error: string | null;
  onBeginArchive(): void;
  onCancelArchive(): void;
  onArchive(): void;
  onRestore(): void;
}) {
  const archived = project.archivedAt !== null;
  const archiveTriggerRef = useRef<HTMLButtonElement>(null);
  const cancelArchiveRef = useRef<HTMLButtonElement>(null);
  const restoreTriggerRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingArchive = useRef(false);

  useEffect(() => {
    if (confirmingArchive) cancelArchiveRef.current?.focus();
    else if (wasConfirmingArchive.current) {
      const nextTrigger = archived
        ? restoreTriggerRef.current
        : archiveTriggerRef.current;
      nextTrigger?.focus();
    }
    wasConfirmingArchive.current = confirmingArchive;
  }, [archived, confirmingArchive]);

  return (
    <section
      aria-labelledby="project-lifecycle-title"
      className="rounded-card border-border bg-card shadow-panel border p-5 sm:p-6"
    >
      <h2
        id="project-lifecycle-title"
        className="font-display text-lg font-semibold"
      >
        Estado del proyecto
      </h2>
      <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
        {archived
          ? "Restaura el proyecto para volver a editarlo y continuar su trabajo."
          : "Archiva el proyecto cuando ya no forme parte del trabajo activo del estudio."}
      </p>

      {error ? (
        <p
          role="alert"
          className="border-danger/25 bg-danger-soft text-danger rounded-control mt-4 border px-4 py-3 text-sm"
        >
          {error}
        </p>
      ) : null}

      {archived ? (
        <Button
          ref={restoreTriggerRef}
          className="mt-5"
          disabled={lifecyclePending}
          onClick={onRestore}
        >
          {restorePending ? "Restaurando…" : "Restaurar proyecto"}
        </Button>
      ) : confirmingArchive ? (
        <div
          role="group"
          aria-label="Confirmar archivo del proyecto"
          className="border-danger/25 bg-danger-soft rounded-control mt-5 border p-4"
        >
          <p className="text-sm font-semibold">Archivar este proyecto</p>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            El historial permanecerá disponible y podrás restaurar el proyecto
            más adelante.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              ref={cancelArchiveRef}
              variant="outline"
              disabled={lifecyclePending}
              onClick={onCancelArchive}
            >
              Cancelar archivo
            </Button>
            <Button
              variant="destructive"
              disabled={lifecyclePending}
              onClick={onArchive}
            >
              {archivePending ? "Archivando…" : "Confirmar archivo"}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          ref={archiveTriggerRef}
          className="mt-5"
          variant="outline"
          disabled={lifecyclePending}
          onClick={onBeginArchive}
        >
          Archivar proyecto
        </Button>
      )}
    </section>
  );
}

function BackToProjectLink({ projectId }: { projectId: string }) {
  return (
    <Link
      to={`/projects/${projectId}`}
      className="text-primary hover:text-primary-strong focus-visible:ring-ring inline-flex text-sm font-semibold outline-none focus-visible:ring-2"
    >
      Volver al proyecto
    </Link>
  );
}

function ProjectSettingsSkeleton() {
  return (
    <AppPage
      aria-label="Cargando configuración del proyecto"
      className="space-y-5 py-5 lg:py-7"
    >
      <div className="bg-muted rounded-control h-5 w-36 animate-pulse" />
      <div className="border-border space-y-3 border-b pb-5">
        <div className="bg-muted rounded-control h-8 w-72 animate-pulse" />
        <div className="bg-muted rounded-control h-5 w-48 animate-pulse" />
      </div>
      <div className="bg-muted rounded-card h-80 animate-pulse" />
    </AppPage>
  );
}

function ProjectSettingsNotFound() {
  return (
    <AppPage className="grid place-items-center py-12">
      <div className="border-border bg-card shadow-panel rounded-card w-full max-w-lg space-y-5 border p-7">
        <div className="border-primary space-y-2 border-l-2 pl-4">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.03em]">
            Proyecto no encontrado
          </h1>
          <p className="text-muted-foreground text-sm leading-6">
            El proyecto no está disponible en este estudio.
          </p>
        </div>
        <Link
          to="/projects"
          className="text-primary hover:text-primary-strong focus-visible:ring-ring inline-flex text-sm font-semibold outline-none focus-visible:ring-2"
        >
          Volver a proyectos
        </Link>
      </div>
    </AppPage>
  );
}

function ProjectSettingsLoadError({
  projectId,
  onRetry,
}: {
  projectId: string;
  onRetry(): void;
}) {
  return (
    <AppPage className="grid place-items-center py-12">
      <div className="border-border bg-card shadow-panel rounded-card w-full max-w-lg space-y-5 border p-7">
        <div className="border-danger space-y-2 border-l-2 pl-4">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.03em]">
            No pudimos cargar la configuración
          </h1>
          <p className="text-muted-foreground text-sm leading-6">
            Revisa tu conexión e inténtalo nuevamente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="outline" size="sm" onClick={onRetry}>
            Intentar de nuevo
          </Button>
          <BackToProjectLink projectId={projectId} />
        </div>
      </div>
    </AppPage>
  );
}

export function ProjectSettingsPage() {
  const { projectId = "" } = useParams();
  const queryClient = useQueryClient();
  const [savedProject, setSavedProject] = useState<Project | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const projectQuery = useGetProject(projectId, {
    query: { enabled: Boolean(projectId) },
  });
  const updateMutation = useUpdateProject();
  const archiveMutation = useArchiveProject();
  const restoreMutation = useRestoreProject();
  const lifecyclePending =
    archiveMutation.isPending || restoreMutation.isPending;
  const notFound =
    !projectId ||
    (projectQuery.error instanceof ApiClientError &&
      projectQuery.error.status === 404);

  if (projectQuery.isPending && projectId) return <ProjectSettingsSkeleton />;
  if (notFound) return <ProjectSettingsNotFound />;
  if (projectQuery.isError || !projectQuery.data) {
    return (
      <ProjectSettingsLoadError
        projectId={projectId}
        onRetry={() => void projectQuery.refetch()}
      />
    );
  }

  const queriedProject = projectQuery.data.project;
  const project =
    savedProject?.id === queriedProject.id ? savedProject : queriedProject;
  const readOnly = project.archivedAt !== null;

  async function refreshProject() {
    await Promise.allSettled([
      queryClient.invalidateQueries({
        queryKey: getGetProjectQueryKey(project.id),
      }),
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() }),
      queryClient.invalidateQueries({
        queryKey: getListProjectActivitiesQueryKey(project.id),
      }),
    ]);
  }

  async function updateProject(input: ProjectInput) {
    const result = await updateMutation.mutateAsync({
      projectId: project.id,
      data: input,
    });
    setSavedProject(result.project);
    setFormVersion((current) => current + 1);
    await refreshProject();
  }

  async function changeArchiveState(next: "archive" | "restore") {
    setLifecycleError(null);
    try {
      const result = await (next === "archive"
        ? archiveMutation.mutateAsync({ projectId: project.id })
        : restoreMutation.mutateAsync({ projectId: project.id }));
      setSavedProject(result.project);
      setConfirmingArchive(false);
      setFormVersion((current) => current + 1);
      await refreshProject();
    } catch {
      setLifecycleError(
        next === "archive"
          ? "No pudimos archivar el proyecto. Inténtalo nuevamente."
          : "No pudimos restaurar el proyecto. Inténtalo nuevamente.",
      );
    }
  }

  return (
    <AppPage className="py-5 lg:py-7">
      <BackToProjectLink projectId={project.id} />

      <AppPageHeader
        icon={FolderKanban}
        eyebrow="Proyectos"
        title="Configuración del proyecto"
        description={
          <>
            <span className="text-foreground block font-semibold">
              {project.name}
            </span>
            <span className="mt-1 block">
              Administra sus datos, estado, equipo y estructura de trabajo.
            </span>
          </>
        }
        className="mt-5"
      />

      <AppPageContent>
        {readOnly ? (
          <div
            role="status"
            className="border-border bg-muted text-muted-foreground rounded-control border px-4 py-3 text-sm font-medium"
          >
            Este proyecto está archivado. La configuración es de solo lectura.
          </div>
        ) : null}

        <Tabs defaultValue="general" className="w-auto">
          <TabsList variant="line" aria-label="Secciones de configuración">
            <TabsTrigger value="general" className="after:bg-primary px-4 py-3">
              General
            </TabsTrigger>
            <TabsTrigger value="team" className="after:bg-primary px-4 py-3">
              Equipo
            </TabsTrigger>
            <TabsTrigger value="stages" className="after:bg-primary px-4 py-3">
              Etapas
            </TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="mt-5 space-y-5">
            {!readOnly ? (
              <section
                aria-labelledby="project-general-data-title"
                className="rounded-card border-border bg-card shadow-panel border p-5 sm:p-6"
              >
                <div className="mb-5">
                  <h2
                    id="project-general-data-title"
                    className="font-display text-lg font-semibold"
                  >
                    Datos del proyecto
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm leading-6">
                    Actualiza la información general y las fechas del proyecto.
                  </p>
                </div>
                <ProjectForm
                  key={`${project.id}-${project.updatedAt}-${formVersion}`}
                  initialProject={project}
                  onSubmit={updateProject}
                />
              </section>
            ) : null}
            <ProjectEventsSettings
              projectId={project.id}
              projectStartDate={project.startDate}
              readOnly={readOnly}
            />
            <ProjectLifecycleSettings
              project={project}
              confirmingArchive={confirmingArchive}
              lifecyclePending={lifecyclePending}
              archivePending={archiveMutation.isPending}
              restorePending={restoreMutation.isPending}
              error={lifecycleError}
              onBeginArchive={() => {
                setLifecycleError(null);
                setConfirmingArchive(true);
              }}
              onCancelArchive={() => setConfirmingArchive(false)}
              onArchive={() => void changeArchiveState("archive")}
              onRestore={() => void changeArchiveState("restore")}
            />
          </TabsContent>
          <TabsContent value="team" className="mt-5">
            <ProjectTeam projectId={project.id} readOnly={readOnly} />
          </TabsContent>
          <TabsContent value="stages" className="mt-5">
            <ProjectStages projectId={project.id} readOnly={readOnly} />
          </TabsContent>
        </Tabs>
      </AppPageContent>
    </AppPage>
  );
}
