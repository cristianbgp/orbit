import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Newspaper,
  Pencil,
  Plus,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { calendarDateToDate } from "@/components/ui/calendar-date-picker";
import { MemberIdentity } from "@/features/identity/member-identity";
import { PositionAvatarGroups } from "@/features/identity/position-avatar-groups";
import {
  getListCaseActionsQueryKey,
  useCompleteCaseAction,
  useCreateCaseAction,
  useReopenCaseAction,
  useUpdateCaseAction,
} from "@/lib/api/generated/case-actions/case-actions";
import {
  getListCaseEventCalendarQueryKey,
  getListCaseEventsQueryKey,
  useCreateCaseEvent,
  useUpdateCaseEvent,
} from "@/lib/api/generated/case-events/case-events";
import {
  getListCaseUpdatesQueryKey,
  useCreateCaseUpdate,
  useUpdateCaseUpdate,
} from "@/lib/api/generated/case-updates/case-updates";
import {
  getGetCasePresentationQueryKey,
  getListCaseActivitiesQueryKey,
  getListCasesGroupedByClientQueryKey,
} from "@/lib/api/generated/cases/cases";
import { getListDashboardActivityQueryKey } from "@/lib/api/generated/dashboard/dashboard";
import { getListMyCaseActionsQueryKey } from "@/lib/api/generated/my-work/my-work";
import type {
  CaseActionEntry,
  CaseEvent,
  CasePresentationResponseClientsItemCasesItem,
  CaseUpdateEntry,
} from "@/lib/api/generated/models";
import { CaseActionSheet } from "./case-action-sheet";
import { CaseActionStatusSelect } from "./case-action-status-select";
import { CaseEditSheet } from "./case-edit-sheet";
import { CaseEventSheet } from "./case-event-sheet";
import { CaseEventTypeIcon, type CaseEventType } from "./case-event-types";
import { CasePeopleGroups } from "./case-people-groups";
import { formatCasePeriod, getCaseLabel } from "./case-presenters";
import { CaseStatusBadge } from "./case-status-badge";
import { CaseUpdateSheet } from "./case-update-sheet";

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

type Creation = "update" | "action" | "event" | null;

