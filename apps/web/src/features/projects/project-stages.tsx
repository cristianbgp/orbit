import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useListProjectStages } from "@/lib/api/generated/project-stages/project-stages";
import { useGetProjectTaskSchedule } from "@/lib/api/generated/project-tasks/project-tasks";
import { authClient } from "@/lib/auth-client";
import { ProjectStageEditor } from "./project-stage-editor";
import {
  deriveProjectStageStatus,
  projectStageStatusLabels,
} from "./project-stage-status";
import { ProjectStageStatusIndicator } from "./project-stage-status-indicator";

function ProjectStagesSkeleton() {
  return (
    <section
      aria-label="Cargando etapas"
      className="rounded-card border-border bg-card border p-5 sm:p-6"
    >
      <div className="rounded-control bg-muted h-6 w-24 animate-pulse" />
      <div className="mt-6 space-y-5">
        {[0, 1, 2].map((item) => (
          <div key={item} className="grid grid-cols-[1.25rem_1fr] gap-3">
            <div className="bg-muted mt-1 size-3 animate-pulse rounded-full" />
            <div className="space-y-2">
              <div className="rounded-control bg-muted h-4 w-40 animate-pulse" />
              <div className="rounded-control bg-muted h-3 w-full max-w-sm animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProjectStages({
  projectId,
  readOnly = false,
}: {
  projectId: string;
  readOnly?: boolean;
}) {
  const [editorMode, setEditorMode] = useState<"closed" | "editing" | "adding">(
    "closed",
  );
  const query = useListProjectStages(projectId);
  const scheduleQuery = useGetProjectTaskSchedule(projectId);
  const activeMember = authClient.useActiveMember();

  if (query.isPending) return <ProjectStagesSkeleton />;

  if (query.isError || !query.data) {
    return (
      <section className="rounded-card border-danger/25 bg-card border p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Etapas</h2>
        <p className="text-danger mt-2 text-sm">
          No pudimos cargar las etapas.
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

  const stages = query.data.stages;
  const scheduleStagesById = new Map(
    scheduleQuery.data?.stages.map((stage) => [stage.id, stage]) ?? [],
  );
  const canManageStages =
    !readOnly && !activeMember.isPending && Boolean(activeMember.data);

  if (canManageStages && editorMode !== "closed") {
    return (
      <ProjectStageEditor
        projectId={projectId}
        stages={stages}
        startAdding={editorMode === "adding"}
        onDone={() => setEditorMode("closed")}
      />
    );
  }

  return (
    <section
      aria-labelledby="project-stages-title"
      className="rounded-card border-border bg-card border p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="project-stages-title"
            className="font-display text-lg font-semibold"
          >
            Etapas
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Estructura de etapas de este proyecto.
          </p>
        </div>
        {canManageStages && stages.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditorMode("editing")}
          >
            Editar estructura
          </Button>
        ) : null}
      </div>

      {stages.length === 0 ? (
        <div className="border-primary/40 mt-6 border-l-2 pl-4">
          <p className="text-muted-foreground text-sm">
            Este proyecto todavía no tiene etapas.
          </p>
          {canManageStages ? (
            <Button
              className="mt-4"
              size="sm"
              onClick={() => setEditorMode("adding")}
            >
              Agregar etapa
            </Button>
          ) : null}
        </div>
      ) : (
        <ol aria-label="Etapas del proyecto" className="mt-6">
          {stages.map((stage, index) => {
            const scheduleStage = scheduleStagesById.get(stage.id);
            const stageStatus = scheduleStage
              ? deriveProjectStageStatus(scheduleStage.taskStatusCounts)
              : null;
            return (
              <li
                key={stage.id}
                className="relative grid grid-cols-[1.25rem_1fr] gap-3 pb-5 last:pb-0"
              >
                {stageStatus ? (
                  <ProjectStageStatusIndicator
                    status={stageStatus}
                    display="icon"
                    className="mt-1"
                  />
                ) : (
                  <span
                    aria-label={
                      scheduleQuery.isError
                        ? "Estado de etapa no disponible"
                        : "Cargando estado de etapa"
                    }
                    className="bg-muted mt-1 size-4 animate-pulse rounded-full"
                  />
                )}
                {index < stages.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="bg-border absolute top-5 bottom-0 left-[0.34rem] w-px"
                  />
                ) : null}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-foreground text-sm font-semibold">
                      {stage.name}
                    </h3>
                    {stageStatus ? (
                      <span
                        aria-hidden="true"
                        className="text-muted-foreground text-xs font-semibold"
                      >
                        {projectStageStatusLabels[stageStatus]}
                      </span>
                    ) : null}
                  </div>
                  {stage.description ? (
                    <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
                      {stage.description}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
