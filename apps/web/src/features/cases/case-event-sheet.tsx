import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/calendar-date-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { CaseEvent } from "@/lib/api/generated/models/caseEvent";
import {
  CASE_EVENT_TYPE_OPTIONS,
  getCaseEventTypePresentation,
  type CaseEventType,
} from "./case-event-types";
import {
  CaseSheetContext,
  type CaseSheetContextValue,
} from "./case-sheet-context";

type CaseEventValues = {
  title: string;
  type: CaseEventType;
  date: string;
  description: string | null;
};

type ValidationErrors = {
  title?: string;
  date?: string;
};

export function CaseEventSheet({
  open,
  event,
  busy,
  error,
  caseContext,
  onOpenChange,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  event: CaseEvent | null;
  busy: boolean;
  error: string | null;
  caseContext?: CaseSheetContextValue;
  onOpenChange(open: boolean): void;
  onSubmit(values: CaseEventValues): Promise<void>;
  onDelete?(): void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<CaseEventType>("oral_argument");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [validation, setValidation] = useState<ValidationErrors>({});

  useEffect(() => {
    if (!open) return;
    const nextType = (event?.type ?? "oral_argument") as CaseEventType;
    setType(nextType);
    setTitle(
      event?.title ?? getCaseEventTypePresentation(nextType).suggestedTitle,
    );
    setDate(event?.date ?? "");
    setDescription(event?.description ?? "");
    setValidation({});
  }, [event, open]);

  async function submit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const normalizedTitle = title.trim();
    const nextValidation: ValidationErrors = {};
    if (normalizedTitle.length < 2) {
      nextValidation.title = "Ingresa un título de al menos 2 caracteres.";
    }
    if (!date) nextValidation.date = "Selecciona una fecha.";
    if (Object.keys(nextValidation).length) {
      setValidation(nextValidation);
      return;
    }
    setValidation({});
    await onSubmit({
      title: normalizedTitle,
      type,
      date,
      description: description.trim() || null,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto overscroll-contain sm:max-w-md">
        <SheetHeader className="border-border border-b pr-16">
          <SheetTitle className="font-display text-xl">
            {event ? "Editar evento" : "Nuevo evento"}
          </SheetTitle>
          <SheetDescription className="leading-6">
            Registra una fecha relevante vinculada a este caso.
          </SheetDescription>
          {caseContext ? (
            <CaseSheetContext
              value={caseContext}
              onNavigate={() => onOpenChange(false)}
            />
          ) : null}
        </SheetHeader>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
          <div className="flex-1 space-y-5 px-4 py-5">
            <div className="space-y-2">
              <label
                htmlFor="case-event-type"
                className="block text-sm font-semibold"
              >
                Tipo
              </label>
              <Select
                value={type}
                onValueChange={(value: CaseEventType) => {
                  const currentSuggestion =
                    getCaseEventTypePresentation(type).suggestedTitle;
                  const nextSuggestion =
                    getCaseEventTypePresentation(value).suggestedTitle;
                  setType(value);
                  if (!event && title === currentSuggestion)
                    setTitle(nextSuggestion);
                }}
              >
                <SelectTrigger
                  id="case-event-type"
                  className="w-full"
                  aria-label="Tipo"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASE_EVENT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <option.icon aria-hidden="true" />
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="case-event-title"
                className="block text-sm font-semibold"
              >
                Título
              </label>
              <Input
                id="case-event-title"
                autoFocus
                value={title}
                maxLength={160}
                placeholder="Describe el evento"
                aria-invalid={Boolean(validation.title)}
                onChange={(inputEvent) => {
                  setTitle(inputEvent.target.value);
                  setValidation((current) => ({
                    ...current,
                    title: undefined,
                  }));
                }}
              />
              {validation.title ? (
                <p role="alert" className="text-danger text-sm">
                  {validation.title}
                </p>
              ) : null}
            </div>
            <DatePicker
              id="case-event-date"
              label="Fecha"
              value={date}
              onChange={(value) => {
                setDate(value);
                setValidation((current) => ({
                  ...current,
                  date: undefined,
                }));
              }}
              error={validation.date}
              required
            />
            <div className="space-y-2">
              <label
                htmlFor="case-event-description"
                className="block text-sm font-semibold"
              >
                Descripción{" "}
                <span className="text-muted-foreground font-normal">
                  (opcional)
                </span>
              </label>
              <Textarea
                id="case-event-description"
                value={description}
                maxLength={2_000}
                rows={6}
                placeholder="Añade contexto relevante"
                onChange={(inputEvent) =>
                  setDescription(inputEvent.target.value)
                }
                onKeyDown={(keyboardEvent) => {
                  if (
                    (keyboardEvent.metaKey || keyboardEvent.ctrlKey) &&
                    keyboardEvent.key === "Enter"
                  ) {
                    keyboardEvent.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <p className="text-muted-foreground text-right text-xs">
                {description.length}/2000
              </p>
            </div>
            {error ? (
              <p role="alert" className="text-danger text-sm">
                {error}
              </p>
            ) : null}
          </div>
          <SheetFooter className="border-border border-t pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-between">
            {event && onDelete ? (
              <Button
                type="button"
                variant="outline"
                className="text-danger hover:bg-danger/10 hover:text-danger"
                disabled={busy}
                onClick={onDelete}
              >
                Eliminar evento
              </Button>
            ) : null}
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar evento"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
