import { useEffect, useId, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/calendar-date-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type InitialLegalEventDraft = {
  id: string;
  title: string;
  date: string;
  description: string;
};

export type InitialLegalEventDraftErrors = {
  title?: string;
  date?: string;
};

export function createInitialLegalEventDraft(
  id: string,
): InitialLegalEventDraft {
  return { id, title: "Fecha legal", date: "", description: "" };
}

export function InitialLegalEventsField({
  value,
  projectStartDate,
  errors = {},
  onChange,
}: {
  value: InitialLegalEventDraft[];
  projectStartDate: string;
  errors?: Record<string, InitialLegalEventDraftErrors>;
  onChange(value: InitialLegalEventDraft[]): void;
}) {
  const fieldId = useId();
  const nextRowNumber = useRef(value.length + 1);
  const pendingFocusId = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingFocusId.current) return;
    document.getElementById(pendingFocusId.current)?.focus();
    pendingFocusId.current = null;
  }, [value]);

  function update(
    id: string,
    key: "title" | "date" | "description",
    nextValue: string,
  ) {
    onChange(
      value.map((event) =>
        event.id === id ? { ...event, [key]: nextValue } : event,
      ),
    );
  }

  function add() {
    if (value.length >= 25) return;
    const id = `legal-event-${nextRowNumber.current++}`;
    pendingFocusId.current = `${fieldId}-${id}-title`;
    onChange([...value, createInitialLegalEventDraft(id)]);
  }

  function remove(id: string) {
    const remaining = value.filter((event) => event.id !== id);
    onChange(
      remaining.length > 0
        ? remaining
        : [
            createInitialLegalEventDraft(
              `legal-event-${nextRowNumber.current++}`,
            ),
          ],
    );
  }

  return (
    <fieldset className="border-border bg-muted/25 rounded-control space-y-4 border p-4">
      <legend className="px-1 text-sm font-semibold">
        Eventos legales iniciales
      </legend>
      <p className="text-muted-foreground text-xs leading-5">
        Opcional. Puedes registrar varias fechas y gestionarlas después desde la
        configuración del proyecto.
      </p>

      <div className="space-y-4">
        {value.map((event, index) => {
          const number = index + 1;
          const titleId = `${fieldId}-${event.id}-title`;
          return (
            <fieldset
              key={event.id}
              className="border-border bg-background rounded-control space-y-4 border p-4"
            >
              <legend className="px-1 text-sm font-semibold">
                Fecha legal {number}
              </legend>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Eliminar fecha legal ${number}`}
                  onClick={() => remove(event.id)}
                >
                  <Trash2 aria-hidden="true" />
                  Eliminar
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor={titleId}
                    className="block text-sm font-semibold"
                  >
                    Nombre del evento legal {number}
                  </label>
                  <Input
                    id={titleId}
                    maxLength={160}
                    aria-invalid={Boolean(errors[event.id]?.title)}
                    value={event.title}
                    onChange={(inputEvent) =>
                      update(event.id, "title", inputEvent.target.value)
                    }
                  />
                  {errors[event.id]?.title ? (
                    <p role="alert" className="text-danger text-sm">
                      {errors[event.id]?.title}
                    </p>
                  ) : null}
                </div>
                <DatePicker
                  id={`${fieldId}-${event.id}-date`}
                  label={`Fecha legal ${number}`}
                  value={event.date}
                  min={projectStartDate || undefined}
                  error={errors[event.id]?.date}
                  onChange={(date) => update(event.id, "date", date)}
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor={`${fieldId}-${event.id}-description`}
                  className="block text-sm font-semibold"
                >
                  Descripción del evento legal {number}
                </label>
                <Textarea
                  id={`${fieldId}-${event.id}-description`}
                  maxLength={2_000}
                  value={event.description}
                  onChange={(inputEvent) =>
                    update(event.id, "description", inputEvent.target.value)
                  }
                />
                <p className="text-muted-foreground text-xs">Opcional</p>
              </div>
            </fieldset>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={value.length >= 25}
        onClick={add}
      >
        <Plus aria-hidden="true" />
        Añadir otra fecha legal
      </Button>
    </fieldset>
  );
}
