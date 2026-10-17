import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { calendarDateToDate } from "@/components/ui/calendar-date-picker";
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
import {
  getListCaseEventCalendarQueryKey,
  getListCaseEventsQueryKey,
  useCreateCaseEvent,
  useDeleteCaseEvent,
  useListCaseEvents,
  useUpdateCaseEvent,
} from "@/lib/api/generated/case-events/case-events";
import { getListCaseActivitiesQueryKey } from "@/lib/api/generated/cases/cases";
import { getListDashboardActivityQueryKey } from "@/lib/api/generated/dashboard/dashboard";
import type { CaseEvent } from "@/lib/api/generated/models/caseEvent";
import { CaseEventSheet } from "./case-event-sheet";
import {
  CaseEventTypeIcon,
  getCaseEventTypePresentation,
  type CaseEventType,
} from "./case-event-types";
import type { CaseSheetContextValue } from "./case-sheet-context";

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function CaseEventsSection({
  caseId,
  disabled,
  caseContext,
}: {
  caseId: string;
  disabled: boolean;
  caseContext?: CaseSheetContextValue;
}) {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CaseEvent | null>(null);
  const [deleting, setDeleting] = useState<CaseEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const query = useListCaseEvents(caseId, { page, pageSize: 25 });
  const create = useCreateCaseEvent();
  const update = useUpdateCaseEvent();
  const remove = useDeleteCaseEvent();
  const busy = create.isPending || update.isPending || remove.isPending;

  function refresh() {
    void client.invalidateQueries({
      queryKey: getListCaseEventCalendarQueryKey(),
    });
    void client.invalidateQueries({
      queryKey: getListCaseEventsQueryKey(caseId),
    });
    void client.invalidateQueries({
      queryKey: getListCaseActivitiesQueryKey(caseId),
    });
    void client.invalidateQueries({
      queryKey: getListDashboardActivityQueryKey(),
    });
  }

  async function save(values: {
    title: string;
    type: CaseEventType;
    date: string;
    description: string | null;
  }) {
    setError(null);
    try {
      if (editing) {
        await update.mutateAsync({
          caseId,
          eventId: editing.id,
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
        "No pudimos guardar el evento. Recarga la página e inténtalo nuevamente.",
      );
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync({
        caseId,
        eventId: deleting.id,
        data: { expectedUpdatedAt: deleting.updatedAt },
      });
      setDeleting(null);
      if (page > 1 && query.data?.events.length === 1) {
        setPage((current) => current - 1);
      }
      refresh();
    } catch {
      setDeleteError(
        "No pudimos eliminar el evento. Recarga la página e inténtalo nuevamente.",
      );
    }
  }

  return (
    <section
      className="rounded-card border-border bg-card shadow-panel border p-5 sm:p-6"
      aria-labelledby="case-events-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CalendarClock aria-hidden="true" className="text-primary size-5" />
            <h2
              id="case-events-title"
              className="font-display text-xl font-semibold"
            >
              Eventos
            </h2>
          </div>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            Fechas relevantes del caso, como informes orales, entrevistas u
            otros eventos.
          </p>
        </div>
        {!disabled ? (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setError(null);
              setSheetOpen(true);
            }}
          >
            <Plus aria-hidden="true" />
            Nuevo evento
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-danger mt-4 text-sm">
          {error}
        </p>
      ) : null}

      {query.isPending ? (
        <div
          role="status"
          aria-label="Cargando eventos"
          className="bg-muted rounded-control mt-4 h-24 animate-pulse"
        />
      ) : query.isError ? (
        <div className="border-danger/25 mt-4 border-l-2 pl-4">
          <p className="text-danger text-sm">No pudimos cargar los eventos.</p>
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
          >
            Intentar de nuevo
          </Button>
        </div>
      ) : query.data.events.length ? (
        <ol
          className="divide-border mt-4 divide-y"
          aria-label="Eventos del caso"
        >
          {query.data.events.map((item) => (
            <li
              key={item.id}
              className="grid min-w-0 gap-3 py-3 first:pt-1 sm:grid-cols-[8.5rem_minmax(0,1fr)_auto] sm:items-center"
            >
              <time
                dateTime={item.date}
                className="text-primary-strong text-xs font-semibold capitalize"
              >
                {dateFormatter.format(calendarDateToDate(item.date))}
              </time>
              <article className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="font-medium [overflow-wrap:anywhere]">
                    {item.title}
                  </p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          tabIndex={0}
                          aria-label={`Tipo de evento: ${getCaseEventTypePresentation(item.type).label}`}
                          className="bg-primary-soft text-primary-strong focus-visible:ring-ring inline-flex size-7 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2"
                        >
                          <CaseEventTypeIcon
                            type={item.type}
                            className="size-3.5"
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {getCaseEventTypePresentation(item.type).label}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {item.description ? (
                  <p className="text-muted-foreground mt-1 text-sm leading-5 [overflow-wrap:anywhere] whitespace-pre-wrap">
                    {item.description}
                  </p>
                ) : null}
              </article>
              {!disabled ? (
                <TooltipProvider>
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Editar ${item.title}`}
                          onClick={() => {
                            setEditing(item);
                            setError(null);
                            setSheetOpen(true);
                          }}
                        >
                          <Pencil aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Editar evento</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Eliminar ${item.title}`}
                          onClick={() => {
                            setDeleteError(null);
                            setDeleting(item);
                          }}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Eliminar evento</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className="border-border mt-4 rounded-lg border border-dashed px-4 py-6 text-center">
          <p className="text-sm font-medium">Sin eventos registrados</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Los eventos aparecerán aquí cuando se registren.
          </p>
        </div>
      )}

      {query.data && query.data.pagination.totalPages > 1 ? (
        <div className="border-border mt-4 flex items-center justify-end gap-2 border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground text-xs">
            Página {page} de {query.data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= query.data.pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Siguiente
          </Button>
        </div>
      ) : null}

      <CaseEventSheet
        open={sheetOpen}
        event={editing}
        busy={busy}
        error={error}
        caseContext={caseContext}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditing(null);
        }}
        onSubmit={save}
      />

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) {
            setDeleting(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar evento</DialogTitle>
            <DialogDescription>
              {deleting
                ? `Se eliminará “${deleting.title}”. Esta acción no se puede deshacer.`
                : "Esta acción no se puede deshacer."}
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <p role="alert" className="text-danger text-sm">
              {deleteError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={remove.isPending}
              onClick={() => setDeleting(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => void confirmDelete()}
            >
              {remove.isPending ? "Eliminando…" : "Confirmar eliminación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
