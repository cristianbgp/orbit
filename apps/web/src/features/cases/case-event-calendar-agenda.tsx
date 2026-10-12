import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { caseEventCalendarTone } from "./case-event-calendar-colors";
import type { CaseEventCalendarLayout } from "./case-event-calendar-layout";
import { CaseEventTypeIcon } from "./case-event-types";

function fullDate(date: string) {
  return format(parseISO(date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
}

export function CaseEventCalendarAgenda({
  layout,
  onOpenEvent,
}: {
  layout: CaseEventCalendarLayout;
  onOpenEvent(
    event: CaseEventCalendarLayout["daysByDate"][string]["events"][number],
    opener: HTMLElement,
  ): void;
}) {
  const days = layout.range.dates
    .map((date) => layout.daysByDate[date]!)
    .filter((day) => !day.outsideMonth && day.events.length > 0);
  return (
    <div
      role="region"
      aria-label="Agenda de eventos de casos"
      className="space-y-4 md:hidden"
    >
      {days.map((day) => (
        <section
          key={day.date}
          className="border-border bg-card rounded-card overflow-hidden border"
        >
          <h3
            className={cn(
              "border-border bg-muted/35 border-b px-4 py-3 text-sm font-semibold capitalize",
              day.isWeekend && "bg-muted/70",
            )}
          >
            {fullDate(day.date)}
          </h3>
          <div className="divide-border divide-y">
            {day.events.map((event) => {
              const tone = caseEventCalendarTone(event.case.id);
              return (
                <button
                  key={event.id}
                  type="button"
                  aria-label={`${event.title}. ${event.case.client.name}. ${event.case.identification}`}
                  className="hover:bg-muted/35 focus-visible:ring-ring flex min-h-16 w-full items-start gap-3 p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
                  onClick={(click) => onOpenEvent(event, click.currentTarget)}
                >
                  <span
                    className={cn(
                      "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full border",
                      tone.surface,
                      tone.border,
                      tone.text,
                    )}
                  >
                    <CaseEventTypeIcon type={event.type} className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{event.title}</span>
                    <span className="text-muted-foreground mt-1 block text-sm">
                      {event.case.client.name} · {event.case.identification}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
