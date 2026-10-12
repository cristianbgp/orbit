import { useId, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  Pencil,
  Plus,
  RotateCcw,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AliasAvatar } from "@/features/identity/alias-avatar";
import {
  getListCaseUpdatesQueryKey,
  listCaseUpdates,
  useArchiveCaseUpdate,
  useCreateCaseUpdate,
  useRestoreCaseUpdate,
  useUpdateCaseUpdate,
} from "@/lib/api/generated/case-updates/case-updates";
import {
  getListCaseActivitiesQueryKey,
  getListCasesGroupedByClientQueryKey,
} from "@/lib/api/generated/cases/cases";
import { getListDashboardActivityQueryKey } from "@/lib/api/generated/dashboard/dashboard";
import type { CaseUpdateEntry } from "@/lib/api/generated/models/caseUpdateEntry";
import { calendarDateToDate } from "@/components/ui/calendar-date-picker";
import { CaseUpdateSheet } from "./case-update-sheet";

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

type UpdateListProps = {
  items: CaseUpdateEntry[];
  label: string;
  disabled: boolean;
  archived: boolean;
  busy: boolean;
  onEdit(item: CaseUpdateEntry): void;
  onArchive(item: CaseUpdateEntry): void;
  onRestore(item: CaseUpdateEntry): void;
};

