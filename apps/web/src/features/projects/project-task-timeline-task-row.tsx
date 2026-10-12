import { useEffect, useRef, useState, type RefObject } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type {
  ProjectTaskScheduleTask,
  ProjectTaskStatus,
} from "@/lib/api/generated/models";
import { cn } from "@/lib/utils";
import { formatProjectCalendarDate } from "./project-presentation";
import { projectTaskStatusLabel } from "./project-task-labels";
import { ProjectTaskStatusSelect } from "./project-task-status-select";
import {
  TIMELINE_LABEL_WIDTH,
  timelineDayOffset,
  timelineTaskRange,
} from "./project-task-timeline-calendar";
import {
  resizeTimelineTaskDates,
  timelineResizeDeltaDays,
  type TimelineResizeEdge,
  type TimelineTaskDateRange,
} from "./project-task-timeline-resize";

const taskBarClasses = {
  pending: "bg-task-status-pending text-white",
  in_progress: "bg-task-status-in-progress text-white",
  blocked: "bg-task-status-blocked text-white",
  completed: "bg-task-status-completed text-white",
} satisfies Record<ProjectTaskStatus, string>;

const taskStripeClasses = {
  pending: "bg-task-status-pending",
  in_progress: "bg-task-status-in-progress",
  blocked: "bg-task-status-blocked",
  completed: "bg-task-status-completed",
} satisfies Record<ProjectTaskStatus, string>;

type TimelineDay = {
  date: string;
  isWeekend: boolean;
};

type TimelineTaskInteractionProps = {
  task: ProjectTaskScheduleTask;
  stageName: string;
  highlighted?: boolean;
  updating?: boolean;
  readOnly?: boolean;
  taskOpenerRef?: RefObject<HTMLElement | null>;
  onOpenTask(task: ProjectTaskScheduleTask): void;
  onStatusChange(
    task: ProjectTaskScheduleTask,
    status: ProjectTaskStatus,
  ): void;
  onHighlightChange?(highlighted: boolean): void;
};

type TimelineTaskTrackProps = TimelineTaskInteractionProps & {
  days: TimelineDay[];
  startDay: number;
  dayWidth: number;
  trackWidth: number;
  today?: string;
  endDatePosition: number;
  eventMarkers: Array<{ id: string; position: number }>;
  dateResize?: TimelineTaskDateResize;
};

export type TimelineTaskDateResize = {
  projectStartDate: string;
  scrollRegionRef: RefObject<HTMLDivElement | null>;
  onSessionChange(active: boolean): void;
  onRequestHorizon(provisionalDate: string): void;
  onDateRangeChange(
    task: ProjectTaskScheduleTask,
    range: TimelineTaskDateRange,
  ): Promise<boolean> | boolean;
};

type TimelineTaskLabelProps = TimelineTaskInteractionProps & {
  sticky?: boolean;
};

function openTaskFrom(
  element: HTMLElement,
  task: ProjectTaskScheduleTask,
  taskOpenerRef: RefObject<HTMLElement | null> | undefined,
  onOpenTask: (task: ProjectTaskScheduleTask) => void,
) {
  if (taskOpenerRef) taskOpenerRef.current = element;
  onOpenTask(task);
}

function tooltipDateCopy(task: ProjectTaskScheduleTask) {
  if (task.plannedStartDate && task.internalDueDate) {
    if (task.plannedStartDate === task.internalDueDate) {
      return `Fecha: ${formatProjectCalendarDate(task.plannedStartDate)}`;
    }
    return `Del ${formatProjectCalendarDate(task.plannedStartDate)} al ${formatProjectCalendarDate(task.internalDueDate)}`;
  }
  if (task.plannedStartDate) {
    return `Inicio planificado: ${formatProjectCalendarDate(task.plannedStartDate)}`;
  }
  if (task.internalDueDate) {
    return `Fecha límite: ${formatProjectCalendarDate(task.internalDueDate)}`;
  }
  return "Sin fechas";
}

