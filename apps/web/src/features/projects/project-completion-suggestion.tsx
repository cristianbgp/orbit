import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CircleCheckBig } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getListProjectActivitiesQueryKey } from "@/lib/api/generated/activity/activity";
import type { Project } from "@/lib/api/generated/models/project";
import { useGetProjectTaskSchedule } from "@/lib/api/generated/project-tasks/project-tasks";
import {
  getGetProjectQueryKey,
  getListProjectsQueryKey,
  useUpdateProject,
} from "@/lib/api/generated/projects/projects";

export function ProjectCompletionSuggestion({ project }: { project: Project }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const scheduleQuery = useGetProjectTaskSchedule(project.id, {
    query: {
      enabled: project.status === "active" && project.archivedAt === null,
    },
  });
  const updateProject = useUpdateProject();

  const tasks =
    scheduleQuery.data?.stages.flatMap((stage) => stage.tasks) ?? [];
  const canComplete =
    project.status === "active" &&
    project.archivedAt === null &&
    !scheduleQuery.isError &&
    tasks.length > 0 &&
    tasks.every((task) => task.status === "completed");

  if (!canComplete) return null;

  async function completeProject() {
    if (isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      const result = await updateProject.mutateAsync({
        projectId: project.id,
        data: {
          status: "completed",
        },
      });

      queryClient.setQueryData(getGetProjectQueryKey(project.id), result);
      await Promise.allSettled([
        queryClient.invalidateQueries({
          queryKey: getGetProjectQueryKey(project.id),
        }),
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() }),
        queryClient.invalidateQueries({
          queryKey: getListProjectActivitiesQueryKey(project.id),
        }),
      ]);
    } catch {
      setError("No pudimos completar el proyecto. Inténtalo nuevamente.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="project-completion-suggestion-title"
      className="border-success/30 bg-success-soft/55 rounded-card mt-5 flex flex-col gap-4 border p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 gap-3">
        <span className="bg-background text-success mt-0.5 grid size-9 shrink-0 place-items-center rounded-full shadow-xs">
          <CircleCheckBig aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <h2
            id="project-completion-suggestion-title"
            className="text-sm font-semibold"
          >
            Todas las tareas del proyecto están completadas.
          </h2>
          <p className="text-muted-foreground mt-1 text-sm leading-5">
            El trabajo está listo. Puedes cerrar el proyecto cuando corresponda.
          </p>
        </div>
      </div>

      {isConfirming ? (
        <div
          role="group"
          aria-label="Confirmar proyecto completado"
          className="border-success/25 bg-background/80 rounded-control shrink-0 border p-3 sm:max-w-sm"
        >
          <p className="text-sm font-medium">
            ¿Confirmas que el proyecto está completado?
          </p>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            Dejará de aparecer entre los proyectos en curso.
          </p>
          {error ? (
            <p role="alert" className="text-danger mt-2 text-sm">
              {error}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={() => {
                setIsConfirming(false);
                setError(null);
              }}
            >
              Volver
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={() => void completeProject()}
            >
              {isSaving ? "Completando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => setIsConfirming(true)}
        >
          Marcar proyecto como completado
        </Button>
      )}
    </section>
  );
}
