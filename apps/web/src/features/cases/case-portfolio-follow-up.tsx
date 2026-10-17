import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  ListChecks,
  Newspaper,
  Pencil,
  Plus,
} from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MemberIdentity } from "@/features/identity/member-identity";
import {
  getListCaseActionsQueryKey,
  listCaseActions,
  useCompleteCaseAction,
  useCreateCaseAction,
  useReopenCaseAction,
  useUpdateCaseAction,
} from "@/lib/api/generated/case-actions/case-actions";
import {
  getListCaseUpdatesQueryKey,
  listCaseUpdates,
  useCreateCaseUpdate,
  useUpdateCaseUpdate,
} from "@/lib/api/generated/case-updates/case-updates";
import {
  getListCaseActivitiesQueryKey,
  getListCasesGroupedByClientQueryKey,
  useListCaseAssignments,
} from "@/lib/api/generated/cases/cases";
import { getListDashboardActivityQueryKey } from "@/lib/api/generated/dashboard/dashboard";
import { getListMyCaseActionsQueryKey } from "@/lib/api/generated/my-work/my-work";
import type {
  CaseActionEntry,
  CaseUpdateEntry,
} from "@/lib/api/generated/models";
import { calendarDateToDate } from "@/components/ui/calendar-date-picker";
import { CaseActionSheet } from "./case-action-sheet";
import { CaseActionStatusSelect } from "./case-action-status-select";
import { CaseUpdateSheet } from "./case-update-sheet";

const PREVIEW_SIZE = 3;
const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function mergeUnique<T extends { id: string }>(current: T[], next: T[]) {
  return [
    ...new Map([...current, ...next].map((item) => [item.id, item])).values(),
  ];
}

function DisclosureButton({
  label,
  count,
  open,
  panelId,
  onClick,
  icon: Icon,
}: {
  label: string;
  count: number;
  open: boolean;
  panelId: string;
  onClick(): void;
  icon: typeof ListChecks;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={count === 0}
      aria-expanded={open}
      aria-controls={panelId}
      onClick={onClick}
      className="min-w-0 flex-1 shrink justify-between"
    >
      <span className="flex items-center gap-2">
        <Icon aria-hidden="true" />
        {label} · {count}
      </span>
      {open ? (
        <ChevronUp aria-hidden="true" />
      ) : (
        <ChevronDown aria-hidden="true" />
      )}
    </Button>
  );
}

