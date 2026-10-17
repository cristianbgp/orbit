import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Pencil, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MemberIdentity } from "@/features/identity/member-identity";
import {
  getListCaseActionsQueryKey,
  listCaseActions,
  useArchiveCaseAction,
  useCompleteCaseAction,
  useCreateCaseAction,
  useReopenCaseAction,
  useRestoreCaseAction,
  useUpdateCaseAction,
} from "@/lib/api/generated/case-actions/case-actions";
import {
  getListCaseActivitiesQueryKey,
  getListCaseAssignmentsQueryKey,
  getListCasesGroupedByClientQueryKey,
  useListCaseAssignments,
} from "@/lib/api/generated/cases/cases";
import { getListDashboardActivityQueryKey } from "@/lib/api/generated/dashboard/dashboard";
import type {
  CaseActionEntry,
  CaseActionEntryStatus,
} from "@/lib/api/generated/models";
import { getListMyCaseActionsQueryKey } from "@/lib/api/generated/my-work/my-work";
import { CaseActionSheet } from "./case-action-sheet";
import { CaseActionStatusSelect } from "./case-action-status-select";

type View = "active" | "archived";

export function CaseActionsSection({
  caseId,
  disabled,
}: {
  caseId: string;
  disabled: boolean;
}) {
  const client = useQueryClient();
  const [view, setView] = useState<View>("active");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CaseActionEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = useInfiniteQuery({
    queryKey: [...getListCaseActionsQueryKey(caseId, { status: view }), 20],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      listCaseActions(
        caseId,
        { status: view, page: pageParam, pageSize: 20 },
        { signal },
      ),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages
        ? last.pagination.page + 1
        : undefined,
  });
  const assignments = useListCaseAssignments(caseId);
  const create = useCreateCaseAction();
  const update = useUpdateCaseAction();
  const complete = useCompleteCaseAction();
  const reopen = useReopenCaseAction();
  const archive = useArchiveCaseAction();
  const restore = useRestoreCaseAction();
  const busy = [create, update, complete, reopen, archive, restore].some(
    (mutation) => mutation.isPending,
  );
  const actions = query.data?.pages.flatMap((page) => page.actions) ?? [];

  function refresh() {
    void client.invalidateQueries({
      queryKey: getListCaseActionsQueryKey(caseId),
    });
    void client.invalidateQueries({
      queryKey: getListCaseAssignmentsQueryKey(caseId),
    });
    void client.invalidateQueries({
      queryKey: getListCaseActivitiesQueryKey(caseId),
    });
    void client.invalidateQueries({
      queryKey: getListCasesGroupedByClientQueryKey(),
    });
    void client.invalidateQueries({ queryKey: getListMyCaseActionsQueryKey() });
    void client.invalidateQueries({
      queryKey: getListDashboardActivityQueryKey(),
    });
  }

  async function save(values: {
    description: string;
    assigneeUserId: string | null;
  }) {
    setError(null);
    try {
      if (editing) {
        await update.mutateAsync({
          caseId,
          actionId: editing.id,
          data: { ...values, expectedUpdatedAt: editing.updatedAt },
        });
      } else {
        await create.mutateAsync({ caseId, data: values });
      }
      setSheetOpen(false);
      setEditing(null);
      refresh();
    } catch {
      setError(
        "No pudimos guardar la acción. Recarga la página e inténtalo nuevamente.",
      );
    }
  }

  async function lifecycle(
    item: CaseActionEntry,
    kind: "complete" | "reopen" | "archive" | "restore",
  ) {
    setError(null);
    try {
      const input = {
        caseId,
        actionId: item.id,
        data: { expectedUpdatedAt: item.updatedAt },
      };
      if (kind === "complete") await complete.mutateAsync(input);
      else if (kind === "reopen") await reopen.mutateAsync(input);
      else if (kind === "archive") await archive.mutateAsync(input);
      else await restore.mutateAsync(input);
      refresh();
    } catch {
      setError(
        "La acción cambió o no pudo actualizarse. Recarga la página e inténtalo nuevamente.",
      );
    }
  }

  function changeStatus(item: CaseActionEntry, status: CaseActionEntryStatus) {
    return lifecycle(item, status === "completed" ? "complete" : "reopen");
  }

  return (
    <section
      className="rounded-card border-border bg-card shadow-panel border p-5 sm:p-6"
      aria-labelledby="case-actions-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="case-actions-title"
            className="font-display text-xl font-semibold"
          >
            Acciones
          </h2>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            Próximos pasos que requieren seguimiento en el caso.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView(view === "active" ? "archived" : "active")}
          >
            {view === "active" ? (
              <ArchiveRestore aria-hidden="true" />
            ) : (
              <RotateCcw aria-hidden="true" />
            )}
            {view === "active" ? "Ver archivadas" : "Volver a acciones"}
          </Button>
          {!disabled && view === "active" ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setError(null);
                setSheetOpen(true);
              }}
            >
              <Plus aria-hidden="true" />
              Nueva acción
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-danger mt-4 text-sm">
          {error}
        </p>
      ) : null}
      {query.isPending ? (
        <div
          role="status"
          aria-label="Cargando acciones"
          className="bg-muted rounded-control mt-4 h-28 animate-pulse"
        />
      ) : query.isError ? (
        <div className="border-danger/25 mt-4 border-l-2 pl-4">
          <p className="text-danger text-sm">No pudimos cargar las acciones.</p>
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
          >
            Intentar de nuevo
          </Button>
        </div>
      ) : actions.length ? (
        <ul
          className="divide-border mt-4 divide-y"
          aria-label={
            view === "active" ? "Acciones activas" : "Acciones archivadas"
          }
        >
          {actions.map((item) => (
            <li
              key={item.id}
              className="grid min-w-0 gap-3 py-3 first:pt-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <article className="min-w-0">
                <p
                  className={
                    item.status === "completed"
                      ? "text-muted-foreground text-sm leading-5 line-through"
                      : "text-sm leading-5"
                  }
                >
                  {item.description}
                </p>
                <div className="mt-1.5">
                  {item.assignee ? (
                    <MemberIdentity
                      compact
                      member={{
                        userId: item.assignee.userId ?? item.assignee.fullName,
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
                      secondary={
                        item.assignee.activeCaseMember
                          ? "Encargado"
                          : "Ya no integra el caso"
                      }
                    />
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      Sin encargado
                    </span>
                  )}
                </div>
              </article>
              <div className="flex items-center justify-between gap-1 sm:justify-end">
                <CaseActionStatusSelect
                  actionTitle={item.description}
                  value={item.status}
                  disabled={disabled || busy || view === "archived"}
                  onValueChange={(status) => void changeStatus(item, status)}
                />
                {!disabled ? (
                  view === "archived" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      aria-label="Restaurar acción"
                      onClick={() => void lifecycle(item, "restore")}
                    >
                      <RotateCcw aria-hidden="true" />
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar acción"
                        onClick={() => {
                          setEditing(item);
                          setError(null);
                          setSheetOpen(true);
                        }}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Archivar acción"
                        onClick={() => void lifecycle(item, "archive")}
                      >
                        <Archive aria-hidden="true" />
                      </Button>
                    </>
                  )
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground mt-4 text-sm">
          {view === "active"
            ? "Aún no hay acciones."
            : "No hay acciones archivadas."}
        </p>
      )}
      {query.hasNextPage ? (
        <Button
          className="mt-4"
          variant="outline"
          size="sm"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Cargando…" : "Cargar más"}
        </Button>
      ) : null}
      <CaseActionSheet
        open={sheetOpen}
        action={editing}
        members={assignments.data?.active ?? []}
        busy={busy}
        error={error}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditing(null);
        }}
        onSubmit={save}
      />
    </section>
  );
}
