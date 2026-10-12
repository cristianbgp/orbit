import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MemberIdentity } from "@/features/identity/member-identity";
import type {
  ProjectActivity,
  ProjectActivityIdentity,
} from "@/lib/api/generated/models";
import { cn } from "@/lib/utils";
import {
  formatCaseAmount,
  formatCaseClaimant,
  formatCasePeriod,
  getCaseLabel,
} from "./case-presenters";
import { CaseStatusBadge } from "./case-status-badge";

const fallback = "Se registró una actividad en el caso.";
const INITIAL_VISIBLE_CHANGES = 3;
const caseUpdateDateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatCaseUpdateDate(value: string | undefined) {
  if (!value) return "Fecha no disponible";
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf())
    ? "Fecha no disponible"
    : caseUpdateDateFormatter.format(parsed);
}

function caseUpdateKindLabel(value: string | undefined) {
  return value === "background" ? "Antecedente" : "Novedad";
}

function caseUpdateSubject(value: string | undefined) {
  return value === "background"
    ? { article: "el", noun: "antecedente" }
    : { article: "la", noun: "novedad" };
}

function caseEventTypeLabel(value: string | undefined) {
  if (value === "oral_argument") return "Informe oral";
  if (value === "interview") return "Entrevista";
  if (value === "other") return "Otro";
  return "Evento";
}

function CaseActionSummary({
  actor,
  activity,
  action,
  assignee,
}: {
  actor: ReactNode;
  activity: ProjectActivity;
  action: string;
  assignee?: ReactNode;
}) {
  const description =
    detail(activity, "newDescription") ?? detail(activity, "description");
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {actor}
      <span>{action}</span>
      {description ? (
        <span className="bg-muted rounded-control px-2 py-0.5 font-medium">
          {description}
        </span>
      ) : (
        <span>una acción del caso</span>
      )}
      {assignee ? (
        <>
          <span>y la asignó a</span>
          {assignee}
        </>
      ) : null}
      <span>.</span>
    </span>
  );
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
  return value?.trim() || null;
}

function detail(activity: ProjectActivity, key: string) {
  const value = nullableDetail(activity, key);
  return value === null ? undefined : value;
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

function CaseResultBadge({ result }: { result: string }) {
  const known =
    result === "founded" || result === "unfounded" || result === "inadmissible";
  return (
    <span
      data-case-result={result}
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        result === "founded" && "bg-success-soft text-success",
        result === "unfounded" && "bg-danger-soft text-danger",
        result === "inadmissible" && "bg-warning-soft text-warning",
        !known && "bg-muted text-muted-foreground",
      )}
    >
      {known ? getCaseLabel("result", result) : "Resultado desconocido"}
    </span>
  );
}

type CaseChange = {
  key: string;
  label: string;
  summaryLabel: string;
  previous: ReactNode;
  next: ReactNode;
};

function textValue(
  value: string | null | undefined,
  format = (item: string) => item,
) {
  return value ? format(value) : "Sin definir";
}

function simpleChange(
  activity: ProjectActivity,
  key: string,
  label: string,
  summaryLabel: string,
  format?: (value: string) => string,
): CaseChange | null {
  const previousKey = `previous${key}`;
  const nextKey = `new${key}`;
  if (!hasDetail(activity, previousKey) && !hasDetail(activity, nextKey)) {
    return null;
  }
  return {
    key,
    label,
    summaryLabel,
    previous: textValue(nullableDetail(activity, previousKey), format),
    next: textValue(nullableDetail(activity, nextKey), format),
  };
}