function CreateButton({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            className="shrink-0"
            onClick={onClick}
          >
            <Plus aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ActionPreview({
  caseId,
  open,
  readOnly,
  busy,
  onEdit,
  onStatusChange,
}: {
  caseId: string;
  open: boolean;
  readOnly: boolean;
  busy: boolean;
  onEdit(item: CaseActionEntry): void;
  onStatusChange(
    item: CaseActionEntry,
    status: CaseActionEntry["status"],
  ): void;
}) {
  const query = useQuery({
    queryKey: [
      ...getListCaseActionsQueryKey(caseId, {
        status: "active",
        page: 1,
        pageSize: PREVIEW_SIZE,
      }),
      "portfolio-preview",
    ],
    queryFn: ({ signal }) =>
      listCaseActions(
        caseId,
        { status: "active", page: 1, pageSize: PREVIEW_SIZE },
        { signal },
      ),
    enabled: open,
  });
  const [showAll, setShowAll] = useState(false);
  const [extra, setExtra] = useState<CaseActionEntry[]>([]);
  const [lastLoadedPage, setLastLoadedPage] = useState(1);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setShowAll(false);
    setExtra([]);
    setLastLoadedPage(1);
    setLoadError(false);
  }, [caseId]);

  async function loadAll() {
    if (!query.data) return;
    setShowAll(true);
    setLoadError(false);
    if (lastLoadedPage >= query.data.pagination.totalPages) return;
    setLoadingAll(true);
    let loaded: CaseActionEntry[] = [];
    try {
      for (
        let page = lastLoadedPage + 1;
        page <= query.data.pagination.totalPages;
        page += 1
      ) {
        const response = await listCaseActions(caseId, {
          status: "active",
          page,
          pageSize: PREVIEW_SIZE,
        });
        loaded = mergeUnique(extra, mergeUnique(loaded, response.actions));
        setExtra(loaded);
        setLastLoadedPage(page);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoadingAll(false);
    }
  }

  if (query.isPending)
    return (
      <div
        role="status"
        aria-label="Cargando acciones"
        className="bg-muted rounded-control h-16 animate-pulse"
      />
    );
  if (query.isError)
    return (
      <p className="text-danger text-sm">No pudimos cargar las acciones.</p>
    );
  const actions = showAll
    ? mergeUnique(query.data.actions, extra)
    : query.data.actions;
  return (
    <div>
      <ul className="divide-border divide-y">
        {actions.map((item) => {
          return (
            <li
              key={item.id}
              className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 py-2 first:pt-0"
            >
              <CaseActionStatusSelect
                actionTitle={item.description}
                value={item.status}
                display="icon"
                disabled={readOnly || busy}
                onValueChange={(status) => onStatusChange(item, status)}
              />
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={
                    item.status === "completed"
                      ? "text-muted-foreground min-w-0 truncate text-sm line-through"
                      : "min-w-0 truncate text-sm"
                  }
                >
                  {item.description}
                </span>
                {item.assignee ? (
                  <MemberIdentity
                    compact
                    member={{
                      userId: item.assignee.userId ?? item.id,
                      fullName: item.assignee.fullName,
                      alias: item.assignee.alias ?? item.assignee.fullName,
                      avatarColor: item.assignee.avatarColor,
                      activeStudioMember: item.assignee.activeStudioMember,
                    }}
                    to={
                      item.assignee.linkable && item.assignee.userId
                        ? `/team/${item.assignee.userId}`
                        : undefined
                    }
                  />
                ) : (
                  <span className="text-muted-foreground shrink-0 text-xs">
                    Sin encargado
                  </span>
                )}
              </div>
              {!readOnly ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Editar acción"
                  disabled={busy}
                  onClick={() => onEdit(item)}
                >
                  <Pencil aria-hidden="true" />
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {loadError ? (
        <p role="alert" className="text-danger mt-2 text-xs">
          No pudimos cargar todas las acciones. Puedes intentarlo nuevamente.
        </p>
      ) : null}
      {query.data.pagination.total > PREVIEW_SIZE ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          disabled={loadingAll}
          onClick={() =>
            loadError
              ? void loadAll()
              : showAll
                ? setShowAll(false)
                : void loadAll()
          }
        >
          {loadingAll
            ? "Cargando…"
            : loadError
              ? "Reintentar cargar todas las acciones"
              : showAll
                ? "Mostrar menos acciones"
                : "Ver todas las acciones"}
        </Button>
      ) : null}
    </div>
  );
}

function UpdatePreview({
  caseId,
  open,
  readOnly,
  busy,
  onEdit,
}: {
  caseId: string;
  open: boolean;
  readOnly: boolean;
  busy: boolean;
  onEdit(item: CaseUpdateEntry): void;
}) {
  const query = useQuery({
    queryKey: [
      ...getListCaseUpdatesQueryKey(caseId, {
        status: "active",
        kind: "update",
        page: 1,
        pageSize: PREVIEW_SIZE,
      }),
      "portfolio-preview",
    ],
    queryFn: ({ signal }) =>
      listCaseUpdates(
        caseId,
        {
          status: "active",
          kind: "update",
          page: 1,
          pageSize: PREVIEW_SIZE,
        },
        { signal },
      ),
    enabled: open,
  });
  const [showAll, setShowAll] = useState(false);
  const [extra, setExtra] = useState<CaseUpdateEntry[]>([]);
  const [lastLoadedPage, setLastLoadedPage] = useState(1);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setShowAll(false);
    setExtra([]);
    setLastLoadedPage(1);
    setLoadError(false);
  }, [caseId]);

  async function loadAll() {
    if (!query.data) return;
    setShowAll(true);
    setLoadError(false);
    if (lastLoadedPage >= query.data.pagination.totalPages) return;
    setLoadingAll(true);
    let loaded: CaseUpdateEntry[] = [];
    try {
      for (
        let page = lastLoadedPage + 1;
        page <= query.data.pagination.totalPages;
        page += 1
      ) {
        const response = await listCaseUpdates(caseId, {
          status: "active",
          kind: "update",
          page,
          pageSize: PREVIEW_SIZE,
        });
        loaded = mergeUnique(extra, mergeUnique(loaded, response.updates));
        setExtra(loaded);
        setLastLoadedPage(page);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoadingAll(false);
    }
  }

  if (query.isPending)
    return (
      <div
        role="status"
        aria-label="Cargando novedades"
        className="bg-muted rounded-control h-16 animate-pulse"
      />
    );
  if (query.isError)
    return (
      <p className="text-danger text-sm">No pudimos cargar las novedades.</p>
    );
  const updates = showAll
    ? mergeUnique(query.data.updates, extra)
    : query.data.updates;
  return (
    <div>
      <ul className="divide-border divide-y">
        {updates.map((item) => (
          <li
            key={item.id}
            className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-2 py-2 first:pt-0 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:gap-3"
          >
            <time
              dateTime={item.date}
              className="text-primary-strong text-xs font-semibold capitalize"
            >
              {dateFormatter.format(calendarDateToDate(item.date))}
            </time>
            <span className="min-w-0 text-sm [overflow-wrap:anywhere]">
              {item.description}
            </span>
            {!readOnly ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Editar novedad"
                disabled={busy}
                onClick={() => onEdit(item)}
              >
                <Pencil aria-hidden="true" />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {loadError ? (
        <p role="alert" className="text-danger mt-2 text-xs">
          No pudimos cargar todas las novedades. Puedes intentarlo nuevamente.
        </p>
      ) : null}
      {query.data.pagination.total > PREVIEW_SIZE ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          disabled={loadingAll}
          onClick={() =>
            loadError
              ? void loadAll()
              : showAll
                ? setShowAll(false)
                : void loadAll()
          }
        >
          {loadingAll
            ? "Cargando…"
            : loadError
              ? "Reintentar cargar todas las novedades"
              : showAll
                ? "Mostrar menos novedades"
                : "Ver todas las novedades"}
        </Button>
      ) : null}
    </div>
  );
}

export function CasePortfolioFollowUp({
  caseId,
  caseName,
  clientName,
  actionCount,
  updateCount,
  readOnly = false,
}: {
  caseId: string;
  caseName: string;
  clientName: string;
  actionCount: number;
  updateCount: number;
  readOnly?: boolean;
}) {
  const client = useQueryClient();
  const actionPanelId = useId();
  const updatePanelId = useId();
  const [actionsOpen, setActionsOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [creation, setCreation] = useState<"action" | "update" | null>(null);
  const [editingAction, setEditingAction] = useState<CaseActionEntry | null>(
    null,
  );
  const [editingUpdate, setEditingUpdate] = useState<CaseUpdateEntry | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const assignments = useListCaseAssignments(caseId, undefined, {
    query: { enabled: creation === "action" || editingAction !== null },
  });
  const createAction = useCreateCaseAction();
  const updateAction = useUpdateCaseAction();
  const completeAction = useCompleteCaseAction();
  const reopenAction = useReopenCaseAction();
  const createUpdate = useCreateCaseUpdate();
  const updateNovelty = useUpdateCaseUpdate();
  const actionBusy = [
    createAction,
    updateAction,
    completeAction,
    reopenAction,
  ].some((mutation) => mutation.isPending);
  const updateBusy = createUpdate.isPending || updateNovelty.isPending;
  const caseContext = { caseId, caseName, clientName };

  function refresh(kind: "action" | "update") {
    void client.invalidateQueries({
      queryKey:
        kind === "action"
          ? getListCaseActionsQueryKey(caseId)
          : getListCaseUpdatesQueryKey(caseId),
    });
    void client.invalidateQueries({
      queryKey: getListCasesGroupedByClientQueryKey(),
    });
    void client.invalidateQueries({
      queryKey: getListCaseActivitiesQueryKey(caseId),
    });
    void client.invalidateQueries({
      queryKey: getListDashboardActivityQueryKey(),
    });
    if (kind === "action") {
      void client.invalidateQueries({
        queryKey: getListMyCaseActionsQueryKey(),
      });
    }
  }

  async function saveAction(values: {
    description: string;
    assigneeUserId: string | null;
  }) {
    setActionError(null);
    try {
      if (editingAction) {
        await updateAction.mutateAsync({
          caseId,
          actionId: editingAction.id,
          data: { ...values, expectedUpdatedAt: editingAction.updatedAt },
        });
      } else {
        await createAction.mutateAsync({ caseId, data: values });
      }
      setCreation(null);
      setEditingAction(null);
      setActionsOpen(true);
      refresh("action");
    } catch {
      setActionError(
        "No pudimos guardar la acción. Recarga la página e inténtalo nuevamente.",
      );
    }
  }

  async function saveUpdate(values: {
    date: string;
    description: string;
    kind?: "update" | "background";
  }) {
    setUpdateError(null);
    try {
      if (editingUpdate) {
        await updateNovelty.mutateAsync({
          caseId,
          updateId: editingUpdate.id,
          data: { ...values, expectedUpdatedAt: editingUpdate.updatedAt },
        });
      } else {
        await createUpdate.mutateAsync({ caseId, data: values });
      }
      setCreation(null);
      setEditingUpdate(null);
      setUpdatesOpen(true);
      refresh("update");
    } catch {
      setUpdateError(
        "No pudimos guardar la novedad. Recarga la página e inténtalo nuevamente.",
      );
    }
  }

  async function changeActionStatus(
    item: CaseActionEntry,
    status: CaseActionEntry["status"],
  ) {
    setActionError(null);
    const input = {
      caseId,
      actionId: item.id,
      data: { expectedUpdatedAt: item.updatedAt },
    };
    try {
      if (status === "completed") await completeAction.mutateAsync(input);
      else await reopenAction.mutateAsync(input);
      refresh("action");
    } catch {
      setActionError(
        "La acción cambió o no pudo actualizarse. Recarga la página e inténtalo nuevamente.",
      );
    }
  }

  return (
    <div
      role="group"
      aria-label="Seguimiento del caso"
      className="border-border bg-muted/20 border-t px-4 py-2.5 sm:px-5"
    >
      <div className="grid items-start gap-2 lg:grid-cols-2 lg:gap-4">
        <section className="border-border bg-background/70 rounded-control min-w-0 border p-2">
          <div className="flex items-center gap-1">
            <DisclosureButton
              label="Novedades"
              count={updateCount}
              open={updatesOpen}
              panelId={updatePanelId}
              onClick={() => setUpdatesOpen((current) => !current)}
              icon={Newspaper}
            />
            {!readOnly ? (
              <CreateButton
                label="Añadir novedad"
                onClick={() => {
                  setUpdateError(null);
                  setCreation("update");
                }}
              />
            ) : null}
          </div>
          {updatesOpen ? (
            <div
              id={updatePanelId}
              className="border-border mt-2 border-l-2 pl-3"
            >
              <UpdatePreview
                caseId={caseId}
                open={updatesOpen}
                readOnly={readOnly}
                busy={updateBusy}
                onEdit={(item) => {
                  setUpdateError(null);
                  setEditingUpdate(item);
                }}
              />
            </div>
          ) : null}
        </section>
        <section className="border-border bg-background/70 rounded-control min-w-0 border p-2">
          <div className="flex items-center gap-1">
            <DisclosureButton
              label="Acciones"
              count={actionCount}
              open={actionsOpen}
              panelId={actionPanelId}
              onClick={() => setActionsOpen((current) => !current)}
              icon={ListChecks}
            />
            {!readOnly ? (
              <CreateButton
                label="Añadir acción"
                onClick={() => {
                  setActionError(null);
                  setCreation("action");
                }}
              />
            ) : null}
          </div>
          {actionsOpen ? (
            <div
              id={actionPanelId}
              className="border-border mt-2 border-l-2 pl-3"
            >
              <ActionPreview
                caseId={caseId}
                open={actionsOpen}
                readOnly={readOnly}
                busy={actionBusy}
                onEdit={(item) => {
                  setActionError(null);
                  setEditingAction(item);
                }}
                onStatusChange={(item, status) =>
                  void changeActionStatus(item, status)
                }
              />
            </div>
          ) : null}
        </section>
      </div>
      <CaseUpdateSheet
        open={creation === "update" || editingUpdate !== null}
        update={editingUpdate}
        busy={updateBusy}
        error={updateError}
        caseContext={caseContext}
        onOpenChange={(open) => {
          if (!open) {
            setCreation(null);
            setEditingUpdate(null);
          }
        }}
        onSubmit={saveUpdate}
      />
      <CaseActionSheet
        open={creation === "action" || editingAction !== null}
        action={editingAction}
        members={assignments.data?.active ?? []}
        busy={actionBusy}
        error={actionError}
        caseContext={caseContext}
        onOpenChange={(open) => {
          if (!open) {
            setCreation(null);
            setEditingAction(null);
          }
        }}
        onSubmit={saveAction}
      />
    </div>
  );
}
