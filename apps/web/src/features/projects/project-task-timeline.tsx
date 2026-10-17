import {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { ChevronRight } from "lucide-react";
import type { LayoutChangedMeta, PanelSize } from "react-resizable-panels";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  ProjectTaskScheduleResponse,
  ProjectTaskScheduleStage,
  ProjectTaskScheduleTask,
  ProjectTaskStatus,
  ProjectStatus,
} from "@/lib/api/generated/models";
import { cn } from "@/lib/utils";
import { formatProjectCalendarDate } from "./project-presentation";
import { ProjectDeadlineStatus } from "./project-deadline-status";
import {
  buildTimelineCalendar,
  calendarDateInTimeZone,
  initialTimelineScrollLeft,
  TIMELINE_LABEL_WIDTH,
  timelineDayOffset,
  timelineTaskRange,
} from "./project-task-timeline-calendar";
import {
  ProjectTaskTimelineTaskLabel,
  ProjectTaskTimelineTaskRow,
  ProjectTaskTimelineTaskTrack,
} from "./project-task-timeline-task-row";
import {
  nextTimelineResizeHorizon,
  TIMELINE_RESIZE_HORIZON_DAYS,
  type TimelineTaskDateRange,
} from "./project-task-timeline-resize";
import {
  MAX_STAGE_WIDTH_PX,
  MIN_STAGE_WIDTH_PX,
  readTimelineStageWidth,
  useDesktopTimelineLayout,
  writeTimelineStageWidth,
} from "./project-task-timeline-layout";
import {
  deriveProjectStageStatus,
  projectStageStatusLabels,
  type ProjectStageStatus,
} from "./project-stage-status";
import {
  ProjectStageStatusIndicator,
  projectStageStatusBarClass,
} from "./project-stage-status-indicator";
import { useTimelineZoom } from "./project-task-timeline-zoom";
import { TimelineZoomControls } from "./project-task-timeline-zoom-controls";

const emptyUpdatingTaskIds = new Set<string>();
const ignoreOpenTask = () => undefined;
const ignoreStatusChange = () => undefined;
const ignoreDateRangeChange = async () => false;
const weekdayFormatter = new Intl.DateTimeFormat("es-PE", {
  weekday: "short",
  timeZone: "UTC",
});
const dayMonthFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const fullDateFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "full",
  timeZone: "UTC",
});