function caseChanges(activity: ProjectActivity): CaseChange[] {
  const changes: Array<CaseChange | null> = [];

  if (
    hasDetail(activity, "previousClientId") ||
    hasDetail(activity, "newClientId")
  ) {
    changes.push({
      key: "Client",
      label: "el cliente",
      summaryLabel: "cliente",
      previous:
        nullableDetail(activity, "previousClientName") ?? "Cliente anterior",
      next: nullableDetail(activity, "newClientName") ?? "Cliente nuevo",
    });
  }

  changes.push(
    simpleChange(
      activity,
      "Identification",
      "la identificación",
      "identificación",
    ),
    simpleChange(activity, "Type", "el tipo", "tipo", (value) =>
      getCaseLabel("type", value),
    ),
    simpleChange(activity, "Subtype", "el subtipo", "subtipo", (value) =>
      getCaseLabel("subtype", value),
    ),
    simpleChange(activity, "Stage", "la etapa", "etapa", (value) =>
      getCaseLabel("stage", value),
    ),
    simpleChange(activity, "Entity", "la entidad", "entidad", (value) =>
      getCaseLabel("entity", value),
    ),
    simpleChange(
      activity,
      "DocketNumber",
      "el número de expediente",
      "número de expediente",
    ),
    simpleChange(activity, "Tax", "el tributo", "tributo", (value) =>
      getCaseLabel("tax", value),
    ),
  );

  const periodKeys = ["PeriodKind", "PeriodStart", "PeriodEnd"];
  if (
    periodKeys.some(
      (key) =>
        hasDetail(activity, `previous${key}`) ||
        hasDetail(activity, `new${key}`),
    )
  ) {
    changes.push({
      key: "Period",
      label: "el período",
      summaryLabel: "período",
      previous: formatCasePeriod(
        nullableDetail(activity, "previousPeriodKind") ?? null,
        nullableDetail(activity, "previousPeriodStart") ?? null,
        nullableDetail(activity, "previousPeriodEnd") ?? null,
      ),
      next: formatCasePeriod(
        nullableDetail(activity, "newPeriodKind") ?? null,
        nullableDetail(activity, "newPeriodStart") ?? null,
        nullableDetail(activity, "newPeriodEnd") ?? null,
      ),
    });
  }

  if (
    ["Amount", "Currency"].some(
      (key) =>
        hasDetail(activity, `previous${key}`) ||
        hasDetail(activity, `new${key}`),
    )
  ) {
    changes.push({
      key: "Amount",
      label: "el importe",
      summaryLabel: "importe",
      previous: formatCaseAmount(
        nullableDetail(activity, "previousAmount") ?? null,
        nullableDetail(activity, "previousCurrency") ?? null,
      ),
      next: formatCaseAmount(
        nullableDetail(activity, "newAmount") ?? null,
        nullableDetail(activity, "newCurrency") ?? null,
      ),
    });
  }

  if (
    hasDetail(activity, "previousClaimantType") ||
    hasDetail(activity, "newClaimantType")
  ) {
    changes.push({
      key: "ClaimantType",
      label: "el demandante",
      summaryLabel: "demandante",
      previous: formatCaseClaimant(
        nullableDetail(activity, "previousClaimantType") ?? null,
        detail(activity, "previousClientName") ?? "cliente del caso",
      ),
      next: formatCaseClaimant(
        nullableDetail(activity, "newClaimantType") ?? null,
        detail(activity, "newClientName") ?? "cliente del caso",
      ),
    });
  } else {
    changes.push(
      simpleChange(activity, "Claimant", "el demandante", "demandante"),
    );
  }

  changes.push(
    simpleChange(
      activity,
      "DisputedMatter",
      "la materia controvertida",
      "materia controvertida",
    ),
    simpleChange(
      activity,
      "ChallengedResolution",
      "la resolución impugnada",
      "resolución impugnada",
    ),
  );

  const status = simpleChange(activity, "Status", "el estado", "estado");
  if (status) {
    changes.push({
      ...status,
      previous:
        typeof status.previous === "string" &&
        status.previous !== "Sin definir" ? (
          <CaseStatusBadge status={status.previous} />
        ) : (
          status.previous
        ),
      next:
        typeof status.next === "string" && status.next !== "Sin definir" ? (
          <CaseStatusBadge status={status.next} />
        ) : (
          status.next
        ),
    });
  }

  const result = simpleChange(activity, "Result", "el resultado", "resultado");
  if (result) {
    changes.push({
      ...result,
      previous:
        typeof result.previous === "string" &&
        result.previous !== "Sin definir" ? (
          <CaseResultBadge result={result.previous} />
        ) : (
          result.previous
        ),
      next:
        typeof result.next === "string" && result.next !== "Sin definir" ? (
          <CaseResultBadge result={result.next} />
        ) : (
          result.next
        ),
    });
  }

  return changes.filter((change): change is CaseChange => change !== null);
}

