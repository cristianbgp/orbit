import { CalendarIcon, XIcon } from "lucide-react";
import { useId, useState } from "react";
import type { DateRange, Matcher } from "react-day-picker";
import { es } from "react-day-picker/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { useCalendarToday } from "@/components/ui/calendar-today-context";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const spanishDateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function calendarDateToDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

export function dateToCalendarDate(value: Date) {
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function formatCalendarDate(value: string) {
  return spanishDateFormatter.format(calendarDateToDate(value));
}

type SharedFieldProps = {
  id: string;
  label: string;
  description?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

function FieldMessage({
  description,
  error,
  descriptionId,
  errorId,
}: {
  description?: string;
  error?: string;
  descriptionId: string;
  errorId: string;
}) {
  if (error) {
    return (
      <p id={errorId} role="alert" className="text-danger text-sm">
        {error}
      </p>
    );
  }
  return description ? (
    <p id={descriptionId} className="text-muted-foreground text-xs">
      {description}
    </p>
  ) : null;
}

function describedBy(
  description: string | undefined,
  error: string | undefined,
  descriptionId: string,
  errorId: string,
) {
  if (error) return errorId;
  return description ? descriptionId : undefined;
}

function disabledMatchers(min?: string, max?: string): Matcher[] | undefined {
  const matchers: Matcher[] = [];
  if (min) matchers.push({ before: calendarDateToDate(min) });
  if (max) matchers.push({ after: calendarDateToDate(max) });
  return matchers.length > 0 ? matchers : undefined;
}

function useCalendarTodayDate() {
  const today = useCalendarToday();
  return today ? calendarDateToDate(today) : undefined;
}

export function DatePicker({
  id,
  label,
  value,
  onChange,
  min,
  max,
  description,
  error,
  disabled = false,
  required = false,
  className,
}: SharedFieldProps & {
  value: string;
  onChange(value: string): void;
  min?: string;
  max?: string;
}) {
  const [open, setOpen] = useState(false);
  const generatedId = useId();
  const descriptionId = `${generatedId}-description`;
  const errorId = `${generatedId}-error`;
  const selected = value ? calendarDateToDate(value) : undefined;
  const today = useCalendarTodayDate();

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy(
              description,
              error,
              descriptionId,
              errorId,
            )}
            className={cn(
              "h-11 w-full justify-start px-3 text-left font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon aria-hidden="true" />
            <span>
              {value ? formatCalendarDate(value) : "Selecciona una fecha"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="max-w-[calc(100vw-2rem)]">
          <Calendar
            mode="single"
            locale={es}
            timeZone="UTC"
            today={today}
            selected={selected}
            defaultMonth={
              selected ?? (min ? calendarDateToDate(min) : undefined)
            }
            disabled={disabledMatchers(min, max)}
            onSelect={(next) => {
              if (!next) return;
              onChange(dateToCalendarDate(next));
              setOpen(false);
            }}
          />
          {!required && value ? (
            <div className="border-border border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <XIcon aria-hidden="true" />
                Limpiar fecha
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
      <FieldMessage
        description={description}
        error={error}
        descriptionId={descriptionId}
        errorId={errorId}
      />
    </div>
  );
}

export function DateRangePicker({
  id,
  label,
  from,
  to,
  onChange,
  min,
  description,
  error,
  disabled = false,
  required = false,
  className,
}: SharedFieldProps & {
  from: string;
  to: string;
  onChange(value: { from: string; to: string }): void;
  min?: string;
}) {
  const [open, setOpen] = useState(false);
  const generatedId = useId();
  const descriptionId = `${generatedId}-description`;
  const errorId = `${generatedId}-error`;
  const today = useCalendarTodayDate();
  const selected: DateRange | undefined = from
    ? {
        from: calendarDateToDate(from),
        ...(to ? { to: calendarDateToDate(to) } : {}),
      }
    : undefined;
  const displayValue = from
    ? to
      ? `${formatCalendarDate(from)} – ${formatCalendarDate(to)}`
      : `Desde ${formatCalendarDate(from)}`
    : to
      ? `Hasta ${formatCalendarDate(to)}`
      : "Selecciona un periodo";

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy(
              description,
              error,
              descriptionId,
              errorId,
            )}
            className={cn(
              "h-11 w-full justify-start px-3 text-left font-normal",
              !from && "text-muted-foreground",
            )}
          >
            <CalendarIcon aria-hidden="true" />
            <span>{displayValue}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="max-w-[calc(100vw-2rem)]">
          <Calendar
            mode="range"
            resetOnSelect
            locale={es}
            timeZone="UTC"
            today={today}
            selected={selected}
            defaultMonth={
              selected?.from ??
              (to
                ? calendarDateToDate(to)
                : min
                  ? calendarDateToDate(min)
                  : undefined)
            }
            disabled={disabledMatchers(min)}
            onSelect={(next) => {
              const nextFrom = next?.from ? dateToCalendarDate(next.from) : "";
              const selectedTo = next?.to ? dateToCalendarDate(next.to) : "";
              const nextTo = !from && selectedTo === nextFrom ? "" : selectedTo;
              onChange({ from: nextFrom, to: nextTo });
              if (nextFrom && nextTo) setOpen(false);
            }}
          />
          {!required && (from || to) ? (
            <div className="border-border border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  onChange({ from: "", to: "" });
                  setOpen(false);
                }}
              >
                <XIcon aria-hidden="true" />
                Limpiar fechas
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
      <FieldMessage
        description={description}
        error={error}
        descriptionId={descriptionId}
        errorId={errorId}
      />
    </div>
  );
}
