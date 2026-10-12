import type { RefObject } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { MemberIdentity } from "@/features/identity/member-identity";
import type {
  ProjectActivity,
  ProjectActivityIdentity,
  ProjectStatus,
  ProjectTaskStatus,
} from "@/lib/api/generated/models";
import { ProjectTaskStatusBadge } from "./project-task-status-badge";
import { PROJECT_STATUS_LABELS, PROJECT_TYPE_LABELS } from "./project-labels";
import {
  formatProjectCalendarDate,
  ProjectStatusBadge,
} from "./project-presentation";

const fallback = "Se registró una actividad en el proyecto.";
const projectTaskStatuses = new Set<ProjectTaskStatus>([
  "pending",
  "in_progress",
  "blocked",
  "completed",
]);

function isProjectStatus(value: string | undefined): value is ProjectStatus {
  return Boolean(
    value && Object.prototype.hasOwnProperty.call(PROJECT_STATUS_LABELS, value),
  );
}

function isProjectTaskStatus(
  value: string | undefined,
): value is ProjectTaskStatus {
  return Boolean(value && projectTaskStatuses.has(value as ProjectTaskStatus));
}

function detail(activity: ProjectActivity, key: string): string | undefined {
  const value = activity.details[key]?.trim();
  return value || undefined;
}

function hasDetail(activity: ProjectActivity, key: string) {
  return Object.prototype.hasOwnProperty.call(activity.details, key);
}

function nullableDetail(
  activity: ProjectActivity,
  key: string,
): string | null | undefined {
  if (!hasDetail(activity, key)) return undefined;
  const value = activity.details[key];
  if (value === null) return null;
  return value.trim() || null;
}

function responsibilityLabel(value: string | undefined) {
  if (value === "responsible") return "Supervisor del proyecto";
  if (value === "member") return "Miembro del proyecto";
  return null;
}

function changedFieldCount(activity: ProjectActivity, pairs: string[]) {
  return pairs.filter(
    (field) =>
      detail(activity, `previous${field}`) !== undefined ||
      detail(activity, `new${field}`) !== undefined,
  ).length;
}

function projectDetailValue(key: string, value: string | undefined) {
  if (!value) return "sin definir";
  if (key !== "Type") return value;
  return PROJECT_TYPE_LABELS[value as keyof typeof PROJECT_TYPE_LABELS];
}

function ActivityMember({ identity }: { identity: ProjectActivityIdentity }) {
  const fullName = identity.nameSnapshot.trim();

  return identity.linkable && identity.userId ? (
    <MemberIdentity
      compact
      member={{
        userId: identity.userId,
        alias: identity.alias ?? undefined,
        avatarColor: identity.avatarColor,
        fullName,
        activeStudioMember: identity.activeStudioMember,
      }}
      to={`/team/${identity.userId}`}
    />
  ) : (
    <span>{fullName} · Retirado</span>
  );
}

function TaskLink({
  projectId,
  taskId,
  title,
  taskOpenerRef,
}: {
  projectId: string;
  taskId?: string;
  title: string;
  taskOpenerRef?: RefObject<HTMLElement | null>;
}) {
  const [searchParams] = useSearchParams();
  const nextSearchParams = new URLSearchParams(searchParams);
  if (taskId) nextSearchParams.set("task", taskId);

  return taskId ? (
    <Link
      to={{
        pathname: `/projects/${projectId}`,
        search: `?${nextSearchParams.toString()}`,
      }}
      onClick={(event) => {
        if (taskOpenerRef) taskOpenerRef.current = event.currentTarget;
      }}
      className="text-primary-strong decoration-primary/40 hover:decoration-primary focus-visible:ring-ring font-semibold underline underline-offset-2 focus-visible:rounded-sm focus-visible:ring-2 focus-visible:outline-none"
    >
      {title}
    </Link>
  ) : (
    <span>{title}</span>
  );
}