function ChangeValues({ change }: { change: CaseChange }) {
  return (
    <span className="grid min-w-0 gap-1 sm:grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] sm:items-start sm:gap-2">
      <span className="text-muted-foreground min-w-0 [overflow-wrap:anywhere]">
        {change.previous}
      </span>
      <span
        aria-hidden="true"
        className="text-muted-foreground hidden text-center sm:block"
      >
        →
      </span>
      <span className="text-foreground min-w-0 font-medium [overflow-wrap:anywhere] before:mr-1.5 before:content-['→'] sm:before:hidden">
        {change.next}
      </span>
    </span>
  );
}

function CaseChangeRow({ change }: { change: CaseChange }) {
  return (
    <div
      role="listitem"
      className="grid min-w-0 gap-1.5 px-3 py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4 sm:px-4"
    >
      <span className="text-muted-foreground text-[0.69rem] font-semibold tracking-[0.08em] uppercase">
        {change.summaryLabel}
      </span>
      <ChangeValues change={change} />
    </div>
  );
}

function CaseChanges({
  actor,
  changes,
}: {
  actor: ReactNode;
  changes: CaseChange[];
}) {
  const [open, setOpen] = useState(false);
  const visible = changes.slice(0, INITIAL_VISIBLE_CHANGES);
  const hidden = changes.slice(INITIAL_VISIBLE_CHANGES);

  return (
    <div
      role="group"
      aria-label={`Actualización del caso: ${changes.length} cambios`}
      className="min-w-0"
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {actor}
        <span>actualizó {changes.length} campos del caso.</span>
      </div>
      <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
        <div
          role="list"
          aria-label="Campos modificados"
          className="divide-border bg-muted/25 rounded-control border-border divide-y border"
        >
          {visible.map((change) => (
            <CaseChangeRow key={change.key} change={change} />
          ))}
          {hidden.length ? (
            <CollapsibleContent>
              <div className="divide-border divide-y border-t">
                {hidden.map((change) => (
                  <CaseChangeRow key={change.key} change={change} />
                ))}
              </div>
            </CollapsibleContent>
          ) : null}
        </div>
        {hidden.length ? (
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="mt-1.5 px-2">
              {open ? "Ocultar cambios" : `Ver ${hidden.length} cambios más`}
            </Button>
          </CollapsibleTrigger>
        ) : null}
      </Collapsible>
    </div>
  );
}

function CaseUpdateSummary({
  actor,
  action,
  activity,
}: {
  actor: ReactNode;
  action: "registró" | "archivó" | "restauró";
  activity: ProjectActivity;
}) {
  const description = detail(activity, "description");
  const subject = caseUpdateSubject(detail(activity, "kind"));
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
      {actor}
      <span>
        {action} {subject.article} {subject.noun}
      </span>
      <span className="text-muted-foreground font-medium">
        del {formatCaseUpdateDate(detail(activity, "date"))}
      </span>
      {description ? (
        <span className="min-w-0 [overflow-wrap:anywhere]">
          — {description}.
        </span>
      ) : (
        <span>.</span>
      )}
    </span>
  );
}