function SectionHeader({
  title,
  count,
  icon: Icon,
  onCreate,
  description,
}: {
  title: string;
  count: number;
  icon: typeof Newspaper;
  onCreate(): void;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <Icon aria-hidden="true" className="text-primary size-4" />
          {title}
          <span className="text-muted-foreground font-normal">· {count}</span>
        </h3>
        {description ? (
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            {description}
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Añadir ${title.toLocaleLowerCase("es-PE")}`}
        onClick={onCreate}
      >
        <Plus aria-hidden="true" />
      </Button>
    </div>
  );
}

export function CasePresentationCase({
  item,
  clientName,
  organizationDate,
  open,
  onOpenChange,
}: {
  item: CasePresentationResponseClientsItemCasesItem;
  clientName: string;
  organizationDate: string;
  open: boolean;
  onOpenChange(value: boolean): void;
}) {
  const queryClient = useQueryClient();
  const [creation, setCreation] = useState<Creation>(null);
  const [editingUpdate, setEditingUpdate] = useState<CaseUpdateEntry | null>(
    null,
  );
  const [editingAction, setEditingAction] = useState<CaseActionEntry | null>(
    null,
  );
  const [editingEvent, setEditingEvent] = useState<CaseEvent | null>(null);
  const [editingCase, setEditingCase] = useState(false);
  const [showAllBackgrounds, setShowAllBackgrounds] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createUpdate = useCreateCaseUpdate();
  const updateUpdate = useUpdateCaseUpdate();
  const createAction = useCreateCaseAction();
  const updateAction = useUpdateCaseAction();
  const completeAction = useCompleteCaseAction();
  const reopenAction = useReopenCaseAction();
  const createEvent = useCreateCaseEvent();
  const updateEvent = useUpdateCaseEvent();
  const busy = [
    createUpdate,
    updateUpdate,
    createAction,
    updateAction,
    completeAction,
    reopenAction,
    createEvent,
    updateEvent,
  ].some((mutation) => mutation.isPending);
  const context = {
    caseId: item.id,
    caseName: item.identification,
    clientName,
  };
  const members = item.team.map((member) => ({
    userId: member.userId,
    userName: member.fullName,
    userAlias: member.alias,
    userAvatarColor: member.avatarColor,
    position: member.position,
    activeStudioMember: member.activeStudioMember,
  }));

  function refresh(kind: "update" | "action" | "event") {
    void queryClient.invalidateQueries({
      queryKey: getGetCasePresentationQueryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: getListCasesGroupedByClientQueryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: getListCaseActivitiesQueryKey(item.id),
    });
    void queryClient.invalidateQueries({
      queryKey: getListDashboardActivityQueryKey(),
    });
    if (kind === "update") {
      void queryClient.invalidateQueries({
        queryKey: getListCaseUpdatesQueryKey(item.id),
      });
    } else if (kind === "action") {
      void queryClient.invalidateQueries({
        queryKey: getListCaseActionsQueryKey(item.id),
      });
      void queryClient.invalidateQueries({
        queryKey: getListMyCaseActionsQueryKey(),
      });
    } else {
      void queryClient.invalidateQueries({
        queryKey: getListCaseEventsQueryKey(item.id),
      });
      void queryClient.invalidateQueries({
        queryKey: getListCaseEventCalendarQueryKey(),
      });
    }
  }

  async function saveUpdate(values: {
    date: string;
    description: string;
    kind?: "update" | "background";
  }) {
    setError(null);
    try {
      if (editingUpdate) {
        await updateUpdate.mutateAsync({
          caseId: item.id,
          updateId: editingUpdate.id,
          data: { ...values, expectedUpdatedAt: editingUpdate.updatedAt },
        });
      } else await createUpdate.mutateAsync({ caseId: item.id, data: values });
      setCreation(null);
      setEditingUpdate(null);
      refresh("update");
    } catch {
      setError("No pudimos guardar la novedad.");
    }
  }

  async function saveAction(values: {
    description: string;
    assigneeUserId: string | null;
  }) {
    setError(null);
    try {
      if (editingAction) {
        await updateAction.mutateAsync({
          caseId: item.id,
          actionId: editingAction.id,
          data: { ...values, expectedUpdatedAt: editingAction.updatedAt },
        });
      } else await createAction.mutateAsync({ caseId: item.id, data: values });
      setCreation(null);
      setEditingAction(null);
      refresh("action");
    } catch {
      setError("No pudimos guardar la acción.");
    }
  }

  async function saveEvent(values: {
    title: string;
    type: CaseEventType;
    date: string;
    description: string | null;
  }) {
    setError(null);
    try {
      if (editingEvent) {
        await updateEvent.mutateAsync({
          caseId: item.id,
          eventId: editingEvent.id,
          data: { ...values, expectedUpdatedAt: editingEvent.updatedAt },
        });
      } else await createEvent.mutateAsync({ caseId: item.id, data: values });
      setCreation(null);
      setEditingEvent(null);
      refresh("event");
    } catch {
      setError("No pudimos guardar el evento.");
    }
  }

  async function changeActionStatus(
    action: CaseActionEntry,
    status: CaseActionEntry["status"],
  ) {
    setError(null);
    const input = {
      caseId: item.id,
      actionId: action.id,
      data: { expectedUpdatedAt: action.updatedAt },
    };
    try {
      if (status === "completed") await completeAction.mutateAsync(input);
      else await reopenAction.mutateAsync(input);
      refresh("action");
    } catch {
      setError("No pudimos cambiar el estado de la acción.");
    }
  }

  return (
    <article className="border-border bg-card rounded-card overflow-hidden border shadow-sm">
      <header className="grid min-w-0 gap-4 p-4 md:grid-cols-[minmax(16rem,1.5fr)_repeat(3,minmax(8rem,0.65fr))_minmax(10rem,1fr)] md:items-center md:p-5">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`${open ? "Contraer" : "Expandir"} ${item.identification}`}
              onClick={() => onOpenChange(!open)}
            >
              {open ? (
                <ChevronUp aria-hidden="true" />
              ) : (
                <ChevronDown aria-hidden="true" />
              )}
            </Button>
            <Link
              to={`/cases/${item.id}`}
              className="focus-visible:ring-ring min-w-0 truncate font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-none"
              target="_blank"
              rel="noreferrer"
            >
              {item.identification}
            </Link>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 pl-9">
            <CaseStatusBadge status={item.status} />
            <span className="text-muted-foreground text-xs">
              {getCaseLabel("type", item.type)}
            </span>
          </div>
        </div>
        <div>
          <span className="text-muted-foreground block text-[0.65rem] font-semibold tracking-wider uppercase">
            Período
          </span>
          <span className="text-sm font-medium">
            {formatCasePeriod(
              item.periodKind,
              item.periodStart,
              item.periodEnd,
            )}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[0.65rem] font-semibold tracking-wider uppercase">
            Expediente
          </span>
          <span className="block truncate text-sm font-medium">
            {item.docketNumber ?? "Sin expediente"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[0.65rem] font-semibold tracking-wider uppercase">
            Etapa
          </span>
          <span className="text-sm font-medium">
            {getCaseLabel("stage", item.stage)}
          </span>
        </div>
        <CasePeopleGroups
          caseName={item.identification}
          team={
            <PositionAvatarGroups
              ariaLabel={`Equipo de ${item.identification}`}
              emptyLabel="Sin equipo"
              scrollable={false}
              people={item.team.map((member) => ({
                identityId: member.assignmentId,
                userId: member.userId,
                alias: member.alias,
                fullName: member.fullName,
                avatarColor: member.avatarColor,
                position: member.position,
                activeStudioMember: member.activeStudioMember,
                contextualRole: "Miembro",
              }))}
            />
          }
          followers={
            <PositionAvatarGroups
              ariaLabel={`Seguimiento de ${item.identification}`}
              emptyLabel="Sin seguimiento"
              scrollable={false}
              people={item.followers.map((member) => ({
                identityId: member.assignmentId,
                userId: member.userId,
                alias: member.alias,
                fullName: member.fullName,
                avatarColor: member.avatarColor,
                position: member.position,
                activeStudioMember: member.activeStudioMember,
                contextualRole: "Seguimiento",
              }))}
            />
          }
        />
      </header>

      {open ? (
        <div className="border-border bg-muted/15 grid items-start gap-3 border-t p-3 lg:grid-cols-2 lg:p-4">
          <section className="border-border bg-background rounded-control min-w-0 border p-3">
            <SectionHeader
              title="Novedades"
              count={item.updates.length}
              icon={Newspaper}
              onCreate={() => setCreation("update")}
            />
            <ul className="divide-border mt-2 divide-y">
              {item.updates.map((update) => (
                <li
                  key={update.id}
                  className="grid min-w-0 grid-cols-[7rem_minmax(0,1fr)_auto] items-start gap-2 py-2"
                >
                  <time className="text-primary text-xs font-semibold">
                    {dateFormatter.format(calendarDateToDate(update.date))}
                  </time>
                  <span className="min-w-0 text-sm leading-5">
                    {update.description}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar novedad ${update.description}`}
                    onClick={() => setEditingUpdate(update)}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
            {!item.updates.length ? (
              <p className="text-muted-foreground py-3 text-sm">
                Sin novedades.
              </p>
            ) : null}

            <div className="border-border mt-3 border-t pt-3">
              <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Antecedentes · {item.backgrounds.length}
              </h4>
              <ul className="divide-border mt-1 divide-y">
                {(showAllBackgrounds
                  ? item.backgrounds
                  : item.backgrounds.slice(0, 3)
                ).map((background) => (
                  <li
                    key={background.id}
                    className="grid min-w-0 grid-cols-[7rem_minmax(0,1fr)_auto] items-start gap-2 py-2"
                  >
                    <time className="text-muted-foreground text-xs font-semibold">
                      {dateFormatter.format(
                        calendarDateToDate(background.date),
                      )}
                    </time>
                    <span className="min-w-0 text-sm leading-5">
                      {background.description}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar antecedente ${background.description}`}
                      onClick={() => setEditingUpdate(background)}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
              {!item.backgrounds.length ? (
                <p className="text-muted-foreground py-2 text-sm">
                  Sin antecedentes.
                </p>
              ) : null}
              {item.backgrounds.length > 3 ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="mt-1 h-auto px-0"
                  onClick={() => setShowAllBackgrounds((value) => !value)}
                >
                  {showAllBackgrounds
                    ? "Ver menos antecedentes"
                    : "Ver todos los antecedentes"}
                </Button>
              ) : null}
            </div>
          </section>

          <section className="border-border bg-background rounded-control min-w-0 border p-3">
            <SectionHeader
              title="Acciones"
              count={item.actions.length}
              icon={ListChecks}
              onCreate={() => setCreation("action")}
            />
            <ul className="divide-border mt-2 divide-y">
              {item.actions.map((action) => (
                <li
                  key={action.id}
                  className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 py-2"
                >
                  <CaseActionStatusSelect
                    actionTitle={action.description}
                    value={action.status}
                    display="icon"
                    disabled={busy}
                    onValueChange={(status) =>
                      void changeActionStatus(action, status)
                    }
                  />
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span
                      className={
                        action.status === "completed"
                          ? "text-muted-foreground min-w-0 text-sm line-through"
                          : "min-w-0 text-sm"
                      }
                    >
                      {action.description}
                    </span>
                    {action.assignee ? (
                      <MemberIdentity
                        compact
                        member={{
                          userId: action.assignee.userId ?? action.id,
                          fullName: action.assignee.fullName,
                          alias:
                            action.assignee.alias ?? action.assignee.fullName,
                          avatarColor: action.assignee.avatarColor,
                          activeStudioMember:
                            action.assignee.activeStudioMember,
                        }}
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        Sin encargado
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar acción ${action.description}`}
                    onClick={() => setEditingAction(action)}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
            {!item.actions.length ? (
              <p className="text-muted-foreground py-3 text-sm">
                Sin acciones pendientes.
              </p>
            ) : null}
          </section>

          <section className="border-border bg-background rounded-control min-w-0 border p-3 lg:col-span-2">
            <SectionHeader
              title="Eventos"
              count={item.events.length}
              icon={CalendarDays}
              description="Fechas relevantes, como informes orales, entrevistas u otros eventos."
              onCreate={() => setCreation("event")}
            />
            <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {item.events.map((event) => (
                <li
                  key={event.id}
                  className={
                    event.date < organizationDate
                      ? "border-border bg-muted/50 rounded-control flex min-w-0 items-center gap-2 border px-3 py-2"
                      : "border-border rounded-control flex min-w-0 items-center gap-2 border px-3 py-2"
                  }
                >
                  <CaseEventTypeIcon
                    type={event.type}
                    className="text-primary size-4 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {event.title}
                    </p>
                    <time className="text-muted-foreground text-xs">
                      {dateFormatter.format(calendarDateToDate(event.date))}
                    </time>
                    {event.date < organizationDate ? (
                      <span className="text-muted-foreground ml-2 text-[0.65rem] font-semibold uppercase">
                        Pasado
                      </span>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar evento ${event.title}`}
                    onClick={() => setEditingEvent(event)}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
            {!item.events.length ? (
              <p className="text-muted-foreground py-3 text-sm">
                Sin eventos próximos.
              </p>
            ) : null}
          </section>
          {error ? (
            <p role="alert" className="text-danger text-sm lg:col-span-2">
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-self-start lg:col-span-2"
            onClick={() => setEditingCase(true)}
          >
            <Pencil aria-hidden="true" /> Editar caso
          </Button>
        </div>
      ) : null}

      <CaseUpdateSheet
        open={creation === "update" || editingUpdate !== null}
        update={editingUpdate}
        busy={busy}
        error={error}
        caseContext={context}
        onOpenChange={(value) => {
          if (!value) {
            setCreation(null);
            setEditingUpdate(null);
            setError(null);
          }
        }}
        onSubmit={saveUpdate}
      />
      <CaseActionSheet
        open={creation === "action" || editingAction !== null}
        action={editingAction}
        members={members}
        busy={busy}
        error={error}
        caseContext={context}
        onOpenChange={(value) => {
          if (!value) {
            setCreation(null);
            setEditingAction(null);
            setError(null);
          }
        }}
        onSubmit={saveAction}
      />
      <CaseEventSheet
        open={creation === "event" || editingEvent !== null}
        event={editingEvent}
        busy={busy}
        error={error}
        caseContext={context}
        onOpenChange={(value) => {
          if (!value) {
            setCreation(null);
            setEditingEvent(null);
            setError(null);
          }
        }}
        onSubmit={saveEvent}
      />
      <CaseEditSheet
        open={editingCase}
        caseId={item.id}
        caseName={item.identification}
        clientName={clientName}
        onOpenChange={setEditingCase}
      />
    </article>
  );
}