function calendarDate(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

type TimelineBarProps = {
  stage: ProjectTaskScheduleStage;
  left: number;
  width: number;
  status: ProjectStageStatus;
  mode: "expanded" | "collapsed";
  open: boolean;
  onOpenChange(open: boolean): void;
};

function TimelineBar({
  stage,
  left,
  width,
  status,
  mode,
  open,
  onOpenChange,
}: TimelineBarProps) {
  return (
    <Tooltip open={open} onOpenChange={onOpenChange}>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-stage-summary="true"
          data-stage-summary-mode={mode}
          aria-label={`Ver fechas de la etapa ${stage.name}`}
          className="ring-offset-background focus-visible:ring-ring absolute top-1/2 z-20 h-11 min-w-11 -translate-y-1/2 rounded-full ring-offset-2 outline-none focus-visible:ring-2"
          style={{ left, width }}
          onClick={() => onOpenChange(!open)}
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full",
              mode === "expanded" ? "h-0.5 opacity-75" : "h-1.5 shadow-sm",
              projectStageStatusBarClass(status),
            )}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        sideOffset={6}
        className="max-w-64 space-y-0.5"
      >
        <p className="font-semibold">{stage.name}</p>
        <p>
          Del {formatProjectCalendarDate(stage.startDate!)} al{" "}
          {formatProjectCalendarDate(stage.endDate!)}
        </p>
        <p>Estado de etapa: {projectStageStatusLabels[status]}</p>
        <p>
          {stage.scheduledTaskCount === 1
            ? "1 tarea con fecha"
            : `${stage.scheduledTaskCount} tareas con fecha`}
        </p>
        {stage.usesProjectStartFallback ? (
          <p className="border-background/20 mt-1 border-t pt-1">
            Inicio del proyecto usado como referencia
          </p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

type TimelineDay = ReturnType<typeof buildTimelineCalendar>["days"][number];

function TimelineCalendarHeader({
  days,
  today,
  todayIsVisible,
  dayWidth,
  trackWidth,
}: {
  days: TimelineDay[];
  today: string;
  todayIsVisible: boolean;
  dayWidth: number;
  trackWidth: number;
}) {
  return (
    <div
      className="border-border flex h-16 border-b"
      style={{ width: trackWidth }}
    >
      {days.map((day) => {
        const date = calendarDate(day.date);
        const isToday = todayIsVisible && day.date === today;
        return (
          <div
            key={day.date}
            aria-label={fullDateFormatter.format(date)}
            aria-current={isToday ? "date" : undefined}
            data-today={isToday ? "true" : undefined}
            data-weekend={day.isWeekend ? "true" : undefined}
            className={cn(
              "border-border/70 text-muted-foreground flex shrink-0 flex-col items-center justify-end border-r px-1 py-3 text-center",
              day.isWeekend && "bg-muted/70",
              isToday &&
                "border-primary/40 bg-primary/10 ring-primary/30 text-primary ring-1 ring-inset",
            )}
            style={{ width: dayWidth }}
          >
            {isToday ? (
              <span className="text-[0.65rem] font-bold tracking-[0.08em] uppercase">
                Hoy
              </span>
            ) : (
              <span className="text-[0.65rem] font-semibold tracking-[0.08em] uppercase">
                {weekdayFormatter.format(date).replace(".", "")}
              </span>
            )}
            <span className="text-foreground mt-1 text-xs font-semibold">
              {dayMonthFormatter.format(date).replace(".", "")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TimelineStageLabel({
  stage,
  status,
  expanded,
  taskGroupId,
  onToggle,
}: {
  stage: ProjectTaskScheduleStage;
  status: ProjectStageStatus;
  expanded: boolean;
  taskGroupId: string;
  onToggle(): void;
}) {
  return (
    <div
      data-testid="timeline-stage-row"
      data-timeline-stage-label={stage.id}
      data-stage-status={status}
      className="border-border/70 bg-muted/20 flex h-12 min-w-0 items-center border-t border-b px-3"
    >
      <div className="flex min-w-0 items-center gap-2">
        {stage.tasks.length > 0 ? (
          <button
            type="button"
            aria-label={`${expanded ? "Contraer" : "Expandir"} etapa ${stage.name}`}
            aria-expanded={expanded}
            aria-controls={taskGroupId}
            className="hover:bg-muted focus-visible:ring-ring rounded-control inline-flex size-11 shrink-0 items-center justify-center outline-none focus-visible:ring-2 lg:size-8"
            onClick={onToggle}
          >
            <ChevronRight
              aria-hidden="true"
              className={cn(
                "size-4 transition-transform",
                expanded && "rotate-90",
              )}
            />
          </button>
        ) : (
          <span aria-hidden="true" className="w-4 shrink-0" />
        )}
        <ProjectStageStatusIndicator status={status} display="icon" />
        <p className="truncate text-sm font-semibold">{stage.name}</p>
        <span
          aria-label={`${stage.tasks.length} ${stage.tasks.length === 1 ? "tarea" : "tareas"}`}
          className="border-border bg-card text-muted-foreground inline-flex min-w-5 shrink-0 items-center justify-center rounded-md border px-1.5 py-0.5 text-[0.68rem] font-semibold tabular-nums"
        >
          {stage.tasks.length}
        </span>
      </div>
    </div>
  );
}

function TimelineStageTrack({
  stage,
  days,
  today,
  todayIsVisible,
  startDay,
  dayWidth,
  trackWidth,
  endDatePosition,
  eventMarkers,
  status,
  expanded,
  open,
  onOpenChange,
}: {
  stage: ProjectTaskScheduleStage;
  days: TimelineDay[];
  today: string;
  todayIsVisible: boolean;
  startDay: number;
  dayWidth: number;
  trackWidth: number;
  endDatePosition: number;
  eventMarkers: Array<{ id: string; position: number }>;
  status: ProjectStageStatus;
  expanded: boolean;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const hasRange = Boolean(stage.startDate && stage.endDate);
  const left = stage.startDate
    ? Math.max(0, timelineDayOffset(stage.startDate, startDay, dayWidth))
    : 0;
  const right = stage.endDate
    ? timelineDayOffset(stage.endDate, startDay, dayWidth)
    : left;

  return (
    <div
      data-testid="timeline-stage-track"
      data-timeline-stage-track={stage.id}
      data-stage-status={status}
      className="border-border/70 bg-muted/20 relative h-12 border-t border-b"
      style={{ width: trackWidth }}
    >
      <div className="absolute inset-0 flex">
        {days.map((day) => (
          <span
            key={day.date}
            data-today={
              todayIsVisible && day.date === today ? "true" : undefined
            }
            data-weekend={day.isWeekend ? "true" : undefined}
            className={cn(
              "border-border/55 shrink-0 border-r",
              day.isWeekend && "bg-muted/70",
              todayIsVisible &&
                day.date === today &&
                "border-primary/35 bg-primary/10 ring-primary/20 ring-1 ring-inset",
            )}
            style={{ width: dayWidth }}
          />
        ))}
      </div>
      <span
        data-testid="project-end-marker"
        aria-hidden="true"
        className="bg-danger/55 absolute top-0 bottom-0 z-10 w-px"
        style={{ left: endDatePosition }}
      />
      {eventMarkers.map((marker) => (
        <span
          key={marker.id}
          data-testid="project-event-marker"
          aria-hidden="true"
          className="border-primary/45 absolute top-0 bottom-0 z-10 w-px border-l border-dashed"
          style={{ left: marker.position }}
        />
      ))}
      {hasRange ? (
        <TimelineBar
          stage={stage}
          left={left}
          width={Math.max(dayWidth, right - left + dayWidth)}
          status={status}
          mode={expanded ? "expanded" : "collapsed"}
          open={open}
          onOpenChange={onOpenChange}
        />
      ) : !expanded ? (
        <span className="text-muted-foreground absolute inset-y-0 left-3 flex items-center text-xs font-medium">
          Sin rango completo
        </span>
      ) : null}
    </div>
  );
}

export function ProjectTaskTimeline({
  schedule,
  projectStatus,
  now = new Date(),
  taskOpenerRef,
  updatingTaskIds = emptyUpdatingTaskIds,
  readOnly = false,
  onOpenTask = ignoreOpenTask,
  onStatusChange = ignoreStatusChange,
  onDateRangeChange = ignoreDateRangeChange,
}: {
  schedule: ProjectTaskScheduleResponse;
  projectStatus: ProjectStatus;
  now?: Date;
  taskOpenerRef?: RefObject<HTMLElement | null>;
  updatingTaskIds?: ReadonlySet<string>;
  readOnly?: boolean;
  onOpenTask?(task: ProjectTaskScheduleTask): void;
  onStatusChange?(
    task: ProjectTaskScheduleTask,
    status: ProjectTaskStatus,
  ): void;
  onDateRangeChange?(
    task: ProjectTaskScheduleTask,
    range: TimelineTaskDateRange,
  ): Promise<boolean>;
}) {
  const desktopLayout = useDesktopTimelineLayout();
  const [openStageId, setOpenStageId] = useState<string | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(
    null,
  );
  const [activeResizeTaskId, setActiveResizeTaskId] = useState<string | null>(
    null,
  );
  const [resizeExtraEndDays, setResizeExtraEndDays] = useState(0);
  const [collapsedStageIds, setCollapsedStageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  const [initialStageWidth] = useState(readTimelineStageWidth);
  const resizedStageWidthRef = useRef(initialStageWidth);
  const baseCalendar = buildTimelineCalendar(schedule);
  const timelineZoom = useTimelineZoom({
    dayCount: baseCalendar.days.length,
    scrollRegionRef,
    viewportInset: desktopLayout ? 0 : TIMELINE_LABEL_WIDTH,
    layoutKey: desktopLayout,
  });
  const dayWidth = timelineZoom.dayWidth;
  const calendar = buildTimelineCalendar(schedule, {
    extraEndDays: resizeExtraEndDays,
  });
  const today = calendarDateInTimeZone(now, schedule.project.timeZone);
  const todayIsVisible =
    today >= schedule.project.startDate && today <= calendar.endDate;
  const trackWidth = calendar.days.length * dayWidth;
  const endDatePosition =
    timelineDayOffset(schedule.project.endDate, calendar.startDay, dayWidth) +
    dayWidth / 2;
  const eventMarkers = schedule.events.map((event) => ({
    id: event.id,
    position:
      timelineDayOffset(event.date, calendar.startDay, dayWidth) + dayWidth / 2,
  }));
  const gridStyle = {
    gridTemplateColumns: `${TIMELINE_LABEL_WIDTH}px ${trackWidth}px`,
  };
  const desktopStages = schedule.stages.map((stage) => ({
    stage,
    expanded: stage.tasks.length > 0 && !collapsedStageIds.has(stage.id),
    taskGroupId: `desktop-timeline-stage-tasks-${stage.id}`,
    datedTasks: stage.tasks.filter((task) => Boolean(timelineTaskRange(task))),
    undatedTasks: stage.tasks.filter((task) => !timelineTaskRange(task)),
    status: deriveProjectStageStatus(stage.taskStatusCounts),
  }));

  useLayoutEffect(() => {
    const scrollRegion = scrollRegionRef.current;
    if (!scrollRegion) return;

    scrollRegion.scrollLeft = initialTimelineScrollLeft({
      today,
      startDate: schedule.project.startDate,
      endDate: baseCalendar.endDate,
      viewportWidth: scrollRegion.clientWidth,
      contentWidth: scrollRegion.scrollWidth,
      labelWidth: desktopLayout ? 0 : TIMELINE_LABEL_WIDTH,
      dayWidth,
    });
  }, [baseCalendar.endDate, desktopLayout, schedule.project.startDate, today]);

  function toggleStage(stageId: string) {
    setOpenStageId(null);
    setCollapsedStageIds((current) => {
      const next = new Set(current);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }

  function rememberStageWidth(size: PanelSize) {
    resizedStageWidthRef.current = size.inPixels;
  }

  function persistStageWidth(
    _layout: Record<string, number>,
    meta: LayoutChangedMeta,
  ) {
    if (meta.isUserInteraction) {
      writeTimelineStageWidth(resizedStageWidthRef.current);
    }
  }

  function timelineTaskProps(task: ProjectTaskScheduleTask, stageName: string) {
    return {
      task,
      stageName,
      highlighted: highlightedTaskId === task.id,
      days: calendar.days,
      startDay: calendar.startDay,
      dayWidth,
      trackWidth,
      today: todayIsVisible ? today : undefined,
      endDatePosition,
      eventMarkers,
      updating: updatingTaskIds.has(task.id),
      readOnly,
      taskOpenerRef,
      onOpenTask,
      onStatusChange,
      dateResize:
        desktopLayout &&
        !readOnly &&
        (activeResizeTaskId === null || activeResizeTaskId === task.id)
          ? {
              projectStartDate: schedule.project.startDate,
              scrollRegionRef,
              onSessionChange: (active: boolean) => {
                setActiveResizeTaskId(active ? task.id : null);
                setResizeExtraEndDays(
                  active ? TIMELINE_RESIZE_HORIZON_DAYS : 0,
                );
              },
              onRequestHorizon: (provisionalDate: string) => {
                const provisionalDayIndex = timelineDayOffset(
                  provisionalDate,
                  baseCalendar.startDay,
                  1,
                );
                setResizeExtraEndDays((current) =>
                  nextTimelineResizeHorizon({
                    baseDayCount: baseCalendar.days.length,
                    extraEndDays: current,
                    provisionalDayIndex,
                  }),
                );
              },
              onDateRangeChange,
            }
          : undefined,
      onHighlightChange: (highlighted: boolean) => {
        setHighlightedTaskId((current) => {
          if (highlighted) return task.id;
          return current === task.id ? null : current;
        });
      },
    };
  }

  return (
    <TooltipProvider disableHoverableContent>
      <section
        aria-labelledby="project-timeline-title"
        className="rounded-card border-border bg-card shadow-panel mb-5 overflow-hidden border"
      >
        <div className="border-border grid min-w-0 gap-4 border-b px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:px-6">
          <div>
            <h2
              id="project-timeline-title"
              className="font-display text-lg font-semibold"
            >
              Cronograma
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Etapas calculadas desde las fechas planificadas de las tareas.
            </p>
          </div>
          <div
            role="group"
            aria-label="Fechas del proyecto"
            className="text-muted-foreground grid gap-2 text-xs sm:justify-items-end"
          >
            <div className="flex items-center gap-2">
              <span
                data-testid="project-end-legend"
                aria-hidden="true"
                className="bg-danger h-px w-6 shrink-0"
              />
              <ProjectDeadlineStatus
                date={schedule.project.endDate}
                projectStatus={projectStatus}
                today={today}
                variant="inline"
              />
            </div>
            {schedule.events.map((event) => (
              <div key={event.id} className="flex items-center gap-2">
                <span
                  data-testid="project-event-legend"
                  aria-hidden="true"
                  className="border-primary/45 w-6 shrink-0 border-t border-dashed"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      aria-label={`Evento legal: ${event.title}, ${formatProjectCalendarDate(event.date)}`}
                      className="bg-primary-soft text-primary-strong focus-visible:ring-ring rounded-control px-2.5 py-1.5 font-semibold outline-none focus-visible:ring-2"
                    >
                      {event.title} · {formatProjectCalendarDate(event.date)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Evento legal · {event.title} ·{" "}
                    {formatProjectCalendarDate(event.date)}
                  </TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
        </div>

        <div
          role="toolbar"
          aria-label="Controles del cronograma"
          className="border-border bg-muted/15 flex min-h-14 items-center justify-end border-b px-5 py-1 sm:min-h-11 sm:px-6"
        >
          <TimelineZoomControls
            preference={timelineZoom.preference}
            canZoomIn={timelineZoom.canZoomIn}
            canZoomOut={timelineZoom.canZoomOut}
            disabled={activeResizeTaskId !== null}
            onZoomIn={timelineZoom.zoomIn}
            onZoomOut={timelineZoom.zoomOut}
            onFit={timelineZoom.fit}
          />
        </div>

        {desktopLayout && schedule.stages.length > 0 ? (
          <ResizablePanelGroup
            orientation="horizontal"
            className="min-w-0"
            onLayoutChanged={persistStageWidth}
          >
            <ResizablePanel
              id="timeline-stage-labels"
              defaultSize={initialStageWidth}
              minSize={MIN_STAGE_WIDTH_PX}
              maxSize={MAX_STAGE_WIDTH_PX}
              groupResizeBehavior="preserve-pixel-size"
              onResize={rememberStageWidth}
            >
              <div
                role="region"
                aria-label="Etapas del cronograma"
                className="min-w-0 overflow-hidden"
              >
                <div className="border-border text-muted-foreground flex h-16 items-end border-b px-4 py-3 text-[0.7rem] font-semibold tracking-[0.12em] uppercase">
                  Etapa
                </div>
                {desktopStages.map(
                  ({
                    stage,
                    expanded,
                    taskGroupId,
                    datedTasks,
                    undatedTasks,
                    status,
                  }) => {
                    return (
                      <Fragment key={stage.id}>
                        <TimelineStageLabel
                          stage={stage}
                          status={status}
                          expanded={expanded}
                          taskGroupId={taskGroupId}
                          onToggle={() => toggleStage(stage.id)}
                        />
                        {expanded ? (
                          <div
                            id={taskGroupId}
                            role="group"
                            aria-label={`Tareas de ${stage.name}`}
                          >
                            {datedTasks.map((task) => (
                              <ProjectTaskTimelineTaskLabel
                                key={task.id}
                                {...timelineTaskProps(task, stage.name)}
                              />
                            ))}
                            {undatedTasks.length > 0 ? (
                              <div
                                role="group"
                                aria-label={`Tareas sin fechas de ${stage.name}`}
                              >
                                <div className="border-border/55 bg-muted/25 text-muted-foreground flex h-8 items-center border-b px-9 text-[0.68rem] font-semibold tracking-[0.08em] uppercase">
                                  Sin fechas
                                </div>
                                {undatedTasks.map((task) => (
                                  <ProjectTaskTimelineTaskLabel
                                    key={task.id}
                                    {...timelineTaskProps(task, stage.name)}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </Fragment>
                    );
                  },
                )}
              </div>
            </ResizablePanel>
            <ResizableHandle
              withHandle
              aria-label="Cambiar ancho de etapas"
              disabled={activeResizeTaskId !== null}
              className={cn(
                "bg-border hover:bg-primary/30 focus-visible:ring-primary z-40 w-2 shrink-0 transition-colors after:w-4",
                activeResizeTaskId !== null && "pointer-events-none opacity-60",
              )}
            />
            <ResizablePanel id="timeline-calendar" minSize={240}>
              <div
                ref={scrollRegionRef}
                role="region"
                aria-label="Fechas del cronograma"
                tabIndex={0}
                className="focus-visible:ring-ring min-w-0 [scrollbar-gutter:stable] overflow-x-auto overscroll-x-contain focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
              >
                <div
                  className="w-max min-w-full pb-5"
                  style={{ width: trackWidth }}
                >
                  <TimelineCalendarHeader
                    days={calendar.days}
                    today={today}
                    todayIsVisible={todayIsVisible}
                    dayWidth={dayWidth}
                    trackWidth={trackWidth}
                  />
                  {desktopStages.map(
                    ({ stage, expanded, datedTasks, undatedTasks, status }) => {
                      return (
                        <Fragment key={stage.id}>
                          <TimelineStageTrack
                            stage={stage}
                            days={calendar.days}
                            today={today}
                            todayIsVisible={todayIsVisible}
                            startDay={calendar.startDay}
                            dayWidth={dayWidth}
                            trackWidth={trackWidth}
                            endDatePosition={endDatePosition}
                            eventMarkers={eventMarkers}
                            status={status}
                            expanded={expanded}
                            open={openStageId === stage.id}
                            onOpenChange={(open) =>
                              setOpenStageId(open ? stage.id : null)
                            }
                          />
                          {expanded ? (
                            <>
                              {datedTasks.map((task) => (
                                <ProjectTaskTimelineTaskTrack
                                  key={task.id}
                                  {...timelineTaskProps(task, stage.name)}
                                />
                              ))}
                              {undatedTasks.length > 0 ? (
                                <>
                                  <div
                                    className="border-border/55 bg-muted/25 h-8 border-b"
                                    style={{ width: trackWidth }}
                                  />
                                  {undatedTasks.map((task) => (
                                    <ProjectTaskTimelineTaskTrack
                                      key={task.id}
                                      {...timelineTaskProps(task, stage.name)}
                                    />
                                  ))}
                                </>
                              ) : null}
                            </>
                          ) : null}
                        </Fragment>
                      );
                    },
                  )}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div
            ref={scrollRegionRef}
            role="region"
            aria-label="Cronograma desplazable"
            tabIndex={0}
            className="focus-visible:ring-ring [scrollbar-gutter:stable] overflow-x-auto overscroll-x-contain focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
          >
            {schedule.stages && schedule.stages.length > 0 ? (
              <div
                data-testid="timeline-content"
                className="w-max min-w-full pb-5"
                style={{ minWidth: TIMELINE_LABEL_WIDTH + trackWidth }}
              >
                <div className="border-border grid border-b" style={gridStyle}>
                  <div className="border-border bg-card text-muted-foreground sticky left-0 z-30 flex items-end border-r px-4 py-3 text-[0.7rem] font-semibold tracking-[0.12em] uppercase">
                    Etapa
                  </div>
                  <div className="flex" style={{ width: trackWidth }}>
                    {calendar.days.map((day) => {
                      const date = calendarDate(day.date);
                      const isToday = todayIsVisible && day.date === today;

                      return (
                        <div
                          key={day.date}
                          aria-label={fullDateFormatter.format(date)}
                          aria-current={isToday ? "date" : undefined}
                          data-today={isToday ? "true" : undefined}
                          data-weekend={day.isWeekend ? "true" : undefined}
                          className={cn(
                            "border-border/70 text-muted-foreground flex shrink-0 flex-col items-center justify-end border-r px-1 py-3 text-center",
                            day.isWeekend && "bg-muted/70",
                            isToday &&
                              "border-primary/40 bg-primary/10 ring-primary/30 text-primary ring-1 ring-inset",
                          )}
                          style={{ width: dayWidth }}
                        >
                          {isToday ? (
                            <span className="text-[0.65rem] font-bold tracking-[0.08em] uppercase">
                              Hoy
                            </span>
                          ) : (
                            <span className="text-[0.65rem] font-semibold tracking-[0.08em] uppercase">
                              {weekdayFormatter.format(date).replace(".", "")}
                            </span>
                          )}
                          <span className="text-foreground mt-1 text-xs font-semibold">
                            {dayMonthFormatter.format(date).replace(".", "")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  {schedule.stages.map((stage) => {
                    const hasRange = Boolean(stage.startDate && stage.endDate);
                    const expanded =
                      stage.tasks.length > 0 &&
                      !collapsedStageIds.has(stage.id);
                    const taskGroupId = `timeline-stage-tasks-${stage.id}`;
                    const datedTasks = stage.tasks.filter((task) =>
                      Boolean(timelineTaskRange(task)),
                    );
                    const undatedTasks = stage.tasks.filter(
                      (task) => !timelineTaskRange(task),
                    );
                    const stageStatus = deriveProjectStageStatus(
                      stage.taskStatusCounts,
                    );
                    const left = stage.startDate
                      ? Math.max(
                          0,
                          timelineDayOffset(
                            stage.startDate,
                            calendar.startDay,
                            dayWidth,
                          ),
                        )
                      : 0;
                    const right = stage.endDate
                      ? timelineDayOffset(
                          stage.endDate,
                          calendar.startDay,
                          dayWidth,
                        )
                      : left;
                    return (
                      <Fragment key={stage.id}>
                        <div
                          data-testid="timeline-stage-row"
                          data-stage-status={stageStatus}
                          className="border-border/70 grid border-t border-b last:border-b-0"
                          style={gridStyle}
                        >
                          <div
                            data-timeline-stage-label={stage.id}
                            className="border-border bg-card before:bg-muted/20 sticky left-0 z-30 flex h-14 min-w-0 items-center border-r px-3 before:pointer-events-none before:absolute before:inset-0 before:content-['']"
                          >
                            <div className="relative flex min-w-0 items-center gap-2">
                              {stage.tasks.length > 0 ? (
                                <button
                                  type="button"
                                  aria-label={`${expanded ? "Contraer" : "Expandir"} etapa ${stage.name}`}
                                  aria-expanded={expanded}
                                  aria-controls={taskGroupId}
                                  className="hover:bg-muted focus-visible:ring-ring rounded-control -m-2 inline-flex size-11 shrink-0 items-center justify-center outline-none focus-visible:ring-2 lg:-m-1 lg:size-8"
                                  onClick={() => {
                                    setOpenStageId(null);
                                    setCollapsedStageIds((current) => {
                                      const next = new Set(current);
                                      if (next.has(stage.id))
                                        next.delete(stage.id);
                                      else next.add(stage.id);
                                      return next;
                                    });
                                  }}
                                >
                                  <ChevronRight
                                    aria-hidden="true"
                                    className={cn(
                                      "size-4 transition-transform",
                                      expanded && "rotate-90",
                                    )}
                                  />
                                </button>
                              ) : (
                                <span
                                  aria-hidden="true"
                                  className="w-4 shrink-0"
                                />
                              )}
                              <ProjectStageStatusIndicator
                                status={stageStatus}
                                display="icon"
                              />
                              <p className="truncate text-sm font-semibold">
                                {stage.name}
                              </p>
                              <span
                                aria-label={`${stage.tasks.length} ${stage.tasks.length === 1 ? "tarea" : "tareas"}`}
                                className="border-border bg-card text-muted-foreground inline-flex min-w-5 shrink-0 items-center justify-center rounded-md border px-1.5 py-0.5 text-[0.68rem] font-semibold tabular-nums"
                              >
                                {stage.tasks.length}
                              </span>
                            </div>
                          </div>
                          <div
                            data-timeline-stage-track={stage.id}
                            className="bg-muted/20 relative h-14"
                            style={{ width: trackWidth }}
                          >
                            <div className="absolute inset-0 flex">
                              {calendar.days.map((day) => (
                                <span
                                  key={day.date}
                                  data-today={
                                    todayIsVisible && day.date === today
                                      ? "true"
                                      : undefined
                                  }
                                  data-weekend={
                                    day.isWeekend ? "true" : undefined
                                  }
                                  className={cn(
                                    "border-border/55 shrink-0 border-r",
                                    day.isWeekend && "bg-muted/70",
                                    todayIsVisible &&
                                      day.date === today &&
                                      "border-primary/35 bg-primary/10 ring-primary/20 ring-1 ring-inset",
                                  )}
                                  style={{ width: dayWidth }}
                                />
                              ))}
                            </div>
                            <span
                              data-testid="project-end-marker"
                              aria-hidden="true"
                              className="bg-danger/55 absolute top-0 bottom-0 z-10 w-px"
                              style={{ left: endDatePosition }}
                            />
                            {eventMarkers.map((marker) => (
                              <span
                                key={marker.id}
                                data-testid="project-event-marker"
                                aria-hidden="true"
                                className="border-primary/45 absolute top-0 bottom-0 z-10 w-px border-l border-dashed"
                                style={{ left: marker.position }}
                              />
                            ))}
                            {hasRange ? (
                              <TimelineBar
                                stage={stage}
                                left={left}
                                width={Math.max(
                                  dayWidth,
                                  right - left + dayWidth,
                                )}
                                status={stageStatus}
                                mode={expanded ? "expanded" : "collapsed"}
                                open={openStageId === stage.id}
                                onOpenChange={(open) =>
                                  setOpenStageId(open ? stage.id : null)
                                }
                              />
                            ) : !expanded ? (
                              <span className="text-muted-foreground absolute inset-y-0 left-3 flex items-center text-xs font-medium">
                                Sin rango completo
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {expanded ? (
                          <div
                            id={taskGroupId}
                            role="group"
                            aria-label={`Tareas de ${stage.name}`}
                            className="border-border/70 border-b"
                          >
                            {datedTasks.map((task) => (
                              <ProjectTaskTimelineTaskRow
                                key={task.id}
                                task={task}
                                stageName={stage.name}
                                days={calendar.days}
                                startDay={calendar.startDay}
                                dayWidth={dayWidth}
                                trackWidth={trackWidth}
                                today={todayIsVisible ? today : undefined}
                                endDatePosition={endDatePosition}
                                eventMarkers={eventMarkers}
                                updating={updatingTaskIds.has(task.id)}
                                readOnly={readOnly}
                                taskOpenerRef={taskOpenerRef}
                                onOpenTask={onOpenTask}
                                onStatusChange={onStatusChange}
                              />
                            ))}
                            {undatedTasks.length > 0 ? (
                              <div
                                role="group"
                                aria-label={`Tareas sin fechas de ${stage.name}`}
                              >
                                <div
                                  className="border-border/55 bg-muted/25 grid border-b"
                                  style={gridStyle}
                                >
                                  <div className="border-border bg-card text-muted-foreground sticky left-0 z-30 border-r px-9 py-2 text-[0.68rem] font-semibold tracking-[0.08em] uppercase">
                                    Sin fechas
                                  </div>
                                  <div style={{ width: trackWidth }} />
                                </div>
                                {undatedTasks.map((task) => (
                                  <ProjectTaskTimelineTaskRow
                                    key={task.id}
                                    task={task}
                                    stageName={stage.name}
                                    days={calendar.days}
                                    startDay={calendar.startDay}
                                    dayWidth={dayWidth}
                                    trackWidth={trackWidth}
                                    today={todayIsVisible ? today : undefined}
                                    endDatePosition={endDatePosition}
                                    eventMarkers={eventMarkers}
                                    updating={updatingTaskIds.has(task.id)}
                                    readOnly={readOnly}
                                    taskOpenerRef={taskOpenerRef}
                                    onOpenTask={onOpenTask}
                                    onStatusChange={onStatusChange}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="px-4 py-5 sm:px-6">
                <p className="text-muted-foreground text-sm">
                  Este proyecto todavía no tiene etapas.
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </TooltipProvider>
  );
}