export function ProjectTaskTimelineTaskLabel({
  task,
  highlighted = false,
  updating = false,
  readOnly = false,
  sticky = false,
  taskOpenerRef,
  onOpenTask,
  onStatusChange,
  onHighlightChange,
}: TimelineTaskLabelProps) {
  return (
    <div
      data-timeline-label-row={`task-${task.id}`}
      data-task-status={task.status}
      data-highlighted={highlighted ? "true" : undefined}
      className={cn(
        "border-border bg-card relative flex h-14 min-w-0 items-center border-r border-b py-1 pr-3 pl-10 transition-colors",
        highlighted &&
          "before:bg-primary/5 before:pointer-events-none before:absolute before:inset-0 before:content-['']",
        sticky && "sticky left-0 z-30",
      )}
      onPointerEnter={() => onHighlightChange?.(true)}
      onPointerLeave={() => onHighlightChange?.(false)}
      onFocusCapture={() => onHighlightChange?.(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onHighlightChange?.(false);
        }
      }}
    >
      <span
        aria-hidden="true"
        data-task-status-stripe={task.status}
        className={cn(
          "absolute left-7 h-7 w-1 rounded-full",
          taskStripeClasses[task.status],
        )}
      />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          className="focus-visible:ring-ring min-h-11 min-w-0 flex-1 truncate text-left text-xs font-semibold outline-none focus-visible:ring-2 md:min-h-7"
          aria-label={`Abrir tarea ${task.title}`}
          onClick={(event) =>
            openTaskFrom(event.currentTarget, task, taskOpenerRef, onOpenTask)
          }
        >
          {task.title}
        </button>
        <ProjectTaskStatusSelect
          display="icon"
          taskTitle={task.title}
          value={task.status}
          disabled={readOnly || updating}
          className="shrink-0"
          onValueChange={(status) => onStatusChange(task, status)}
        />
      </div>
    </div>
  );
}