export function ProjectActivityMessage({
  activity,
  projectId,
  taskOpenerRef,
}: {
  activity: ProjectActivity;
  projectId: string;
  taskOpenerRef?: RefObject<HTMLElement | null>;
}) {
  if (!activity.actor.nameSnapshot.trim()) return fallback;

  const actor = <ActivityMember identity={activity.actor} />;
  const taskTitle = detail(activity, "taskTitle");
  const taskId = detail(activity, "taskId");
  const task = taskTitle ? (
    <TaskLink
      projectId={projectId}
      taskId={taskId}
      title={taskTitle}
      taskOpenerRef={taskOpenerRef}
    />
  ) : null;
  const subject = activity.subject?.nameSnapshot.trim() ? (
    <ActivityMember identity={activity.subject} />
  ) : null;

  switch (activity.type) {
    case "project.created": {
      const projectName = detail(activity, "projectName");
      return projectName ? (
        <>
          {actor} creó el proyecto {projectName}.
        </>
      ) : (
        fallback
      );
    }
    case "project.details_changed": {
      const fields = [
        ["Name", "nombre"],
        ["ClientName", "cliente"],
        ["Type", "tipo"],
        ["InternalReference", "referencia interna"],
        ["Description", "descripción"],
      ] as const;
      const changed = fields.filter(
        ([key]) =>
          detail(activity, `previous${key}`) !== undefined ||
          detail(activity, `new${key}`) !== undefined,
      );
      if (changed.length === 1) {
        const [key, label] = changed[0];
        const previous = projectDetailValue(
          key,
          detail(activity, `previous${key}`),
        );
        const next = projectDetailValue(key, detail(activity, `new${key}`));
        if (!previous || !next) return fallback;
        const article =
          key === "InternalReference" || key === "Description" ? "la" : "el";
        return (
          <>
            {actor} cambió {article} {label} del proyecto de {previous} a {next}
            .
          </>
        );
      }
      if (changed.length === 0) return fallback;
      const changes = changed.map(([key, label]) => {
        const previous = projectDetailValue(
          key,
          detail(activity, `previous${key}`),
        );
        const next = projectDetailValue(key, detail(activity, `new${key}`));
        return previous && next ? `${label}, ${previous} → ${next}` : null;
      });
      return changes.every(Boolean) ? (
        <>
          {actor} actualizó los datos del proyecto: {changes.join("; ")}.
        </>
      ) : (
        fallback
      );
    }
    case "project.dates_changed": {
      const fields = [
        ["StartDate", "fecha de inicio"],
        ["EndDate", "fecha final"],
        ["InternalDeadline", "fecha final del modelo anterior"],
        ["LegalDeadline", "fecha legal del modelo anterior"],
      ] as const;
      const count = changedFieldCount(
        activity,
        fields.map(([key]) => key),
      );
      if (count === 1) {
        const changed = fields.find(
          ([key]) =>
            detail(activity, `previous${key}`) !== undefined ||
            detail(activity, `new${key}`) !== undefined,
        );
        if (!changed) return fallback;
        const [key, label] = changed;
        const previous = detail(activity, `previous${key}`);
        const next = detail(activity, `new${key}`);
        if (!previous || !next) return fallback;
        return (
          <>
            {actor} cambió la {label} de {formatProjectCalendarDate(previous)} a{" "}
            {formatProjectCalendarDate(next)}.
          </>
        );
      }
      if (count <= 1) return fallback;
      const changes = fields.flatMap(([key, label]) => {
        const previous = detail(activity, `previous${key}`);
        const next = detail(activity, `new${key}`);
        return previous && next
          ? [
              `${label}, ${formatProjectCalendarDate(previous)} → ${formatProjectCalendarDate(next)}`,
            ]
          : [];
      });
      return changes.length === count ? (
        <>
          {actor} actualizó las fechas: {changes.join("; ")}.
        </>
      ) : (
        fallback
      );
    }
    case "project.event_created": {
      const title = detail(activity, "title");
      const date = detail(activity, "date");
      return title && date ? (
        <>
          {actor} creó el evento legal {title} para el{" "}
          {formatProjectCalendarDate(date)}.
        </>
      ) : (
        fallback
      );
    }
    case "project.event_updated": {
      const title = detail(activity, "title");
      if (!title) return fallback;
      const changes: string[] = [];
      const nextTitle = detail(activity, "newTitle");
      const date = detail(activity, "date");
      const nextDate = detail(activity, "newDate");
      const description = detail(activity, "description") ?? "sin descripción";
      const nextDescription =
        detail(activity, "newDescription") ?? "sin descripción";
      if (nextTitle && nextTitle !== title) {
        changes.push(`nombre, ${title} → ${nextTitle}`);
      }
      if (date && nextDate && nextDate !== date) {
        changes.push(
          `fecha, ${formatProjectCalendarDate(date)} → ${formatProjectCalendarDate(nextDate)}`,
        );
      }
      if (nextDescription !== description) {
        changes.push(`descripción, ${description} → ${nextDescription}`);
      }
      return changes.length ? (
        <>
          {actor} actualizó el evento legal {title}: {changes.join("; ")}.
        </>
      ) : (
        fallback
      );
    }
    case "project.event_deleted": {
      const title = detail(activity, "title");
      const date = detail(activity, "date");
      return title && date ? (
        <>
          {actor} eliminó el evento legal {title} del{" "}
          {formatProjectCalendarDate(date)}.
        </>
      ) : (
        fallback
      );
    }
    case "project.status_changed": {
      const previous = detail(activity, "previousStatus");
      const next = detail(activity, "newStatus");
      if (!isProjectStatus(next)) return fallback;
      return isProjectStatus(previous) ? (
        <>
          {actor} cambió el estado del proyecto de{" "}
          <ProjectStatusBadge status={previous} /> a{" "}
          <ProjectStatusBadge status={next} />.
        </>
      ) : (
        <>
          {actor} cambió el estado del proyecto a{" "}
          <ProjectStatusBadge status={next} />.
        </>
      );
    }
    case "project.archived":
      return <>{actor} archivó el proyecto.</>;
    case "project.restored":
      return <>{actor} restauró el proyecto.</>;
    case "task.created":
      return task ? (
        <>
          {actor} creó la tarea {task}.
        </>
      ) : (
        fallback
      );
    case "task.details_changed": {
      if (!task) return fallback;
      const fields = [
        ["Title", "título", "sin título"],
        ["Description", "descripción", "sin descripción"],
      ] as const;
      const changes = fields.flatMap(([key, label, empty]) => {
        const previous = nullableDetail(activity, `previous${key}`);
        const next = nullableDetail(activity, `new${key}`);
        return previous !== undefined && next !== undefined
          ? [`${label}, ${previous ?? empty} → ${next ?? empty}`]
          : [];
      });
      return changes.length > 0 ? (
        <>
          {actor} actualizó los detalles de {task}: {changes.join("; ")}.
        </>
      ) : (
        fallback
      );
    }
    case "task.dates_changed": {
      if (!task) return fallback;
      const fields = [
        ["PlannedStartDate", "inicio"],
        ["InternalDueDate", "fecha límite"],
      ] as const;
      const changes = fields.flatMap(([key, label]) => {
        const previous = nullableDetail(activity, `previous${key}`);
        const next = nullableDetail(activity, `new${key}`);
        if (previous === undefined || next === undefined) return [];
        return [
          `${label}, ${previous ? formatProjectCalendarDate(previous) : "sin fecha"} → ${next ? formatProjectCalendarDate(next) : "sin fecha"}`,
        ];
      });
      return changes.length > 0 ? (
        <>
          {actor} cambió las fechas de {task}: {changes.join("; ")}.
        </>
      ) : (
        fallback
      );
    }
    case "task.status_changed": {
      const previous = detail(activity, "previousStatus");
      const next = detail(activity, "newStatus");
      if (!task || !isProjectTaskStatus(next)) return fallback;
      return isProjectTaskStatus(previous) ? (
        <>
          {actor} cambió el estado de {task} de{" "}
          <ProjectTaskStatusBadge status={previous} /> a{" "}
          <ProjectTaskStatusBadge status={next} />.
        </>
      ) : (
        <>
          {actor} cambió el estado de {task} a{" "}
          <ProjectTaskStatusBadge status={next} />.
        </>
      );
    }
    case "task.stage_changed": {
      const previousStage = detail(activity, "previousStageName");
      const newStage = detail(activity, "newStageName");
      return task && previousStage && newStage ? (
        <>
          {actor} movió {task} de {previousStage} a {newStage}.
        </>
      ) : (
        fallback
      );
    }
    case "task_assignment.added":
      return task && subject ? (
        <>
          {actor} asignó a {subject} como encargado de {task}.
        </>
      ) : (
        fallback
      );
    case "task_assignment.removed":
      return task && subject ? (
        <>
          {actor} retiró a {subject} de {task}.
        </>
      ) : (
        fallback
      );
    case "task.archived":
      return task ? (
        <>
          {actor} archivó la tarea {task}.
        </>
      ) : (
        fallback
      );
    case "task.restored":
      return task ? (
        <>
          {actor} restauró la tarea {task}.
        </>
      ) : (
        fallback
      );
    case "project.stage_created": {
      const stageId = detail(activity, "stageId");
      const stageName = detail(activity, "stageName");
      return stageId && stageName ? (
        <>
          {actor} creó la etapa {stageName}.
        </>
      ) : (
        fallback
      );
    }
    case "project.stage_details_changed": {
      const stageId = detail(activity, "stageId");
      const stageName = detail(activity, "stageName");
      if (!stageId || !stageName) return fallback;
      const fields = [
        ["Name", "nombre", "sin nombre"],
        ["Description", "descripción", "sin descripción"],
      ] as const;
      const changes = fields.flatMap(([key, label, empty]) => {
        const previous = nullableDetail(activity, `previous${key}`);
        const next = nullableDetail(activity, `new${key}`);
        return previous !== undefined && next !== undefined
          ? [`${label}, ${previous ?? empty} → ${next ?? empty}`]
          : [];
      });
      return changes.length > 0 ? (
        <>
          {actor} actualizó la etapa {stageName}: {changes.join("; ")}.
        </>
      ) : (
        fallback
      );
    }
    case "project.stage_deleted": {
      const stageId = detail(activity, "stageId");
      const stageName = detail(activity, "stageName");
      return stageId && stageName ? (
        <>
          {actor} eliminó la etapa {stageName}.
        </>
      ) : (
        fallback
      );
    }
    case "project.stages_reordered":
      return detail(activity, "previousOrder") &&
        detail(activity, "newOrder") ? (
        <>{actor} reordenó las etapas del proyecto.</>
      ) : (
        fallback
      );
    case "project_assignment.added": {
      if (!subject) return fallback;
      if (detail(activity, "responsibility") === "responsible") {
        return (
          <>
            {actor} asignó a {subject} como Supervisor del proyecto.
          </>
        );
      }
      if (detail(activity, "responsibility") === "member") {
        return (
          <>
            {actor} agregó a {subject} al proyecto.
          </>
        );
      }
      return fallback;
    }
    case "project_assignment.responsibility_changed": {
      const label = responsibilityLabel(detail(activity, "newResponsibility"));
      return subject && label ? (
        <>
          {actor} cambió la supervisión de {subject} a {label}.
        </>
      ) : (
        fallback
      );
    }
    case "project_assignment.removed":
      return subject && detail(activity, "previousResponsibility") ? (
        <>
          {actor} quitó a {subject} del proyecto.
        </>
      ) : (
        fallback
      );
    case "organization_member.removed":
      return subject && detail(activity, "memberId") ? (
        <>
          {actor} retiró a {subject} del estudio. Su participación en este
          proyecto quedó en el historial.
        </>
      ) : (
        fallback
      );
    default:
      return fallback;
  }
}