function CaseUpdateChanges({
  actor,
  activity,
}: {
  actor: ReactNode;
  activity: ProjectActivity;
}) {
  const changes: CaseChange[] = [];
  const previousDate = detail(activity, "date");
  const nextDate = detail(activity, "newDate");
  const previousDescription = detail(activity, "description");
  const nextDescription = detail(activity, "newDescription");
  const previousKind = detail(activity, "kind");
  const nextKind = detail(activity, "newKind");
  if (previousDate !== nextDate) {
    changes.push({
      key: "UpdateDate",
      label: "la fecha",
      summaryLabel: "fecha",
      previous: formatCaseUpdateDate(previousDate),
      next: formatCaseUpdateDate(nextDate),
    });
  }
  if (previousDescription !== nextDescription) {
    changes.push({
      key: "UpdateDescription",
      label: "la descripción",
      summaryLabel: "descripción",
      previous: previousDescription ?? "Sin definir",
      next: nextDescription ?? "Sin definir",
    });
  }
  if (previousKind !== nextKind) {
    changes.push({
      key: "UpdateKind",
      label: "la clasificación",
      summaryLabel: "clasificación",
      previous: caseUpdateKindLabel(previousKind),
      next: caseUpdateKindLabel(nextKind),
    });
  }

  if (
    changes.length === 1 &&
    previousKind !== nextKind &&
    nextKind !== undefined
  ) {
    const previousSubject = caseUpdateSubject(previousKind);
    const nextSubject = caseUpdateSubject(nextKind);
    return (
      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {actor}
        <span>
          convirtió {previousSubject.article} {previousSubject.noun} en{" "}
          {nextSubject.noun}.
        </span>
      </span>
    );
  }

  const updateSubject = caseUpdateSubject(previousKind);
  if (!changes.length) {
    return (
      <>
        {actor} actualizó {updateSubject.article} {updateSubject.noun}.
      </>
    );
  }

  return (
    <div
      role="group"
      aria-label={`Actualización de ${updateSubject.article} ${updateSubject.noun}: ${changes.length} ${changes.length === 1 ? "cambio" : "cambios"}`}
      className="min-w-0"
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {actor}
        <span>
          actualizó{" "}
          {changes.length === 1 ? "un campo" : `${changes.length} campos`} de{" "}
          {updateSubject.article} {updateSubject.noun}.
        </span>
      </div>
      <div
        role="list"
        aria-label="Campos modificados de la novedad"
        className="divide-border bg-muted/25 rounded-control border-border mt-3 divide-y border"
      >
        {changes.map((change) => (
          <CaseChangeRow key={change.key} change={change} />
        ))}
      </div>
    </div>
  );
}

function CaseEventSummary({
  actor,
  action,
  activity,
}: {
  actor: ReactNode;
  action: "registró" | "eliminó";
  activity: ProjectActivity;
}) {
  const title = detail(activity, "title") ?? "Sin título";
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
      {actor}
      <span>{action} el evento</span>
      <span className="bg-muted rounded-control px-2 py-0.5 font-medium [overflow-wrap:anywhere]">
        {title}
      </span>
      <span className="text-muted-foreground font-medium">
        {caseEventTypeLabel(detail(activity, "type"))} ·{" "}
        {formatCaseUpdateDate(detail(activity, "date"))}.
      </span>
    </span>
  );
}

function CaseEventChanges({
  actor,
  activity,
}: {
  actor: ReactNode;
  activity: ProjectActivity;
}) {
  const changes: CaseChange[] = [];
  const values = [
    {
      key: "EventTitle",
      label: "el título",
      summaryLabel: "título",
      previous: nullableDetail(activity, "title"),
      next: nullableDetail(activity, "newTitle"),
    },
    {
      key: "EventType",
      label: "el tipo",
      summaryLabel: "tipo",
      previous: nullableDetail(activity, "type"),
      next: nullableDetail(activity, "newType"),
      format: caseEventTypeLabel,
    },
    {
      key: "EventDate",
      label: "la fecha",
      summaryLabel: "fecha",
      previous: nullableDetail(activity, "date"),
      next: nullableDetail(activity, "newDate"),
      format: formatCaseUpdateDate,
    },
    {
      key: "EventDescription",
      label: "la descripción",
      summaryLabel: "descripción",
      previous: nullableDetail(activity, "description"),
      next: nullableDetail(activity, "newDescription"),
    },
  ];

  for (const value of values) {
    if (value.previous === value.next) continue;
    changes.push({
      key: value.key,
      label: value.label,
      summaryLabel: value.summaryLabel,
      previous:
        value.previous === null || value.previous === undefined
          ? "Sin definir"
          : value.format
            ? value.format(value.previous)
            : value.previous,
      next:
        value.next === null || value.next === undefined
          ? "Sin definir"
          : value.format
            ? value.format(value.next)
            : value.next,
    });
  }

  return (
    <div
      role="group"
      aria-label={`Actualización del evento: ${changes.length} cambios`}
      className="min-w-0"
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {actor}
        <span>
          actualizó{" "}
          {changes.length === 1 ? "un campo" : `${changes.length} campos`} del
          evento.
        </span>
      </div>
      <div
        role="list"
        aria-label="Campos modificados del evento"
        className="divide-border bg-muted/25 rounded-control border-border mt-3 divide-y border"
      >
        {changes.map((change) => (
          <CaseChangeRow key={change.key} change={change} />
        ))}
      </div>
    </div>
  );
}