function CreatorAvatar({ item }: { item: CaseUpdateEntry }) {
  const avatar = (
    <AliasAvatar
      userId={item.creator.userId ?? item.id}
      alias={item.creator.alias ?? item.creator.fullName}
      fullName={item.creator.fullName}
      avatarColor={item.creator.avatarColor}
      size="xs"
    />
  );
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {item.creator.linkable && item.creator.userId ? (
            <Link
              to={`/team/${item.creator.userId}`}
              aria-label={`Ver perfil de ${item.creator.fullName}`}
              className="focus-visible:ring-ring rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              {avatar}
            </Link>
          ) : (
            <span
              tabIndex={0}
              className="focus-visible:ring-ring rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              {avatar}
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent>{item.creator.fullName}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function UpdateList({
  items,
  label,
  disabled,
  archived,
  busy,
  onEdit,
  onArchive,
  onRestore,
}: UpdateListProps) {
  return (
    <ol className="divide-border divide-y" aria-label={label}>
      {items.map((item) => (
        <li
          key={item.id}
          className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-1"
        >
          <article className="min-w-0">
            <time
              dateTime={item.date}
              className="text-primary-strong text-xs font-semibold capitalize"
            >
              {dateFormatter.format(calendarDateToDate(item.date))}
            </time>
            <p className="mt-1 text-sm leading-5 [overflow-wrap:anywhere] whitespace-pre-wrap">
              {item.description}
            </p>
          </article>
          <div className="flex shrink-0 items-center gap-1">
            <CreatorAvatar item={item} />
            {!disabled ? (
              archived ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => onRestore(item)}
                >
                  <RotateCcw aria-hidden="true" /> Restaurar
                </Button>
              ) : (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={
                      item.kind === "background"
                        ? "Editar antecedente"
                        : "Editar novedad"
                    }
                    onClick={() => onEdit(item)}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={
                      item.kind === "background"
                        ? "Archivar antecedente"
                        : "Archivar novedad"
                    }
                    onClick={() => onArchive(item)}
                  >
                    <Archive aria-hidden="true" />
                  </Button>
                </div>
              )
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function CaseUpdatesSection({
  caseId,
  disabled,
}: {
  caseId: string;
  disabled: boolean;
}) {
  const client = useQueryClient();
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CaseUpdateEntry | null>(null);
  const [archiving, setArchiving] = useState<CaseUpdateEntry | null>(null);
  const [backgroundsOpen, setBackgroundsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backgroundsId = useId();
  const listParams =
    status === "active"
      ? ({ status, kind: "update" } as const)
      : ({ status } as const);
  const query = useInfiniteQuery({
    queryKey: [...getListCaseUpdatesQueryKey(caseId, listParams), 10],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      listCaseUpdates(
        caseId,
        { ...listParams, page: pageParam, pageSize: 10 },
        { signal },
      ),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
  });
  const backgroundQuery = useInfiniteQuery({
    queryKey: [
      ...getListCaseUpdatesQueryKey(caseId, {
        status: "active",
        kind: "background",
      }),
      10,
    ],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      listCaseUpdates(
        caseId,
        {
          status: "active",
          kind: "background",
          page: pageParam,
          pageSize: 10,
        },
        { signal },
      ),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
    enabled: status === "active",
  });
  const create = useCreateCaseUpdate();
  const update = useUpdateCaseUpdate();
  const archive = useArchiveCaseUpdate();
  const restore = useRestoreCaseUpdate();
  const busy =
    create.isPending ||
    update.isPending ||
    archive.isPending ||
    restore.isPending;

  function refresh() {
    void client.invalidateQueries({
      queryKey: getListCaseUpdatesQueryKey(caseId),
    });
    void client.invalidateQueries({
      queryKey: getListCaseActivitiesQueryKey(caseId),
    });
    void client.invalidateQueries({
      queryKey: getListCasesGroupedByClientQueryKey(),
    });
    void client.invalidateQueries({
      queryKey: getListDashboardActivityQueryKey(),
    });
  }

  async function save(values: {
    date: string;
    description: string;
    kind?: "update" | "background";
  }) {
    setError(null);
    try {
      if (editing) {
        await update.mutateAsync({
          caseId,
          updateId: editing.id,
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
        "No pudimos guardar la novedad. Recarga la página e inténtalo nuevamente.",
      );
    }
  }

  async function archiveSelected() {
    if (!archiving) return;
    setError(null);
    try {
      await archive.mutateAsync({
        caseId,
        updateId: archiving.id,
        data: { expectedUpdatedAt: archiving.updatedAt },
      });
      setArchiving(null);
      refresh();
    } catch {
      setError(
        "No pudimos archivar la novedad. Recarga la página e inténtalo nuevamente.",
      );
    }
  }

  async function restoreSelected(item: CaseUpdateEntry) {
    setError(null);
    try {
      await restore.mutateAsync({
        caseId,
        updateId: item.id,
        data: { expectedUpdatedAt: item.updatedAt },
      });
      refresh();
    } catch {
      setError(
        "No pudimos restaurar la novedad. Recarga la página e inténtalo nuevamente.",
      );
    }
  }

  const updates = query.data?.pages.flatMap((page) => page.updates) ?? [];
  const backgrounds =
    backgroundQuery.data?.pages.flatMap((page) => page.updates) ?? [];
  const backgroundTotal =
    backgroundQuery.data?.pages[0]?.pagination.total ?? backgrounds.length;
  return (
    <section
      className="rounded-card border-border bg-card shadow-panel border p-5 sm:p-6"
      aria-labelledby="case-updates-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="case-updates-title"
            className="font-display text-xl font-semibold"
          >
            Novedades
          </h2>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            Hechos relevantes registrados manualmente en el caso.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setStatus(status === "active" ? "archived" : "active")
            }
          >
            {status === "active" ? (
              <ArchiveRestore aria-hidden="true" />
            ) : (
              <RotateCcw aria-hidden="true" />
            )}
            {status === "active" ? "Ver archivadas" : "Volver a novedades"}
          </Button>
          {!disabled && status === "active" ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setError(null);
                setSheetOpen(true);
              }}
            >
              <Plus aria-hidden="true" />
              Nueva novedad
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
          aria-label="Cargando novedades"
          className="bg-muted rounded-control mt-5 h-36 animate-pulse"
        />
      ) : query.isError ? (
        <div className="border-danger/25 mt-5 border-l-2 pl-4">
          <p className="text-danger text-sm">
            No pudimos cargar las novedades.
          </p>
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
          >
            Intentar de nuevo
          </Button>
        </div>
      ) : updates.length ? (
        <div className="mt-4">
          <UpdateList
            items={updates}
            label={
              status === "active" ? "Novedades activas" : "Novedades archivadas"
            }
            disabled={disabled}
            archived={status === "archived"}
            busy={busy}
            onEdit={(item) => {
              setEditing(item);
              setError(null);
              setSheetOpen(true);
            }}
            onArchive={setArchiving}
            onRestore={(item) => void restoreSelected(item)}
          />
        </div>
      ) : (
        <div className="border-primary/40 mt-5 border-l-2 pl-4">
          <h3 className="text-sm font-semibold">
            {status === "active"
              ? "Aún no hay novedades"
              : "No hay novedades archivadas"}
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {status === "active"
              ? "Registra los hechos relevantes conforme avance el caso."
              : "Las novedades archivadas aparecerán aquí."}
          </p>
        </div>
      )}
      {query.hasNextPage ? (
        <Button
          className="mt-4"
          variant="outline"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Cargando más…" : "Cargar más novedades"}
        </Button>
      ) : null}

      {status === "active" ? (
        <Collapsible
          open={backgroundsOpen}
          onOpenChange={setBackgroundsOpen}
          className="border-border mt-5 border-t pt-3"
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="group w-full justify-between sm:w-auto"
              aria-controls={backgroundsId}
            >
              Antecedentes · {backgroundTotal}
              <ChevronDown
                aria-hidden="true"
                className="transition-transform group-data-[state=open]:rotate-180"
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent id={backgroundsId} className="pt-3">
            {backgroundQuery.isPending ? (
              <div
                role="status"
                aria-label="Cargando antecedentes"
                className="bg-muted rounded-control h-24 animate-pulse"
              />
            ) : backgroundQuery.isError ? (
              <div className="border-danger/25 border-l-2 pl-4">
                <p className="text-danger text-sm">
                  No pudimos cargar los antecedentes.
                </p>
                <Button
                  className="mt-3"
                  variant="outline"
                  size="sm"
                  onClick={() => void backgroundQuery.refetch()}
                >
                  Intentar de nuevo
                </Button>
              </div>
            ) : backgrounds.length ? (
              <UpdateList
                items={backgrounds}
                label="Antecedentes activos"
                disabled={disabled}
                archived={false}
                busy={busy}
                onEdit={(item) => {
                  setEditing(item);
                  setError(null);
                  setSheetOpen(true);
                }}
                onArchive={setArchiving}
                onRestore={(item) => void restoreSelected(item)}
              />
            ) : (
              <p className="text-muted-foreground px-3 py-2 text-sm">
                Aún no hay antecedentes.
              </p>
            )}
            {backgroundQuery.hasNextPage ? (
              <Button
                className="mt-3"
                variant="outline"
                disabled={backgroundQuery.isFetchingNextPage}
                onClick={() => void backgroundQuery.fetchNextPage()}
              >
                {backgroundQuery.isFetchingNextPage
                  ? "Cargando más…"
                  : "Cargar más antecedentes"}
              </Button>
            ) : null}
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <CaseUpdateSheet
        open={sheetOpen}
        update={editing}
        busy={busy}
        error={error}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditing(null);
        }}
        onSubmit={save}
      />

      <Dialog
        open={Boolean(archiving)}
        onOpenChange={(open) => {
          if (!open) setArchiving(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archivar novedad</DialogTitle>
            <DialogDescription>
              La novedad dejará de aparecer entre las activas, pero conservará
              su historial.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiving(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void archiveSelected()}
            >
              Archivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
