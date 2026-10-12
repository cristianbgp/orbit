import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import { ProjectTaskResponsibleGroups } from "./project-task-responsible-groups";
import type {
  ProjectTask,
  ProjectTaskStatus,
} from "@/lib/api/generated/models";
import { formatProjectCalendarDate } from "./project-presentation";
import { ProjectTaskStatusBadge } from "./project-task-status-badge";
import { ProjectTaskStatusSelect } from "./project-task-status-select";

type ProjectTaskListProps = {
  tasks: ProjectTask[];
  view: "active" | "archived";
  disabled?: boolean;
  readOnly?: boolean;
  taskOpenerRef?: RefObject<HTMLElement | null>;
  onEdit(task: ProjectTask): void;
  onArchive(task: ProjectTask): void;
  updatingTaskIds?: ReadonlySet<string>;
  onStatusChange(task: ProjectTask, status: ProjectTaskStatus): void;
};

function groups(tasks: ProjectTask[]) {
  const result: Array<{
    stage: ProjectTask["stage"];
    tasks: ProjectTask[];
  }> = [];
  for (const task of tasks) {
    const current = result.at(-1);
    if (current?.stage.id === task.stage.id) current.tasks.push(task);
    else result.push({ stage: task.stage, tasks: [task] });
  }
  return result;
}

export function ProjectTaskList({
  tasks,
  view,
  disabled = false,
  readOnly = false,
  taskOpenerRef,
  onEdit,
  onArchive,
  updatingTaskIds,
  onStatusChange,
}: ProjectTaskListProps) {
  return (
    <div className="space-y-6">
      {groups(tasks).map(({ stage, tasks: stageTasks }) => (
        <section key={stage.id} aria-labelledby={`task-stage-${stage.id}`}>
          <div className="mb-3 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="border-primary bg-card ring-primary/10 size-2.5 rounded-full border-2 ring-4"
            />
            <h3
              id={`task-stage-${stage.id}`}
              className="text-foreground text-sm font-semibold"
            >
              {stage.name}
            </h3>
          </div>
          <div className="space-y-2">
            {stageTasks.map((task) => (
              <article
                key={task.id}
                className="rounded-control border-border bg-background border p-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-foreground font-semibold">
                        {task.title}
                      </h4>
                      {view === "active" && !readOnly ? (
                        <ProjectTaskStatusSelect
                          taskTitle={task.title}
                          value={task.status}
                          disabled={disabled || updatingTaskIds?.has(task.id)}
                          onValueChange={(status) =>
                            onStatusChange(task, status)
                          }
                        />
                      ) : (
                        <ProjectTaskStatusBadge status={task.status} />
                      )}
                    </div>
                    {task.description ? (
                      <p className="text-muted-foreground max-w-2xl text-sm leading-6">
                        {task.description}
                      </p>
                    ) : null}
                    <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
                      {task.plannedStartDate ? (
                        <span>
                          Inicio planificado:{" "}
                          {formatProjectCalendarDate(task.plannedStartDate)}
                        </span>
                      ) : null}
                      {task.internalDueDate ? (
                        <span>
                          Fecha límite:{" "}
                          {formatProjectCalendarDate(task.internalDueDate)}
                        </span>
                      ) : null}
                      <ProjectTaskResponsibleGroups
                        responsibles={task.responsibles}
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {view === "active" && !readOnly ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          aria-label={`Editar ${task.title}`}
                          onClick={(event) => {
                            if (taskOpenerRef) {
                              taskOpenerRef.current = event.currentTarget;
                            }
                            onEdit(task);
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={disabled}
                          aria-label={`Archivar ${task.title}`}
                          onClick={() => onArchive(task)}
                        >
                          Archivar
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        aria-label={`Ver detalles de ${task.title}`}
                        onClick={(event) => {
                          if (taskOpenerRef) {
                            taskOpenerRef.current = event.currentTarget;
                          }
                          onEdit(task);
                        }}
                      >
                        Ver detalles
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
