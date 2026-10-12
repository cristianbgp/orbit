import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CaseEventCalendarItem } from "@/lib/api/generated/models";
import {
  CaseEventTypeIcon,
  getCaseEventTypePresentation,
} from "./case-event-types";

function fullDate(date: string) {
  return format(parseISO(date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
}

export function CaseEventCalendarDaySheet({
  open,
  date,
  events,
  onOpenChange,
  onOpenEvent,
}: {
  open: boolean;
  date: string | null;
  events: CaseEventCalendarItem[];
  onOpenChange(open: boolean): void;
  onOpenEvent(event: CaseEventCalendarItem, opener: HTMLElement): void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto overscroll-contain sm:max-w-md">
        <SheetHeader className="border-border border-b pr-16">
          <SheetTitle className="font-display text-xl capitalize">
            {date ? fullDate(date) : "Eventos"}
          </SheetTitle>
          <SheetDescription>
            Eventos de casos programados para esta fecha.
          </SheetDescription>
        </SheetHeader>
        <div className="divide-border divide-y px-4">
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              aria-label={`${event.title}. ${event.case.client.name}. ${event.case.identification}`}
              className="hover:bg-muted/35 focus-visible:ring-ring flex min-h-16 w-full items-start gap-3 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
              onClick={(click) => onOpenEvent(event, click.currentTarget)}
            >
              <CaseEventTypeIcon
                type={event.type}
                className="text-primary mt-0.5 size-5 shrink-0"
              />
              <span className="min-w-0">
                <span className="block font-semibold">{event.title}</span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  {getCaseEventTypePresentation(event.type).label}
                </span>
                <span className="text-muted-foreground mt-1 block text-sm">
                  {event.case.client.name} · {event.case.identification}
                </span>
              </span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