export function CaseActivityMessage({
  activity,
}: {
  activity: ProjectActivity;
}) {
  if (!activity.actor.nameSnapshot.trim()) return fallback;

  const actor = <ActivityMember identity={activity.actor} />;
  const subject = activity.subject?.nameSnapshot.trim() ? (
    <ActivityMember identity={activity.subject} />
  ) : null;

  switch (activity.type) {
    case "case.created": {
      const identification = detail(activity, "identification");
      return identification ? (
        <>
          {actor} creó el caso {identification}.
        </>
      ) : (
        <>{actor} creó el caso.</>
      );
    }
    case "case.archived":
      return <>{actor} archivó el caso.</>;
    case "case.restored":
      return <>{actor} restauró el caso.</>;
    case "case_assignment.added":
      return subject ? (
        <>
          {actor} añadió a {subject}{" "}
          {activity.details.responsibility === "follower"
            ? "al seguimiento del caso."
            : "al equipo del caso."}
        </>
      ) : (
        fallback
      );
    case "case_assignment.removed":
      return subject ? (
        <>
          {actor} retiró a {subject}{" "}
          {activity.details.responsibility === "follower"
            ? "del seguimiento del caso."
            : "del equipo del caso."}
        </>
      ) : (
        fallback
      );
    case "case.updated": {
      const changes = caseChanges(activity);
      if (changes.length === 1) {
        const change = changes[0]!;
        return (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {actor}
            <span>cambió {change.label} de</span>
            <ChangeValues change={change} />
            <span>.</span>
          </span>
        );
      }
      if (changes.length > 1) {
        return <CaseChanges actor={actor} changes={changes} />;
      }
      return <>{actor} actualizó los datos del caso.</>;
    }
    case "case.update_created":
      return (
        <CaseUpdateSummary
          actor={actor}
          action="registró"
          activity={activity}
        />
      );
    case "case.update_changed":
      return <CaseUpdateChanges actor={actor} activity={activity} />;
    case "case.update_archived":
      return (
        <CaseUpdateSummary actor={actor} action="archivó" activity={activity} />
      );
    case "case.update_restored":
      return (
        <CaseUpdateSummary
          actor={actor}
          action="restauró"
          activity={activity}
        />
      );
    case "case.updates_moved_to_background": {
      const count = detail(activity, "count") ?? "varias";
      const singular = count === "1";
      return (
        <>
          {actor} convirtió {count} {singular ? "novedad" : "novedades"} en{" "}
          {singular ? "antecedente" : "antecedentes"}.
        </>
      );
    }
    case "case.action_created":
      return (
        <CaseActionSummary
          actor={actor}
          activity={activity}
          action="creó la acción"
          assignee={subject}
        />
      );
    case "case.action_updated":
      return (
        <CaseActionSummary
          actor={actor}
          activity={activity}
          action="actualizó la acción"
        />
      );
    case "case.action_assigned": {
      const description = detail(activity, "description");
      const assignedName = detail(activity, "newAssigneeName");
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {actor}
          <span>{assignedName ? "asignó" : "dejó sin encargado"}</span>
          {description ? (
            <span className="bg-muted rounded-control px-2 py-0.5 font-medium">
              {description}
            </span>
          ) : (
            <span>la acción</span>
          )}
          {assignedName ? (
            <>
              <span>a</span>
              {subject ?? <span className="font-medium">{assignedName}</span>}
            </>
          ) : null}
          <span>.</span>
        </span>
      );
    }
    case "case.action_completed":
      return (
        <CaseActionSummary
          actor={actor}
          activity={activity}
          action="marcó como completada la acción"
        />
      );
    case "case.action_reopened":
      return (
        <CaseActionSummary
          actor={actor}
          activity={activity}
          action="reabrió la acción"
        />
      );
    case "case.action_archived":
      return (
        <CaseActionSummary
          actor={actor}
          activity={activity}
          action="archivó la acción"
        />
      );
    case "case.action_restored":
      return (
        <CaseActionSummary
          actor={actor}
          activity={activity}
          action="restauró la acción"
        />
      );
    case "case.event_created":
      return (
        <CaseEventSummary actor={actor} action="registró" activity={activity} />
      );
    case "case.event_updated":
      return <CaseEventChanges actor={actor} activity={activity} />;
    case "case.event_deleted":
      return (
        <CaseEventSummary actor={actor} action="eliminó" activity={activity} />
      );
    default:
      return fallback;
  }
}
