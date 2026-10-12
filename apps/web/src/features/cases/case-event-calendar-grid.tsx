import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { caseEventCalendarTone } from "./case-event-calendar-colors";
import type { CaseEventCalendarLayout } from "./case-event-calendar-layout";
import {
  CaseEventTypeIcon,
  getCaseEventTypePresentation,
} from "./case-event-types";

const weekdayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function fullDate(date: string) {
  return format(parseISO(date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
}

export function CaseEventCalendarGrid({
  layout,
  onOpenEvent,
  onOpenDay,
}: {
  layout: CaseEventCalendarLayout;
  onOpenEvent(
    event: CaseEventCalendarLayout["daysByDate"][string]["events"][number],
    opener: HTMLElement,
  ): void;
  onOpenDay(date: string, opener: HTMLElement): void;
}) {
  return (
    <TooltipProvider>
      <div
        role="grid"
        aria-label="Calendario de eventos de casos"
        className="border-border bg-card rounded-card hidden overflow-hidden border md:block"
      >
        <div
          role="row"
          className="border-border bg-muted/40 grid grid-cols-7 border-b"
        >
          {weekdayLabels.map((label, index) => (
            <div
              key={label}
              role="columnheader"
              className={cn(
                "border-border text-muted-foreground border-r px-3 py-2 text-xs font-semibold last:border-r-0",
                index >= 5 && "bg-muted/70 text-foreground/80",
              )}
            >
              {label}
            </div>
          ))}
        </div>
        {layout.weeks.map((week) => (
          <div
            key={week.from}
            role="row"
            className="border-border grid min-h-40 grid-cols-7 border-b last:border-b-0"
          >
            {week.dates.map((date) => {
              const day = layout.daysByDate[date]!;
              return (
                <div
                  key={date}
                  role="gridcell"
                  aria-label={fullDate(date)}
                  aria-current={day.isToday ? "date" : undefined}
                  className={cn(
                    "border-border relative min-w-0 border-r p-2 last:border-r-0",
                    day.outsideMonth && "bg-muted/25 text-muted-foreground",
                    day.isWeekend && "bg-muted/60",
                    day.isToday && "bg-primary/8",
                  )}
                >
                  <div className="mb-2 flex justify-end">
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full text-xs",
                        day.isToday &&
                          "bg-primary text-primary-foreground font-semibold",
                      )}
                    >
                      {format(parseISO(date), "d")}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {day.visible.map((event) => {
                      const tone = caseEventCalendarTone(event.case.id);
                      const context = `${event.case.client.name} · ${event.case.identification}`;
                      const label = `${event.title}. ${event.case.client.name}. ${event.case.identification}. ${fullDate(event.date)}`;
                      return (
                        <Tooltip key={event.id}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={label}
                              className={cn(
                                "focus-visible:ring-ring rounded-control flex min-h-11 w-full min-w-0 items-start gap-1.5 border px-1.5 py-1.5 text-left text-[11px] font-medium outline-none hover:brightness-95 focus-visible:ring-2",
                                tone.surface,
                                tone.border,
                                tone.text,
                              )}
                              onClick={(click) =>
                                onOpenEvent(event, click.currentTarget)
                              }
                            >
                              <CaseEventTypeIcon
                                type={event.type}
                                className="mt-0.5 size-3 shrink-0"
                              />
                              <span className="min-w-0 leading-tight">
                                <span className="block truncate font-semibold">
                                  {event.title}
                                </span>
                                <span className="text-muted-foreground mt-0.5 block truncate text-[10px] font-normal">
                                  {context}
                                </span>
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-72 space-y-1">
                            <p className="font-semibold">{event.title}</p>
                            <p>
                              {getCaseEventTypePresentation(event.type).label}
                            </p>
                            <p>{context}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                    {day.overflow ? (
                      <button
                        type="button"
                        aria-label={`${day.overflow} ${day.overflow === 1 ? "evento adicional" : "eventos adicionales"} el ${fullDate(date)}`}
                        className="hover:bg-muted focus-visible:ring-ring rounded-control min-h-7 w-full px-1.5 text-left text-[11px] font-semibold outline-none focus-visible:ring-2"
                        onClick={(click) =>
                          onOpenDay(date, click.currentTarget)
                        }
                      >
                        +{day.overflow} eventos
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