export function ProjectTaskTimelineTaskTrack({
  task,
  stageName,
  highlighted = false,
  days,
  startDay,
  dayWidth,
  trackWidth,
  today,
  endDatePosition,
  eventMarkers,
  updating = false,
  readOnly = false,
  taskOpenerRef,
  onOpenTask,
  onHighlightChange,
  dateResize,
}: TimelineTaskTrackProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const startHandleRef = useRef<HTMLButtonElement>(null);
  const endHandleRef = useRef<HTMLButtonElement>(null);
  const taskRef = useRef(task);
  const dayWidthRef = useRef(dayWidth);
  const dateResizeRef = useRef(dateResize);
  const [taskTooltipOpen, setTaskTooltipOpen] = useState(false);
  const [handleIntent, setHandleIntent] = useState<TimelineResizeEdge | null>(
    null,
  );
  const [draft, setDraft] = useState<{
    edge: TimelineResizeEdge;
    range: TimelineTaskDateRange;
  } | null>(null);
  const draftRef = useRef(draft);
  const sessionRef = useRef<{
    edge: TimelineResizeEdge;
    kind: "pointer" | "keyboard";
    task: ProjectTaskScheduleTask;
    originalRange: TimelineTaskDateRange;
    initialPointerClientX: number;
    latestPointerClientX: number;
    initialScrollLeft: number;
    frozenDayWidth: number;
    keyboardDeltaDays: number;
  } | null>(null);
  taskRef.current = task;
  dayWidthRef.current = dayWidth;
  dateResizeRef.current = dateResize;
  draftRef.current = draft;

  const canStartResize = Boolean(
    dateResize && !readOnly && !updating && timelineTaskRange(task),
  );
  const showResizeHandles = canStartResize || draft !== null;
  const visibleTask = draft ? { ...task, ...draft.range } : task;
  const range = timelineTaskRange(visibleTask);
  const left = range
    ? Math.max(0, timelineDayOffset(range.startDate, startDay, dayWidth))
    : 0;
  const right = range
    ? timelineDayOffset(range.endDate, startDay, dayWidth)
    : left;
  const barWidth = Math.max(dayWidth, right - left + dayWidth);
  const previewDate = draft
    ? draft.edge === "start"
      ? draft.range.plannedStartDate
      : draft.range.internalDueDate
    : null;

  function claimHandleIntent(edge: TimelineResizeEdge) {
    setTaskTooltipOpen(false);
    setHandleIntent(edge);
  }

  function releaseHandleIntent(edge: TimelineResizeEdge) {
    setHandleIntent((current) => (current === edge ? null : current));
  }

  function beginSession(
    edge: TimelineResizeEdge,
    kind: "pointer" | "keyboard",
    initialPointerClientX = 0,
  ) {
    if (!canStartResize || !dateResizeRef.current) return null;
    const currentTask = taskRef.current;
    const originalRange = {
      plannedStartDate: currentTask.plannedStartDate,
      internalDueDate: currentTask.internalDueDate,
    };
    const session = {
      edge,
      kind,
      task: currentTask,
      originalRange,
      initialPointerClientX,
      latestPointerClientX: initialPointerClientX,
      initialScrollLeft:
        dateResizeRef.current.scrollRegionRef.current?.scrollLeft ?? 0,
      frozenDayWidth: dayWidthRef.current,
      keyboardDeltaDays: 0,
    };
    sessionRef.current = session;
    const initialDraft = { edge, range: originalRange };
    draftRef.current = initialDraft;
    setDraft(initialDraft);
    dateResizeRef.current.onSessionChange(true);
    return session;
  }

  function updateDraft(
    session: NonNullable<typeof sessionRef.current>,
    deltaDays: number,
  ) {
    const nextRange = resizeTimelineTaskDates({
      ...session.originalRange,
      edge: session.edge,
      deltaDays,
      projectStartDate:
        dateResizeRef.current?.projectStartDate ??
        session.originalRange.plannedStartDate ??
        session.originalRange.internalDueDate!,
    });
    const nextDraft = { edge: session.edge, range: nextRange };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    const provisionalDate =
      session.edge === "start"
        ? nextRange.plannedStartDate
        : nextRange.internalDueDate;
    if (provisionalDate) {
      dateResizeRef.current?.onRequestHorizon(provisionalDate);
    }
  }

  function finishSession() {
    sessionRef.current = null;
    draftRef.current = null;
    setDraft(null);
    dateResizeRef.current?.onSessionChange(false);
  }

  function updatePointerDraft(
    session: NonNullable<typeof sessionRef.current>,
    pointerClientX: number,
  ) {
    const resize = dateResizeRef.current;
    if (session.kind !== "pointer" || !resize) return;
    session.latestPointerClientX = pointerClientX;
    updateDraft(
      session,
      timelineResizeDeltaDays({
        pointerClientX,
        initialPointerClientX: session.initialPointerClientX,
        scrollLeft: resize.scrollRegionRef.current?.scrollLeft ?? 0,
        initialScrollLeft: session.initialScrollLeft,
        frozenDayWidth: session.frozenDayWidth,
      }),
    );
  }

  function cancelSession() {
    if (!sessionRef.current) return;
    finishSession();
  }

  async function commitSession() {
    const session = sessionRef.current;
    const currentDraft = draftRef.current;
    if (!session || !currentDraft) return;
    const changed =
      currentDraft.range.plannedStartDate !==
        session.originalRange.plannedStartDate ||
      currentDraft.range.internalDueDate !==
        session.originalRange.internalDueDate;
    if (changed) {
      await dateResizeRef.current?.onDateRangeChange(
        session.task,
        currentDraft.range,
      );
    }
    finishSession();
  }

  function handleResizeKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    edge: TimelineResizeEdge,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelSession();
      return;
    }
    if (event.key === "Enter" && sessionRef.current?.kind === "keyboard") {
      event.preventDefault();
      void commitSession();
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    event.stopPropagation();
    const current =
      sessionRef.current?.kind === "keyboard" &&
      sessionRef.current.edge === edge
        ? sessionRef.current
        : beginSession(edge, "keyboard");
    if (!current) return;
    current.keyboardDeltaDays +=
      (event.key === "ArrowRight" ? 1 : -1) * (event.shiftKey ? 7 : 1);
    updateDraft(current, current.keyboardDeltaDays);
  }

  useEffect(() => {
    const bar = barRef.current;
    const startHandle = startHandleRef.current;
    const endHandle = endHandleRef.current;
    if (!canStartResize || !bar || !startHandle || !endHandle) return;
    let disposed = false;
    let unset: (() => void) | undefined;
    const scrollRegion = dateResizeRef.current?.scrollRegionRef.current;
    const updateFromScroll = () => {
      const session = sessionRef.current;
      if (session?.kind === "pointer") {
        updatePointerDraft(session, session.latestPointerClientX);
      }
    };
    scrollRegion?.addEventListener("scroll", updateFromScroll);
    void import("interactjs").then(({ default: interact }) => {
      if (disposed) return;
      const interactable = interact(bar);
      interactable.resizable({
        edges: {
          left: '[data-task-resize-edge="start"]',
          right: '[data-task-resize-edge="end"]',
        },
        axis: "x",
        autoScroll: {
          container:
            dateResizeRef.current?.scrollRegionRef.current ?? undefined,
          margin: 96,
          speed: 560,
        },
        listeners: {
          start(event) {
            beginSession(
              event.edges?.left ? "start" : "end",
              "pointer",
              event.clientX,
            );
          },
          move(event) {
            const session = sessionRef.current;
            if (!session) return;
            updatePointerDraft(session, event.clientX);
          },
          end() {
            void commitSession();
          },
        },
      });
      unset = () => interactable.unset();
    });
    return () => {
      disposed = true;
      scrollRegion?.removeEventListener("scroll", updateFromScroll);
      unset?.();
    };
  }, [canStartResize, task.id]);

  useEffect(() => {
    function cancelWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && sessionRef.current?.kind === "pointer") {
        event.preventDefault();
        cancelSession();
      }
    }
    window.addEventListener("keydown", cancelWithEscape);
    return () => window.removeEventListener("keydown", cancelWithEscape);
  }, []);

  useEffect(() => {
    const session = sessionRef.current;
    if (session && Math.abs(session.frozenDayWidth - dayWidth) > 0.01) {
      cancelSession();
    }
  }, [dayWidth]);

  return (
    <div
      data-timeline-track-row={`task-${task.id}`}
      data-task-status={task.status}
      data-highlighted={highlighted ? "true" : undefined}
      className={cn(
        "border-border/55 relative h-14 border-b transition-colors",
        highlighted && "bg-primary/5",
      )}
      style={{ width: trackWidth }}
      onPointerEnter={() => onHighlightChange?.(true)}
      onPointerLeave={() => onHighlightChange?.(false)}
      onFocusCapture={() => onHighlightChange?.(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onHighlightChange?.(false);
        }
      }}
    >
      <div className="absolute inset-0 flex">
        {days.map((day) => (
          <span
            key={day.date}
            data-today={today && day.date === today ? "true" : undefined}
            data-weekend={day.isWeekend ? "true" : undefined}
            className={cn(
              "border-border/55 shrink-0 border-r",
              day.isWeekend && "bg-muted/70",
              today &&
                day.date === today &&
                "border-primary/35 bg-primary/10 ring-primary/20 ring-1 ring-inset",
              highlighted && "bg-primary/5",
              previewDate === day.date &&
                "bg-primary/15 ring-primary/30 ring-1 ring-inset",
            )}
            style={{ width: dayWidth }}
          />
        ))}
      </div>
      <span
        aria-hidden="true"
        className="bg-danger/55 absolute top-0 bottom-0 z-10 w-px"
        style={{ left: endDatePosition }}
      />
      {eventMarkers.map((marker) => (
        <span
          key={marker.id}
          aria-hidden="true"
          className="border-primary/45 absolute top-0 bottom-0 z-10 w-px border-l border-dashed"
          style={{ left: marker.position }}
        />
      ))}

      {range ? (
        <div
          ref={barRef}
          data-task-resize-target
          data-resize-active={draft ? "true" : undefined}
          className={cn(
            "absolute top-1/2 z-20 h-11 min-w-8 -translate-y-1/2 rounded-md md:h-7",
            draft &&
              "ring-primary/50 ring-offset-background ring-2 ring-offset-1",
          )}
          style={{ left, width: barWidth }}
        >
          <Tooltip
            open={taskTooltipOpen && handleIntent === null && draft === null}
            onOpenChange={setTaskTooltipOpen}
          >
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`Abrir tarea ${task.title} desde el cronograma`}
                className={cn(
                  "ring-offset-background focus-visible:ring-ring h-full w-full rounded-md px-3 text-left text-[0.7rem] font-semibold shadow-sm ring-offset-2 outline-none focus-visible:ring-2",
                  taskBarClasses[task.status],
                  highlighted && "ring-background/70 ring-2",
                )}
                onClick={(event) =>
                  openTaskFrom(
                    event.currentTarget,
                    task,
                    taskOpenerRef,
                    onOpenTask,
                  )
                }
              >
                <span className="block truncate">{task.title}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              sideOffset={6}
              className="max-w-64 space-y-0.5"
            >
              <p className="font-semibold">{task.title}</p>
              <p>Etapa: {stageName}</p>
              <p>Estado: {projectTaskStatusLabel(task.status)}</p>
              <p>{tooltipDateCopy(task)}</p>
            </TooltipContent>
          </Tooltip>
          {showResizeHandles ? (
            <>
              {(["start", "end"] as const).map((edge) => {
                const isStart = edge === "start";
                const isActive = draft?.edge === edge;
                const label = isStart
                  ? `Cambiar inicio de ${task.title}`
                  : `Cambiar fecha límite de ${task.title}`;
                return (
                  <Tooltip key={edge} open={isActive || handleIntent === edge}>
                    <TooltipTrigger asChild>
                      <button
                        ref={isStart ? startHandleRef : endHandleRef}
                        type="button"
                        aria-label={label}
                        aria-description={
                          isStart
                            ? `Inicio actual: ${formatProjectCalendarDate(task.plannedStartDate ?? task.internalDueDate!)}`
                            : `Fecha límite actual: ${formatProjectCalendarDate(task.internalDueDate ?? task.plannedStartDate!)}`
                        }
                        data-task-resize-edge={edge}
                        data-active={isActive ? "true" : undefined}
                        className={cn(
                          "group ring-offset-background focus-visible:ring-ring absolute top-1/2 z-30 h-11 w-6 -translate-y-1/2 cursor-ew-resize rounded-sm outline-none focus-visible:ring-2",
                          isStart ? "-translate-x-3/4" : "-translate-x-1/4",
                          isActive && "ring-primary bg-background/40 ring-2",
                        )}
                        style={{
                          left: isStart ? 0 : "100%",
                          touchAction: "none",
                          userSelect: "none",
                          WebkitUserSelect: "none",
                        }}
                        onPointerEnter={() => claimHandleIntent(edge)}
                        onPointerLeave={() => releaseHandleIntent(edge)}
                        onPointerDown={() => claimHandleIntent(edge)}
                        onFocus={() => claimHandleIntent(edge)}
                        onKeyDown={(event) => handleResizeKeyDown(event, edge)}
                        onClick={(event) => event.stopPropagation()}
                        onBlur={() => {
                          releaseHandleIntent(edge);
                          if (sessionRef.current?.kind === "keyboard") {
                            cancelSession();
                          }
                        }}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "bg-background/75 group-hover:bg-primary group-focus-visible:bg-primary absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-sm transition-[width,height,background-color]",
                            isActive && "bg-primary h-6 w-1.5",
                          )}
                          style={{ left: isStart ? "75%" : "25%" }}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={6}>
                      {draft?.edge === edge && previewDate
                        ? `${isStart ? "Inicio" : "Fecha límite"}: ${formatProjectCalendarDate(previewDate)}`
                        : label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </>
          ) : null}
        </div>
      ) : (
        <span className="sr-only">Sin fechas</span>
      )}
    </div>
  );
}

export function ProjectTaskTimelineTaskRow(props: TimelineTaskTrackProps) {
  const gridStyle = {
    gridTemplateColumns: `${TIMELINE_LABEL_WIDTH}px ${props.trackWidth}px`,
  };

  return (
    <div
      data-testid="timeline-task-row"
      className="border-border/55 grid border-b last:border-b-0"
      style={gridStyle}
    >
      <ProjectTaskTimelineTaskLabel {...props} sticky />
      <ProjectTaskTimelineTaskTrack {...props} />
    </div>
  );
}
