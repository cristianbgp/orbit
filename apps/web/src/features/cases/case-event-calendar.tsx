import { useRef, useState } from "react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getListCaseEventCalendarQueryKey,
  getListCaseEventsQueryKey,
  useListCaseEventCalendar,
  useDeleteCaseEvent,
  useUpdateCaseEvent,
} from "@/lib/api/generated/case-events/case-events";
import { getListCaseActivitiesQueryKey } from "@/lib/api/generated/cases/cases";
import { getListDashboardActivityQueryKey } from "@/lib/api/generated/dashboard/dashboard";
import type { CaseEventCalendarItem } from "@/lib/api/generated/models";
import { CaseEventCalendarAgenda } from "./case-event-calendar-agenda";
import { CaseEventCalendarDaySheet } from "./case-event-calendar-day-sheet";
import { CaseEventCalendarGrid } from "./case-event-calendar-grid";
import {
  currentCaseEventCalendarMonth,
  getCaseEventCalendarVisibleRange,
  layoutCaseEventCalendar,
  shiftCaseEventCalendarMonth,
} from "./case-event-calendar-layout";
import { CaseEventSheet } from "./case-event-sheet";
import type { CaseEventType } from "./case-event-types";
import type { CasePortfolioFilters } from "./case-portfolio-filter-state";

