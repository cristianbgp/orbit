import {
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/calendar-date-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  ProjectAssignment,
  ProjectStage,
  ProjectTask,
  ProjectTaskStatus,
} from "@/lib/api/generated/models";
import { PROJECT_TASK_STATUS_LABELS } from "./project-task-labels";
import { ProjectTaskResponsibleSelector } from "./project-task-responsible-selector";

export type ProjectTaskFormInput = {
  title: string;
  stageId: string;
  description: string | null;
  status: ProjectTaskStatus;
  plannedStartDate: string | null;
  internalDueDate: string | null;
  responsibleUserIds: string[];
};

type ProjectTaskFormProps = {
  projectStartDate: string;
  stages: ProjectStage[];
  activeAssignments: ProjectAssignment[];
  initialTask?: ProjectTask;
  defaultStageId?: string;
  submitOnEnter?: boolean;
  onSubmit(input: ProjectTaskFormInput): Promise<void> | void;
  onCancel(): void;
};

type FormValues = {
  title: string;
  stageId: string;
  description: string;
  status: ProjectTaskStatus;
  plannedStartDate: string;
  internalDueDate: string;
  responsibleUserIds: string[];
};

function initialValues(
  stages: ProjectStage[],
  initialTask: ProjectTask | undefined,
  defaultStageId: string | undefined,
): FormValues {
  return {
    title: initialTask?.title ?? "",
    stageId: initialTask?.stage.id ?? defaultStageId ?? stages[0]?.id ?? "",
    description: initialTask?.description ?? "",
    status: initialTask?.status ?? "pending",
    plannedStartDate: initialTask?.plannedStartDate ?? "",
    internalDueDate: initialTask?.internalDueDate ?? "",
    responsibleUserIds:
      initialTask?.responsibles.flatMap(({ userId }) =>
        userId === null ? [] : [userId],
      ) ?? [],
  };
}

export function ProjectTaskForm({
  projectStartDate,
  stages,
  activeAssignments,
  initialTask,
  defaultStageId,
  submitOnEnter = false,
  onSubmit,
  onCancel,
}: ProjectTaskFormProps) {
  const [values, setValues] = useState(() =>
    initialValues(stages, initialTask, defaultStageId),
  );
  const [titleError, setTitleError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(initialTask);
  const idPrefix = useId();
  const titleId = `${idPrefix}-project-task-title`;
  const titleErrorId = `${idPrefix}-project-task-title-error`;
  const stageId = `${idPrefix}-project-task-stage`;
  const statusId = `${idPrefix}-project-task-status`;
  const descriptionId = `${idPrefix}-project-task-description`;
  const datesId = `${idPrefix}-project-task-dates`;
  const plannedStartBeforeProject = Boolean(
    values.plannedStartDate && values.plannedStartDate < projectStartDate,
  );
  const plannedStartError = plannedStartBeforeProject
    ? "El inicio planificado no puede ser anterior a la fecha de inicio del proyecto."
    : undefined;

  function setValue<Key extends keyof FormValues>(
    key: Key,
    value: FormValues[Key],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    if (key === "title") setTitleError(null);
    setFormError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const title = values.title.trim();
    if (title.length < 2) {
      setTitleError(
        title.length === 0
          ? "Ingresa el título de la tarea."
          : "Ingresa al menos 2 caracteres.",
      );
      titleRef.current?.focus();
      return;
    }
    if (!values.stageId) {
      setFormError("Selecciona una etapa para la tarea.");
      return;
    }
    if (plannedStartBeforeProject) return;
    if (values.internalDueDate && !values.plannedStartDate) {
      setFormError(
        "Selecciona un inicio planificado para usar una fecha límite.",
      );
      return;
    }
    if (
      values.plannedStartDate &&
      values.internalDueDate &&
      values.plannedStartDate > values.internalDueDate
    ) {
      setFormError(
        "El inicio planificado no puede ser posterior a la fecha límite.",
      );
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await onSubmit({
        title,
        stageId: values.stageId,
        description: values.description.trim() || null,
        status: values.status,
        plannedStartDate: values.plannedStartDate || null,
        internalDueDate: values.internalDueDate || null,
        responsibleUserIds: values.responsibleUserIds,
      });
    } catch {
      setFormError("No pudimos guardar la tarea. Inténtalo nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function submitTitleWithEnter(event: KeyboardEvent<HTMLFormElement>) {
    if (
      !submitOnEnter ||
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing ||
      event.target !== titleRef.current
    ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.requestSubmit();
  }

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={submit}
      onKeyDown={submitTitleWithEnter}
    >
      <div className="space-y-2">
        <label htmlFor={titleId} className="block text-sm font-semibold">
          Título
        </label>
        <Input
          id={titleId}
          ref={titleRef}
          maxLength={160}
          value={values.title}
          aria-invalid={Boolean(titleError)}
          aria-describedby={titleError ? titleErrorId : undefined}
          onChange={(event) => setValue("title", event.target.value)}
        />
        {titleError ? (
          <p id={titleErrorId} role="alert" className="text-danger text-sm">
            {titleError}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor={stageId} className="block text-sm font-semibold">
            Etapa
          </label>
          <Select
            value={values.stageId}
            disabled={isSubmitting}
            onValueChange={(value) => setValue("stageId", value)}
          >
            <SelectTrigger id={stageId} className="!h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label htmlFor={statusId} className="block text-sm font-semibold">
            Estado
          </label>
          <Select
            value={values.status}
            disabled={isSubmitting}
            onValueChange={(value) =>
              setValue("status", value as ProjectTaskStatus)
            }
          >
            <SelectTrigger id={statusId} className="!h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROJECT_TASK_STATUS_LABELS).map(
                ([status, label]) => (
                  <SelectItem key={status} value={status}>
                    {label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor={descriptionId} className="block text-sm font-semibold">
          Descripción
        </label>
        <Textarea
          id={descriptionId}
          maxLength={2000}
          value={values.description}
          disabled={isSubmitting}
          onChange={(event) => setValue("description", event.target.value)}
        />
      </div>

      <DateRangePicker
        id={datesId}
        label="Fechas planificadas"
        description="Inicio planificado y fecha límite. La fecha límite es opcional."
        from={values.plannedStartDate}
        to={values.internalDueDate}
        min={projectStartDate}
        error={plannedStartError}
        disabled={isSubmitting}
        onChange={({ from, to }) => {
          setValues((current) => ({
            ...current,
            plannedStartDate: from,
            internalDueDate: to,
          }));
          setFormError(null);
        }}
      />

      <ProjectTaskResponsibleSelector
        assignments={activeAssignments}
        selectedUserIds={values.responsibleUserIds}
        disabled={isSubmitting}
        onChange={(responsibleUserIds) =>
          setValue("responsibleUserIds", responsibleUserIds)
        }
      />

      {formError ? (
        <p role="alert" className="text-danger text-sm">
          {formError}
        </p>
      ) : null}

      <div className="border-border flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || stages.length === 0}>
          {isSubmitting
            ? "Guardando…"
            : isEditing
              ? "Guardar cambios"
              : "Crear tarea"}
        </Button>
      </div>
    </form>
  );
}
