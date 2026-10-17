import { Maximize2, Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TimelineZoomPreference } from "./project-task-timeline-zoom";

function ZoomButton({
  label,
  disabled = false,
  active,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  active?: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            type="button"
            variant={active ? "secondary" : "ghost"}
            size="icon"
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            className="size-11 rounded-md shadow-none active:translate-y-px lg:size-8"
            onClick={onClick}
          >
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function TimelineZoomControls({
  preference,
  canZoomIn,
  canZoomOut,
  disabled = false,
  onZoomIn,
  onZoomOut,
  onFit,
}: {
  preference: TimelineZoomPreference;
  canZoomIn: boolean;
  canZoomOut: boolean;
  disabled?: boolean;
  onZoomIn(): void;
  onZoomOut(): void;
  onFit(): void;
}) {
  return (
    <div
      role="group"
      aria-label="Zoom del cronograma"
      className="border-border bg-muted/35 rounded-control inline-flex items-center gap-0.5 border p-1 shadow-sm"
    >
      <ZoomButton
        label="Alejar cronograma"
        disabled={disabled || !canZoomOut}
        onClick={onZoomOut}
      >
        <Minus aria-hidden="true" />
      </ZoomButton>
      <ZoomButton
        label="Ajustar cronograma al ancho"
        disabled={disabled}
        active={preference === "fit"}
        onClick={onFit}
      >
        <Maximize2 aria-hidden="true" />
      </ZoomButton>
      <ZoomButton
        label="Acercar cronograma"
        disabled={disabled || !canZoomIn}
        onClick={onZoomIn}
      >
        <Plus aria-hidden="true" />
      </ZoomButton>
    </div>
  );
}
