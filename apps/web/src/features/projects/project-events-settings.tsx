import { useState, type FormEvent } from "react";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/calendar-date-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getListProjectActivitiesQueryKey } from "@/lib/api/generated/activity/activity";
import {
  getListProjectEventsQueryKey,
  useCreateProjectEvent,
  useDeleteProjectEvent,
  useListProjectEvents,
  useUpdateProjectEvent,
} from "@/lib/api/generated/project-events/project-events";
import {
  getGetProjectTaskScheduleQueryKey,
  getListProjectTaskCalendarQueryKey,
} from "@/lib/api/generated/project-tasks/project-tasks";
import type { ProjectEvent } from "@/lib/api/generated/models";
import { formatProjectCalendarDate } from "./project-presentation";

export function ProjectEventsSettings({
  projectId,
  projectStartDate,
  readOnly,
}: {
  projectId: string;
  projectStartDate: string;
  readOnly: boolean;
}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const query = useListProjectEvents(projectId, { page, pageSize: 25 });
  const createMutation = useCreateProjectEvent();
  const updateMutation = useUpdateProjectEvent();
  const deleteMutation = useDeleteProjectEvent();
  const [editing, setEditing] = useState<ProjectEvent | null>(null);
  const [deleting, setDeleting] = useState<ProjectEvent | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("Fecha legal");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;
  const eventCount = query.data?.pagination.total;

  function reset() {
    setAdding(false);
    setEditing(null);
    setDeleting(null);
    setTitle("Fecha legal");
    setDate("");
    setDescription("");
    setError(null);
  }

  function beginEdit(event: ProjectEvent) {
    setEditing(event);
    setAdding(false);
    setTitle(event.title);
    setDate(event.date);
    setDescription(event.description ?? "");
    setError(null);
  }

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getListProjectEventsQueryKey(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: getGetProjectTaskScheduleQueryKey(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: getListProjectTaskCalendarQueryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: getListProjectActivitiesQueryKey(projectId),
      }),
    ]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (cleanTitle.length < 2 || !date) {
      setError("Ingresa un nombre y una fecha para el evento.");
      return;
    }
    if (date < projectStartDate) {
      setError("El evento no puede ser anterior al inicio del proyecto.");
      return;
    }
    setError(null);
    try {
      const data = {
        title: cleanTitle,
        type: "legal" as const,
        date,
        description: description.trim() || null,
      };
      if (editing) {
        await updateMutation.mutateAsync({
          projectId,
          eventId: editing.id,
          data,
        });
      } else {
        await createMutation.mutateAsync({ projectId, data });
      }
      reset();
      await refresh();
    } catch {
      setError("No pudimos guardar el evento. Inténtalo nuevamente.");
    }
  }

  async function remove(event: ProjectEvent) {
    setError(null);
    try {
      await deleteMutation.mutateAsync({ projectId, eventId: event.id });
      if (editing?.id === event.id) reset();
      setDeleting(null);
      if (query.data?.events.length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      await refresh();
    } catch {
      setError("No pudimos eliminar el evento. Inténtalo nuevamente.");
    }
  }

  const showForm = adding || editing !== null;
  return (
    <section
      aria-labelledby="project-events-title"
      className="rounded-card border-border bg-card shadow-panel border p-4 sm:px-5 sm:py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="bg-primary-soft text-primary-strong flex size-9 shrink-0 items-center justify-center rounded-lg">
            <CalendarDays aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2
                id="project-events-title"
                className="font-display text-base font-semibold"
              >
                Eventos
              </h2>
              {eventCount !== undefined ? (
                <span className="text-muted-foreground text-xs font-medium tabular-nums">
                  {eventCount} {eventCount === 1 ? "evento" : "eventos"}
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs leading-5">
              Fechas legales relevantes del proyecto.
            </p>
          </div>
        </div>
        {!readOnly && !showForm ? (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" /> Añadir evento legal
          </Button>
        ) : null}
      </div>

      {query.isPending ? (
        <p className="border-border text-muted-foreground mt-3 border-t pt-3 text-sm">
          Cargando eventos…
        </p>
      ) : query.isError ? (
        <div className="border-border mt-3 flex items-center gap-3 border-t pt-3">
          <p role="status" className="text-danger text-sm">
            No pudimos cargar los eventos.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
          >
            Reintentar
          </Button>
        </div>
      ) : query.data.events.length === 0 ? (
        <div className="border-border text-muted-foreground mt-3 flex min-h-10 items-center gap-2 border-t pt-3">
          <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
          <p className="text-sm font-medium">Sin eventos legales</p>
        </div>
      ) : (
        <ul className="divide-border border-border mt-3 divide-y border-t">
          {query.data.events.map((event) => (
            <li
              key={event.id}
              className="grid min-h-11 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-x-4"
            >
              <CalendarDays
                aria-hidden="true"
                className="text-primary mt-0.5 size-4 shrink-0 sm:mt-0"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{event.title}</p>
                {event.description ? (
                  <p className="text-muted-foreground mt-0.5 text-sm leading-5">
                    {event.description}
                  </p>
                ) : null}
              </div>
              <time
                dateTime={event.date}
                className="text-muted-foreground col-start-2 shrink-0 text-sm font-medium tabular-nums sm:col-start-3 sm:row-start-1 sm:text-right"
              >
                {formatProjectCalendarDate(event.date)}
              </time>
              {!readOnly ? (
                <div className="col-start-2 flex gap-1 sm:col-start-4 sm:row-start-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar ${event.title}`}
                    onClick={() => beginEdit(event)}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Eliminar ${event.title}`}
                    disabled={pending}
                    onClick={() => setDeleting(event)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!query.isPending &&
      !query.isError &&
      query.data.pagination.totalPages > 1 ? (
        <nav
          aria-label="Paginación de eventos"
          className="mt-4 flex items-center justify-between gap-3"
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Anterior
          </Button>
          <p className="text-muted-foreground text-sm">
            Página {query.data.pagination.page} de{" "}
            {query.data.pagination.totalPages}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= query.data.pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Siguiente
          </Button>
        </nav>
      ) : null}

      {deleting ? (
        <div
          role="group"
          aria-label={`Confirmar eliminación de ${deleting.title}`}
          className="border-danger/25 bg-danger-soft rounded-control mt-5 border p-4"
        >
          <p className="text-sm font-semibold">¿Eliminar este evento legal?</p>
          <p className="text-muted-foreground mt-1 text-sm">
            “{deleting.title}” dejará de aparecer en el proyecto y sus
            calendarios.
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDeleting(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => void remove(deleting)}
            >
              {deleteMutation.isPending
                ? "Eliminando…"
                : "Confirmar eliminación"}
            </Button>
          </div>
        </div>
      ) : null}

      {showForm ? (
        <form
          className="border-border bg-muted/25 rounded-control mt-5 space-y-4 border p-4"
          onSubmit={submit}
        >
          <div className="space-y-2">
            <label
              htmlFor="project-event-title"
              className="text-sm font-semibold"
            >
              Nombre
            </label>
            <Input
              id="project-event-title"
              value={title}
              maxLength={160}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <DatePicker
            id="project-event-date"
            label="Fecha"
            required
            min={projectStartDate}
            value={date}
            onChange={setDate}
          />
          <div className="space-y-2">
            <label
              htmlFor="project-event-description"
              className="text-sm font-semibold"
            >
              Descripción
            </label>
            <Textarea
              id="project-event-description"
              value={description}
              maxLength={2000}
              onChange={(event) => setDescription(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">Opcional</p>
          </div>
          {error ? (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={reset}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Guardando…"
                : editing
                  ? "Guardar cambios"
                  : "Crear evento"}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
