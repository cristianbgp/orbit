import { CircleCheck, CirclePause, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { projectCalendarMarkerPresentation } from "./project-calendar-marker-presentation";

export function ProjectCalendarLegend() {
  return (
    <div
      role="group"
      aria-label="Leyenda del calendario"
      className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-xs"
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          data-testid="project-color-swatch"
          aria-hidden="true"
          className="flex -space-x-1"
        >
          <span className="border-card size-3 rounded-full border bg-indigo-600" />
          <span className="border-card size-3 rounded-full border bg-emerald-600" />
          <span className="border-card size-3 rounded-full border bg-violet-600" />
        </span>
        Color de barra: proyecto
      </span>
      {(["project_start", "project_end", "project_event"] as const).map(
        (kind) => {
          const presentation = projectCalendarMarkerPresentation(kind);
          const MarkerIcon = presentation.Icon;
          return (
            <span key={kind} className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  "bg-card flex size-5 items-center justify-center rounded-full border shadow-sm",
                  presentation.frameTone,
                )}
              >
                <MarkerIcon aria-hidden="true" className="size-3" />
              </span>
              {presentation.label}
            </span>
          );
        },
      )}
      <span className="inline-flex items-center gap-1.5">
        <CircleCheck aria-hidden="true" className="text-success size-4" />
        Completada
      </span>
      <span className="inline-flex items-center gap-1.5">
        <CirclePause aria-hidden="true" className="text-danger size-4" />
        Suspendida
      </span>
      <span className="inline-flex items-center gap-1.5">
        <TriangleAlert aria-hidden="true" className="text-danger size-4" />
        Vencida
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          data-testid="weekend-swatch"
          aria-hidden="true"
          className="border-border bg-muted/60 rounded-control block size-5 border"
        />
        Fin de semana
      </span>
    </div>
  );
}
