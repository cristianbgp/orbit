import { useState, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { ProjectTaskResponsibleGroups } from "./project-task-responsible-groups";
import type {
  ProjectStage,
  ProjectTask,
  ProjectTaskScheduleStageTaskStatusCounts,
  ProjectTaskStatus,
} from "@/lib/api/generated/models";
import { cn } from "@/lib/utils";
import { formatProjectCalendarDate } from "./project-presentation";
import { ProjectTaskStatusBadge } from "./project-task-status-badge";
import { ProjectTaskStatusSelect } from "./project-task-status-select";
import {
  deriveProjectStageStatus,
  projectStageStatusLabels,
  type ProjectStageStatus,
} from "./project-stage-status";
import { ProjectStageStatusIndicator } from "./project-stage-status-indicator";

type ProjectTaskBoardProps = {
  stages: ProjectStage[];
  tasks: ProjectTask[];
  stageTaskStatusCounts?: Readonly<
    Record<string, ProjectTaskScheduleStageTaskStatusCounts>
  >;
  disabled?: boolean;
  readOnly?: boolean;
  taskOpenerRef?: RefObject<HTMLElement | null>;
  onCreate(stageId: string): void;
  onEdit(task: ProjectTask): void;
  onArchive(task: ProjectTask): void;
  updatingTaskIds?: ReadonlySet<string>;
  onStatusChange(task: ProjectTask, status: ProjectTaskStatus): void;
};

type TaskCardProps = {
  task: ProjectTask;
  disabled: boolean;
  readOnly: boolean;
  taskOpenerRef?: RefObject<HTMLElement | null>;
  onEdit(task: ProjectTask): void;
  onArchive(task: ProjectTask): void;
  updatingTaskIds?: ReadonlySet<string>;
  onStatusChange(task: ProjectTask, status: ProjectTaskStatus): void;
};

type StageColumnProps = {
  stage: ProjectStage;
  tasks: ProjectTask[];
  stageStatus: ProjectStageStatus | null;
  disabled: boolean;
  readOnly: boolean;
  mobileActive: boolean;
  taskOpenerRef?: RefObject<HTMLElement | null>;
  onCreate(stageId: string): void;
  onEdit(task: ProjectTask): void;
  onArchive(task: ProjectTask): void;
  updatingTaskIds?: ReadonlySet<string>;
  onStatusChange(task: ProjectTask, status: ProjectTaskStatus): void;
};

function TaskCard({
  task,
  disabled,
  readOnly,
  taskOpenerRef,
  onEdit,
  onArchive,
  updatingTaskIds,
  onStatusChange,
}: TaskCardProps) {
  return (
    <article className="rounded-control border-border bg-card border p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm leading-5 font-semibold">{task.title}</h4>
        {readOnly ? (
          <ProjectTaskStatusBadge
            status={task.status}
            className="shrink-0 px-2 text-[0.65rem]"
          />
        ) : (
          <ProjectTaskStatusSelect
            taskTitle={task.title}
            value={task.status}
            disabled={disabled || updatingTaskIds?.has(task.id)}
            className="shrink-0 text-[0.65rem]"
            onValueChange={(status) => onStatusChange(task, status)}
          />
        )}
      </div>
      {task.plannedStartDate || task.internalDueDate ? (
        <div className="text-muted-foreground mt-3 space-y-1 text-xs font-medium">
          {task.plannedStartDate ? (
            <p>Inicio · {formatProjectCalendarDate(task.plannedStartDate)}</p>
          ) : null}
          {task.internalDueDate ? (
            <p>
              Fecha límite · {formatProjectCalendarDate(task.internalDueDate)}
            </p>
          ) : null}
        </div>
      ) : null}
      {task.responsibles.length > 0 ? (
        <div className="mt-2 min-w-0">
          <ProjectTaskResponsibleGroups responsibles={task.responsibles} />
        </div>
      ) : null}
      <div className="border-border mt-3 flex gap-1 border-t pt-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-label={readOnly ? `Ver detalles de ${task.title}` : undefined}
          onClick={(event) => {
            if (taskOpenerRef) taskOpenerRef.current = event.currentTarget;
            onEdit(task);
          }}
        >
          {readOnly ? "Ver detalles" : "Editar"}
        </Button>
        {!readOnly ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-label={`Archivar ${task.title}`}
            onClick={() => onArchive(task)}
          >
            Archivar
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function StageColumn({
  stage,
  tasks,
  stageStatus,
  disabled,
  readOnly,
  mobileActive,
  taskOpenerRef,
  onCreate,
  onEdit,
  onArchive,
  updatingTaskIds,
  onStatusChange,
}: StageColumnProps) {
  const headingId = `task-board-stage-${stage.id}`;
  const tabId = `mobile-stage-tab-${stage.id}`;
  const panelId = `mobile-stage-panel-${stage.id}`;

  return (
    <section
      id={mobileActive ? panelId : undefined}
      role={mobileActive ? "tabpanel" : undefined}
      aria-labelledby={mobileActive ? tabId : headingId}
      className={cn(
        "rounded-card border-border bg-background/75 w-full border p-3 md:w-[17.5rem]",
        mobileActive ? "block" : "hidden md:block",
      )}
    >
      <div className="border-border mb-3 flex items-center justify-between gap-3 border-b pb-3">
        <div className="flex min-w-0 items-center gap-2">
          {stageStatus ? (
            <ProjectStageStatusIndicator status={stageStatus} display="icon" />
          ) : (
            <span
              aria-label="Cargando estado de etapa"
              className="bg-muted size-4 animate-pulse rounded-full"
            />
          )}
          <h3 id={headingId} className="truncate text-sm font-semibold">
            {stage.name}
          </h3>
        </div>
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
          {tasks.length}
        </span>
      </div>

      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            disabled={disabled}
            readOnly={readOnly}
            taskOpenerRef={taskOpenerRef}
            onEdit={onEdit}
            onArchive={onArchive}
            updatingTaskIds={updatingTaskIds}
            onStatusChange={onStatusChange}
          />
        ))}
        {tasks.length === 0 ? (
          <p className="rounded-control border-border text-muted-foreground border border-dashed px-3 py-5 text-center text-xs">
            Sin tareas en esta etapa
          </p>
        ) : null}
      </div>

      {!readOnly ? (
        <Button
          className="mt-3 min-h-11 w-full justify-start lg:min-h-9"
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-label={`Nueva tarea en ${stage.name}`}
          onClick={() => onCreate(stage.id)}
        >
          + Nueva tarea
        </Button>
      ) : null}
    </section>
  );
}

export function ProjectTaskBoard({
  stages,
  tasks,
  stageTaskStatusCounts,
  disabled = false,
  readOnly = false,
  taskOpenerRef,
  onCreate,
  onEdit,
  onArchive,
  updatingTaskIds,
  onStatusChange,
}: ProjectTaskBoardProps) {
  const [requestedStageId, setRequestedStageId] = useState(
    () => stages[0]?.id ?? "",
  );
  const selectedStage =
    stages.find(({ id }) => id === requestedStageId) ?? stages[0];
  const selectedStageId = selectedStage?.id ?? "";

  return (
    <div
      className="w-full max-w-full min-w-0 overflow-hidden"
      style={{ contain: "inline-size layout paint" }}
    >
      <div
        role="tablist"
        aria-label="Etapas del tablero"
        className="mb-3 flex gap-2 overflow-x-auto pb-2 md:hidden"
      >
        {stages.map((stage) => {
          const taskCount = tasks.filter(
            (task) => task.stage.id === stage.id,
          ).length;
          const selected = stage.id === selectedStageId;
          const counts = stageTaskStatusCounts?.[stage.id];
          const stageStatus = counts ? deriveProjectStageStatus(counts) : null;
          const taskLabel = `${taskCount} ${taskCount === 1 ? "tarea" : "tareas"}`;
          return (
            <button
              key={stage.id}
              id={`mobile-stage-tab-${stage.id}`}
              type="button"
              role="tab"
              aria-label={`${stage.name}, ${taskLabel}, ${stageStatus ? projectStageStatusLabels[stageStatus] : "estado cargando"}`}
              aria-selected={selected}
              aria-controls={`mobile-stage-panel-${stage.id}`}
              className={cn(
                "rounded-control focus-visible:ring-ring inline-flex min-h-11 shrink-0 items-center gap-2 border px-3 text-sm font-semibold outline-none focus-visible:ring-2",
                selected
                  ? "border-primary bg-primary/10 text-primary-strong"
                  : "border-border bg-card text-muted-foreground",
              )}
              onClick={() => setRequestedStageId(stage.id)}
            >
              {stageStatus ? (
                <ProjectStageStatusIndicator
                  status={stageStatus}
                  display="icon"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="bg-muted size-4 animate-pulse rounded-full"
                />
              )}
              <span>{stage.name}</span>
              <span className="bg-muted rounded-full px-2 py-0.5 text-xs">
                {taskCount}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="region"
        aria-label="Tablero de tareas desplazable"
        tabIndex={0}
        className="focus-visible:ring-ring w-full max-w-full min-w-0 overflow-x-auto pb-2 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
      >
        <div
          data-testid="project-task-board-columns"
          className="block md:flex md:min-w-max md:gap-3"
        >
          {stages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              tasks={tasks.filter((task) => task.stage.id === stage.id)}
              stageStatus={
                stageTaskStatusCounts?.[stage.id]
                  ? deriveProjectStageStatus(stageTaskStatusCounts[stage.id])
                  : null
              }
              disabled={disabled}
              readOnly={readOnly}
              mobileActive={stage.id === selectedStageId}
              taskOpenerRef={taskOpenerRef}
              onCreate={onCreate}
              onEdit={onEdit}
              onArchive={onArchive}
              updatingTaskIds={updatingTaskIds}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