export function CaseEventCalendar({
  month,
  today,
  caseStatus,
  search,
  filters,
  onMonthChange,
}: {
  month: string;
  today: string;
  caseStatus: "in_progress" | "concluded";
  search: string;
  filters: CasePortfolioFilters;
  onMonthChange(month: string): void;
}) {
  const client = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<CaseEventCalendarItem | null>(null);
  const [deleting, setDeleting] = useState<CaseEventCalendarItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const range = getCaseEventCalendarVisibleRange(month);
  const query = useListCaseEventCalendar(
    {
      from: range.from,
      to: range.to,
      caseStatus,
      ...(search ? { search } : {}),
      ...(filters.types.length ? { type: filters.types } : {}),
      ...(filters.clientIds.length ? { client: filters.clientIds } : {}),
      ...(filters.memberUserIds.length
        ? { member: filters.memberUserIds }
        : {}),
    },
    { query: { placeholderData: keepPreviousData } },
  );
  const update = useUpdateCaseEvent();
  const remove = useDeleteCaseEvent();
  const settledCalendar = useRef<{
    month: string;
    data: NonNullable<typeof query.data>;
  } | null>(null);
  if (query.data && !query.isPlaceholderData && !query.isError) {
    settledCalendar.current = { month, data: query.data };
  }
  const displayedCalendar =
    (query.isPlaceholderData || query.isError) && settledCalendar.current
      ? settledCalendar.current
      : query.data
        ? { month, data: query.data }
        : null;
  const layout = displayedCalendar
    ? layoutCaseEventCalendar(
        displayedCalendar.data.events,
        displayedCalendar.month,
        today,
      )
    : null;
  const hasFilters = Boolean(
    search ||
    filters.types.length ||
    filters.clientIds.length ||
    filters.memberUserIds.length,
  );

  function openEvent(event: CaseEventCalendarItem) {
    setSelectedDate(null);
    setError(null);
    setEditing(event);
  }

  async function save(values: {
    title: string;
    type: CaseEventType;
    date: string;
    description: string | null;
  }) {
    if (!editing) return;
    setError(null);
    try {
      await update.mutateAsync({
        caseId: editing.case.id,
        eventId: editing.id,
        data: { ...values, expectedUpdatedAt: editing.updatedAt },
      });
      setEditing(null);
      await Promise.all([
        client.invalidateQueries({
          queryKey: getListCaseEventCalendarQueryKey(),
        }),
        client.invalidateQueries({
          queryKey: getListCaseEventsQueryKey(editing.case.id),
        }),
        client.invalidateQueries({
          queryKey: getListCaseActivitiesQueryKey(editing.case.id),
        }),
        client.invalidateQueries({
          queryKey: getListDashboardActivityQueryKey(),
        }),
      ]);
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
        caseId: deleting.case.id,
        eventId: deleting.id,
        data: { expectedUpdatedAt: deleting.updatedAt },
      });
      const caseId = deleting.case.id;
      setDeleting(null);
      await Promise.all([
        client.invalidateQueries({
          queryKey: getListCaseEventCalendarQueryKey(),
        }),
        client.invalidateQueries({
          queryKey: getListCaseEventsQueryKey(caseId),
        }),
        client.invalidateQueries({
          queryKey: getListCaseActivitiesQueryKey(caseId),
        }),
        client.invalidateQueries({
          queryKey: getListDashboardActivityQueryKey(),
        }),
      ]);
    } catch {
      setDeleteError(
        "No pudimos eliminar el evento. Recarga la página e inténtalo nuevamente.",
      );
    }
  }

  return (
    <section aria-label="Calendario de eventos" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-semibold capitalize">
          {format(
            parseISO(`${displayedCalendar?.month ?? month}-01`),
            "MMMM 'de' yyyy",
            { locale: es },
          )}
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Mes anterior"
            onClick={() =>
              onMonthChange(shiftCaseEventCalendarMonth(month, -1))
            }
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Ir al mes actual"
            onClick={() => onMonthChange(currentCaseEventCalendarMonth(today))}
          >
            Hoy
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Mes siguiente"
            onClick={() => onMonthChange(shiftCaseEventCalendarMonth(month, 1))}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>

      {query.isFetching && displayedCalendar ? (
        <p role="status" className="text-muted-foreground text-xs">
          Actualizando…
        </p>
      ) : null}
      {displayedCalendar?.data.truncated ? (
        <p
          role="status"
          className="rounded-control border border-amber-500/35 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          Mostramos los primeros 500 eventos. Ajusta los filtros para acotar el
          calendario.
        </p>
      ) : null}
      {query.isError && displayedCalendar ? (
        <div className="border-danger/25 bg-danger-soft rounded-control flex flex-wrap items-center justify-between gap-3 border px-3 py-2">
          <p className="text-danger text-sm">
            No pudimos actualizar el calendario de eventos.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
          >
            Intentar de nuevo
          </Button>
        </div>
      ) : null}

      {query.isPending && !displayedCalendar ? (
        <div
          role="status"
          aria-label="Cargando calendario de eventos"
          className="border-border bg-muted rounded-card h-96 animate-pulse border"
        />
      ) : query.isError && !displayedCalendar ? (
        <div className="border-danger/25 bg-card rounded-card border p-8 text-center">
          <p className="text-danger">
            No pudimos cargar el calendario de eventos.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
          >
            Intentar de nuevo
          </Button>
        </div>
      ) : layout && displayedCalendar?.data.events.length === 0 ? (
        <div className="border-border bg-card rounded-card border border-dashed p-8 text-center">
          <p className="font-medium">
            {hasFilters
              ? "No hay eventos con estos filtros."
              : "No hay eventos programados este mes."}
          </p>
          {hasFilters ? (
            <p className="text-muted-foreground mt-1 text-sm">
              Prueba con otros criterios.
            </p>
          ) : null}
        </div>
      ) : layout ? (
        <>
          <CaseEventCalendarGrid
            layout={layout}
            onOpenEvent={(event) => openEvent(event)}
            onOpenDay={(date) => setSelectedDate(date)}
          />
          <CaseEventCalendarAgenda
            layout={layout}
            onOpenEvent={(event) => openEvent(event)}
          />
        </>
      ) : null}

      <CaseEventCalendarDaySheet
        open={selectedDate !== null}
        date={selectedDate}
        events={
          selectedDate && layout
            ? (layout.daysByDate[selectedDate]?.events ?? [])
            : []
        }
        onOpenChange={(open) => {
          if (!open) setSelectedDate(null);
        }}
        onOpenEvent={(event) => openEvent(event)}
      />
      <CaseEventSheet
        open={editing !== null}
        event={editing}
        busy={update.isPending || remove.isPending}
        error={error}
        caseContext={
          editing
            ? {
                caseId: editing.case.id,
                caseName: editing.case.identification,
                clientName: editing.case.client.name,
              }
            : undefined
        }
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSubmit={save}
        onDelete={
          editing
            ? () => {
                setDeleteError(null);
                setDeleting(editing);
                setEditing(null);
              }
            : undefined
        }
      />
      <Dialog
        open={deleting !== null}
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
