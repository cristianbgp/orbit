import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectTaskTimeline } from "@/features/projects/project-task-timeline";
import type { ProjectTaskScheduleResponse } from "@/lib/api/generated/models";

const schedule: ProjectTaskScheduleResponse = {
  project: {
    startDate: "2026-08-06",
    endDate: "2026-08-20",
    timeZone: "America/Lima",
  },
  events: [
    {
      id: "event-1",
      title: "Audiencia de vista",
      type: "legal",
      date: "2026-08-24",
    },
  ],
  stages: [
    {
      id: "stage-1",
      name: "Investigación",
      position: 0,
      startDate: "2026-08-06",
      endDate: "2026-08-12",
      scheduledTaskCount: 2,
      taskStatusCounts: {
        pending: 2,
        inProgress: 1,
        blocked: 0,
        completed: 0,
      },
      tasks: [
        {
          id: "task-1",
          title: "Revisar antecedentes",
          status: "pending",
          plannedStartDate: "2026-08-06",
          internalDueDate: "2026-08-12",
          position: 0,
        },
        {
          id: "task-2",
          title: "Buscar jurisprudencia",
          status: "in_progress",
          plannedStartDate: "2026-08-10",
          internalDueDate: null,
          position: 1,
        },
        {
          id: "task-3",
          title: "Coordinar anexos",
          status: "pending",
          plannedStartDate: null,
          internalDueDate: null,
          position: 2,
        },
      ],
      usesProjectStartFallback: true,
    },
    {
      id: "stage-2",
      name: "Informe",
      position: 1,
      startDate: "2026-08-11",
      endDate: "2026-08-28",
      scheduledTaskCount: 1,
      taskStatusCounts: {
        pending: 0,
        inProgress: 0,
        blocked: 0,
        completed: 1,
      },
      tasks: [
        {
          id: "task-4",
          title: "Preparar informe",
          status: "completed",
          plannedStartDate: "2026-08-11",
          internalDueDate: "2026-08-28",
          position: 0,
        },
      ],
      usesProjectStartFallback: false,
    },
    {
      id: "stage-3",
      name: "Cierre",
      position: 2,
      startDate: null,
      endDate: null,
      scheduledTaskCount: 0,
      taskStatusCounts: {
        pending: 0,
        inProgress: 0,
        blocked: 0,
        completed: 0,
      },
      tasks: [],
      usesProjectStartFallback: false,
    },
  ],
};

describe("ProjectTaskTimeline", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      "PointerEvent",
      class PointerEvent extends MouseEvent {
        pointerType: string;

        constructor(type: string, init: PointerEventInit = {}) {
          super(type, init);
          this.pointerType = init.pointerType ?? "";
        }
      },
    );
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function useDesktopViewport() {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(min-width: 768px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  }

  function mockScrollDimensions() {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(640);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(
      2_000,
    );
  }

  test("shows every day through tasks scheduled beyond the project end", async () => {
    render(
      <ProjectTaskTimeline
        projectStatus="active"
        schedule={schedule}
        now={new Date("2026-08-20T17:00:00.000Z")}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Cronograma desplazable" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("jueves, 6 de agosto de 2026"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("viernes, 28 de agosto de 2026"),
    ).toBeInTheDocument();
    const deadlineSummary = screen.getByRole("group", {
      name: "Fechas del proyecto",
    });
    expect(
      within(deadlineSummary).getByRole("group", {
        name: "Fecha final: 20 ago 2026, Finaliza hoy",
      }),
    ).toBeVisible();
    expect(within(deadlineSummary).getByText("Finaliza hoy")).toBeVisible();
    expect(
      within(deadlineSummary).getByText(/Audiencia de vista.*24 ago 2026/),
    ).toBeVisible();
    const eventMarker = within(deadlineSummary).getByLabelText(
      "Evento legal: Audiencia de vista, 24 ago 2026",
    );
    fireEvent.focus(eventMarker);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Evento legal · Audiencia de vista · 24 ago 2026",
    );
    expect(screen.getAllByText("Fecha final")).toHaveLength(1);
    expect(screen.getAllByTestId("timeline-stage-row")).toHaveLength(3);
    expect(screen.getAllByTestId("project-end-marker")).toHaveLength(3);
    expect(screen.getAllByTestId("project-event-marker")).toHaveLength(3);
    expect(screen.getByTestId("project-end-legend")).toHaveClass("bg-danger");
    expect(screen.getByTestId("project-event-legend")).toHaveClass(
      "border-primary/45",
      "border-dashed",
    );
    for (const marker of screen.getAllByTestId("project-end-marker")) {
      expect(marker).toHaveClass("bg-danger/55");
      expect(marker).not.toHaveClass("border-dashed");
    }
    for (const marker of screen.getAllByTestId("project-event-marker")) {
      expect(marker).toHaveClass("border-primary/45", "border-dashed");
      expect(marker).not.toHaveClass("bg-danger/45");
    }
    expect(screen.getByLabelText("Estado de etapa: En curso")).toBeVisible();
    expect(
      within(screen.getByLabelText("Estado de etapa: En curso")).getByText(
        "En curso",
      ),
    ).toHaveClass("sr-only");
    expect(screen.getByLabelText("Estado de etapa: Completada")).toBeVisible();
    expect(screen.getByLabelText("Estado de etapa: Sin tareas")).toBeVisible();
  });

  test("separates desktop stage labels from the scrollable calendar", () => {
    useDesktopViewport();
    render(<ProjectTaskTimeline projectStatus="active" schedule={schedule} />);

    expect(
      screen.getByRole("separator", { name: "Cambiar ancho de etapas" }),
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Etapas del cronograma" }),
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Fechas del cronograma" }),
    ).toHaveClass("overflow-x-auto");
    expect(
      screen.queryByRole("region", { name: "Cronograma desplazable" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Cambiar inicio de Revisar antecedentes",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("combobox", {
        name: "Cambiar estado de Revisar antecedentes. Estado actual: Pendiente",
      }),
    ).not.toHaveTextContent("Pendiente");

    fireEvent.click(
      screen.getByRole("button", { name: "Contraer etapa Investigación" }),
    );
    expect(
      screen.queryByRole("group", { name: "Tareas de Investigación" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Ver fechas de la etapa Investigación",
      }),
    ).toBeVisible();
  });

  test("freezes zoom and grows a temporary horizon during keyboard resize", () => {
    useDesktopViewport();
    const onDateRangeChange = vi.fn().mockResolvedValue(true);
    render(
      <ProjectTaskTimeline
        projectStatus="active"
        schedule={schedule}
        onDateRangeChange={onDateRangeChange}
      />,
    );

    const endHandle = screen.getByRole("button", {
      name: "Cambiar fecha límite de Preparar informe",
    });
    fireEvent.keyDown(endHandle, { key: "ArrowRight", shiftKey: true });

    expect(
      screen.getByLabelText("viernes, 11 de setiembre de 2026"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Alejar cronograma" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Acercar cronograma" }),
    ).toBeDisabled();

    fireEvent.keyDown(endHandle, { key: "ArrowRight", shiftKey: true });
    expect(
      screen.getByLabelText("viernes, 25 de setiembre de 2026"),
    ).toBeInTheDocument();

    fireEvent.keyDown(endHandle, { key: "Escape" });
    expect(
      screen.queryByLabelText("viernes, 11 de setiembre de 2026"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Acercar cronograma" }),
    ).not.toBeDisabled();
    expect(onDateRangeChange).not.toHaveBeenCalled();
  });

  test("does not expose timeline resize handles in the mobile layout", () => {
    render(<ProjectTaskTimeline projectStatus="active" schedule={schedule} />);

    expect(
      screen.queryByRole("button", {
        name: "Cambiar inicio de Revisar antecedentes",
      }),
    ).not.toBeInTheDocument();
  });

  test("starts populated stages expanded and summarizes only collapsed stages", () => {
    render(<ProjectTaskTimeline projectStatus="active" schedule={schedule} />);
    const research = screen.getByRole("button", {
      name: "Contraer etapa Investigación",
    });
    const report = screen.getByRole("button", {
      name: "Contraer etapa Informe",
    });

    expect(research).toHaveAttribute("aria-expanded", "true");
    expect(report).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.queryByRole("button", { name: "Expandir etapa Cierre" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Tareas de Investigación" }),
    ).toBeVisible();
    expect(
      screen.getByRole("group", { name: "Tareas de Informe" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Ver fechas de la etapa Investigación",
      }),
    ).toHaveAttribute("data-stage-summary-mode", "expanded");

    fireEvent.click(research);
    expect(
      screen.queryByRole("group", { name: "Tareas de Investigación" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Tareas de Informe" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Ver fechas de la etapa Investigación",
      }),
    ).toHaveAttribute("data-stage-summary-mode", "collapsed");

    fireEvent.click(
      screen.getByRole("button", { name: "Expandir etapa Investigación" }),
    );
    expect(
      screen.getByRole("group", { name: "Tareas de Investigación" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Ver fechas de la etapa Investigación",
      }),
    ).toHaveAttribute("data-stage-summary-mode", "expanded");
  });

  test("uses compact stage headers with status summaries above expanded tasks", () => {
    useDesktopViewport();
    const { container } = render(
      <ProjectTaskTimeline projectStatus="active" schedule={schedule} />,
    );

    const researchLabel = container.querySelector(
      '[data-timeline-stage-label="stage-1"]',
    );
    const researchTrack = container.querySelector(
      '[data-timeline-stage-track="stage-1"]',
    );

    expect(researchLabel).toHaveClass("h-12");
    expect(researchLabel).toHaveAttribute("data-stage-status", "in_progress");
    expect(researchTrack).toHaveClass("h-12");
    expect(
      screen.getByRole("button", {
        name: "Ver fechas de la etapa Investigación",
      }),
    ).toHaveAttribute("data-stage-summary-mode", "expanded");
  });

  test("renders stronger weekend bands across timeline stage tracks", () => {
    useDesktopViewport();
    const { container } = render(
      <ProjectTaskTimeline
        projectStatus="active"
        schedule={schedule}
        now={new Date("2026-09-02T12:00:00.000Z")}
      />,
    );

    const stageTrack = container.querySelector(
      '[data-timeline-stage-track="stage-1"]',
    );
    const weekendCells = stageTrack?.querySelectorAll('[data-weekend="true"]');
    expect(weekendCells?.length).toBeGreaterThan(0);
    weekendCells?.forEach((cell) => expect(cell).toHaveClass("bg-muted/70"));
  });

  test("coordinates task emphasis between the fixed labels and calendar", () => {
    useDesktopViewport();
    const { container } = render(
      <ProjectTaskTimeline projectStatus="active" schedule={schedule} />,
    );
    const label = container.querySelector(
      '[data-timeline-label-row="task-task-1"]',
    );
    const track = container.querySelector(
      '[data-timeline-track-row="task-task-1"]',
    );

    fireEvent.pointerEnter(label!);
    expect(label).toHaveAttribute("data-highlighted", "true");
    expect(track).toHaveAttribute("data-highlighted", "true");

    fireEvent.pointerLeave(track!);
    expect(label).not.toHaveAttribute("data-highlighted");
    expect(track).not.toHaveAttribute("data-highlighted");
  });

  test("keeps mobile sticky stage labels opaque above the scrolling calendar", () => {
    const { container } = render(
      <ProjectTaskTimeline projectStatus="active" schedule={schedule} />,
    );

    const stageLabel = container.querySelector(
      '[data-timeline-stage-label="stage-1"]',
    );
    expect(stageLabel).toHaveClass("sticky", "left-0", "bg-card");
    expect(stageLabel).toHaveClass("before:bg-muted/20");
    expect(stageLabel).not.toHaveClass("bg-muted/20");
  });

  test("orders dated tasks before the labelled undated group", () => {
    const { container } = render(
      <ProjectTaskTimeline projectStatus="active" schedule={schedule} />,
    );

    const stageTasks = screen.getByRole("group", {
      name: "Tareas de Investigación",
    });
    const taskButtons = within(stageTasks).getAllByRole("button", {
      name: /^Abrir tarea (?!.*cronograma)/,
    });
    expect(taskButtons.map((button) => button.textContent)).toEqual([
      "Revisar antecedentes",
      "Buscar jurisprudencia",
      "Coordinar anexos",
    ]);
    expect(
      within(stageTasks).getByRole("group", {
        name: "Tareas sin fechas de Investigación",
      }),
    ).toHaveTextContent("Sin fechas");
    expect(
      container.querySelector('[data-timeline-label-row="task-task-1"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-timeline-track-row="task-task-1"]'),
    ).toBeInTheDocument();
  });

  test("removes stale expanded content when a stage becomes empty", () => {
    const view = render(
      <ProjectTaskTimeline projectStatus="active" schedule={schedule} />,
    );
    expect(
      screen.getByRole("group", { name: "Tareas de Investigación" }),
    ).toBeVisible();

    view.rerender(
      <ProjectTaskTimeline
        projectStatus="active"
        schedule={{
          ...schedule,
          stages: schedule.stages.map((stage) =>
            stage.id === "stage-1"
              ? {
                  ...stage,
                  scheduledTaskCount: 0,
                  taskStatusCounts: {
                    pending: 0,
                    inProgress: 0,
                    blocked: 0,
                    completed: 0,
                  },
                  tasks: [],
                }
              : stage,
          ),
        }}
      />,
    );

    expect(
      screen.queryByRole("group", { name: "Tareas de Investigación" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /^(Expandir|Contraer) etapa Investigación$/,
      }),
    ).not.toBeInTheDocument();
  });

  test("expands a newly populated stage without reopening an explicitly collapsed stage", () => {
    const initiallyEmptyResearch = {
      ...schedule,
      stages: schedule.stages.map((stage) =>
        stage.id === "stage-1"
          ? {
              ...stage,
              startDate: null,
              endDate: null,
              scheduledTaskCount: 0,
              taskStatusCounts: {
                pending: 0,
                inProgress: 0,
                blocked: 0,
                completed: 0,
              },
              tasks: [],
            }
          : stage,
      ),
    };
    const view = render(
      <ProjectTaskTimeline
        projectStatus="active"
        schedule={initiallyEmptyResearch}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Contraer etapa Informe" }),
    );

    view.rerender(
      <ProjectTaskTimeline projectStatus="active" schedule={schedule} />,
    );

    expect(
      screen.getByRole("group", { name: "Tareas de Investigación" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("group", { name: "Tareas de Informe" }),
    ).not.toBeInTheDocument();
  });

  test("shows complete scheduling details on focus and closes with Escape", () => {
    render(<ProjectTaskTimeline projectStatus="active" schedule={schedule} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Contraer etapa Investigación" }),
    );
    const bar = screen.getByRole("button", {
      name: "Ver fechas de la etapa Investigación",
    });

    fireEvent.focus(bar);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveAttribute("data-slot", "tooltip-content");
    expect(tooltip).toHaveTextContent("Investigación");
    expect(tooltip).toHaveTextContent("6 ago 2026");
    expect(tooltip).toHaveTextContent("12 ago 2026");
    expect(tooltip).toHaveTextContent("2 tareas con fecha");
    expect(tooltip).toHaveTextContent("Estado de etapa: En curso");
    expect(tooltip).toHaveTextContent(
      "Inicio del proyecto usado como referencia",
    );
    expect(bar).toHaveAttribute("aria-describedby", tooltip.id);

    fireEvent.keyDown(bar, { key: "Escape" });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(bar).not.toHaveAttribute("aria-describedby");
  });

  test("toggles on tap and keeps only one stage tooltip open", () => {
    render(<ProjectTaskTimeline projectStatus="active" schedule={schedule} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Contraer etapa Investigación" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Contraer etapa Informe" }),
    );
    const research = screen.getByRole("button", {
      name: "Ver fechas de la etapa Investigación",
    });
    const report = screen.getByRole("button", {
      name: "Ver fechas de la etapa Informe",
    });

    fireEvent.click(research);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Investigación");

    fireEvent.click(report);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Informe");
    expect(screen.getByRole("tooltip")).not.toHaveTextContent(
      "Inicio del proyecto usado como referencia",
    );

    fireEvent.click(report);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  test("opens on pointer hover and closes when the pointer leaves", async () => {
    render(<ProjectTaskTimeline projectStatus="active" schedule={schedule} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Contraer etapa Informe" }),
    );
    const bar = screen.getByRole("button", {
      name: "Ver fechas de la etapa Informe",
    });

    fireEvent.pointerMove(bar, { pointerType: "mouse" });
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Informe");

    fireEvent.pointerLeave(bar, { pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  test("highlights and initially offsets today in the organization timezone", () => {
    mockScrollDimensions();
    const { container } = render(
      <ProjectTaskTimeline
        projectStatus="active"
        schedule={schedule}
        now={new Date("2026-08-10T04:30:00.000Z")}
      />,
    );
    const timeline = screen.getByRole("region", {
      name: "Cronograma desplazable",
    });

    expect(screen.getByText("Hoy")).toBeInTheDocument();
    expect(
      screen.getByLabelText("domingo, 9 de agosto de 2026"),
    ).toHaveAttribute("aria-current", "date");
    expect(container.querySelectorAll('[data-today="true"]')).toHaveLength(8);
    expect(timeline.scrollLeft).toBe(113.6);
  });

  test("uses the end of a historical timeline without marking a false today", () => {
    mockScrollDimensions();
    render(
      <ProjectTaskTimeline
        projectStatus="active"
        schedule={schedule}
        now={new Date("2026-09-02T12:00:00.000Z")}
      />,
    );
    const timeline = screen.getByRole("region", {
      name: "Cronograma desplazable",
    });

    expect(screen.queryByText("Hoy")).not.toBeInTheDocument();
    expect(timeline.scrollLeft).toBe(1_360);
  });

  test("uses the start when today precedes the project", () => {
    mockScrollDimensions();
    render(
      <ProjectTaskTimeline
        projectStatus="active"
        schedule={schedule}
        now={new Date("2026-08-01T12:00:00.000Z")}
      />,
    );
    const timeline = screen.getByRole("region", {
      name: "Cronograma desplazable",
    });

    expect(screen.queryByText("Hoy")).not.toBeInTheDocument();
    expect(timeline.scrollLeft).toBe(0);
  });

  test("does not override manual scrolling after a timeline interaction", () => {
    mockScrollDimensions();
    render(
      <ProjectTaskTimeline
        projectStatus="active"
        schedule={schedule}
        now={new Date("2026-08-10T04:30:00.000Z")}
      />,
    );
    const timeline = screen.getByRole("region", {
      name: "Cronograma desplazable",
    });
    timeline.scrollLeft = 500;

    fireEvent.click(
      screen.getByRole("button", { name: "Contraer etapa Investigación" }),
    );

    expect(timeline.scrollLeft).toBe(500);
  });

  test("fits the available calendar width and preserves its center while zooming", async () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    let observedElement: Element | undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback;
        }
        observe(element: Element) {
          observedElement = element;
        }
        unobserve() {}
        disconnect() {}
      },
    );

    render(
      <ProjectTaskTimeline
        projectStatus="active"
        schedule={schedule}
        now={new Date("2026-08-10T12:00:00.000Z")}
      />,
    );

    const timeline = screen.getByRole("region", {
      name: "Cronograma desplazable",
    });
    const fit = screen.getByRole("button", {
      name: "Ajustar cronograma al ancho",
    });
    const zoomIn = screen.getByRole("button", {
      name: "Acercar cronograma",
    });
    expect(fit).toHaveAttribute("aria-pressed", "true");
    expect(zoomIn).toHaveClass("size-11", "lg:size-8");
    const zoomToolbar = screen.getByRole("toolbar", {
      name: "Controles del cronograma",
    });
    expect(zoomToolbar).toContainElement(
      screen.getByRole("group", { name: "Zoom del cronograma" }),
    );
    expect(timeline).toHaveClass("[scrollbar-gutter:stable]");

    act(() => {
      resizeCallback?.(
        [
          {
            target: observedElement,
            contentRect: { width: 1_024 },
          } as unknown as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      );
    });

    const firstDay = screen.getByLabelText("jueves, 6 de agosto de 2026");
    await waitFor(() => expect(firstDay).toHaveStyle({ width: "40px" }));
    expect(screen.getAllByTestId("project-end-marker")[0]).toHaveStyle({
      left: "580px",
    });

    timeline.scrollLeft = 200;
    fireEvent.click(zoomIn);

    await waitFor(() => expect(firstDay).toHaveStyle({ width: "56px" }));
    expect(timeline.scrollLeft).toBe(440);
    expect(fit).toHaveAttribute("aria-pressed", "false");
    expect(
      screen
        .getByRole("button", {
          name: "Abrir tarea Revisar antecedentes desde el cronograma",
        })
        .closest("[data-task-resize-target]"),
    ).toHaveStyle({ left: "0px", width: "392px" });
    fireEvent.click(
      screen.getByRole("button", { name: "Contraer etapa Investigación" }),
    );
    expect(
      screen.getByRole("button", {
        name: "Ver fechas de la etapa Investigación",
      }),
    ).toHaveStyle({ left: "0px", width: "392px" });
    expect(window.localStorage.getItem("orbit:project-timeline-zoom:v1")).toBe(
      "56",
    );
  });

  test("restores a global manual scale and recalculates fit after desktop resizing", async () => {
    useDesktopViewport();
    window.localStorage.setItem("orbit:project-timeline-zoom:v1", "112");
    const resizeObservers: Array<{
      callback: ResizeObserverCallback;
      elements: Set<Element>;
    }> = [];
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        readonly entry: (typeof resizeObservers)[number];
        constructor(callback: ResizeObserverCallback) {
          this.entry = { callback, elements: new Set() };
          resizeObservers.push(this.entry);
        }
        observe(element: Element) {
          this.entry.elements.add(element);
        }
        unobserve(element: Element) {
          this.entry.elements.delete(element);
        }
        disconnect() {
          this.entry.elements.clear();
        }
      },
    );

    render(<ProjectTaskTimeline projectStatus="active" schedule={schedule} />);

    const timeline = screen.getByRole("region", {
      name: "Fechas del cronograma",
    });
    expect(timeline).toBeVisible();
    const timelineResizeObserver = resizeObservers.find(({ elements }) =>
      elements.has(timeline),
    );
    expect(timelineResizeObserver).toBeDefined();
    expect(
      screen.getByRole("group", { name: "Zoom del cronograma" }),
    ).toBeVisible();
    const firstDay = screen.getByLabelText("jueves, 6 de agosto de 2026");
    const fit = screen.getByRole("button", {
      name: "Ajustar cronograma al ancho",
    });
    const zoomIn = screen.getByRole("button", {
      name: "Acercar cronograma",
    });
    expect(firstDay).toHaveStyle({ width: "112px" });
    expect(fit).toHaveAttribute("aria-pressed", "false");
    expect(zoomIn).toBeDisabled();

    act(() => {
      timelineResizeObserver?.callback(
        [
          {
            target: timeline,
            contentRect: { width: 800 },
          } as unknown as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      );
    });
    expect(firstDay).toHaveStyle({ width: "112px" });

    fireEvent.click(fit);
    await waitFor(() => expect(firstDay).toHaveStyle({ width: "40px" }));
    expect(fit).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("orbit:project-timeline-zoom:v1")).toBe(
      "fit",
    );

    act(() => {
      timelineResizeObserver?.callback(
        [
          {
            target: timeline,
            contentRect: { width: 1_840 },
          } as unknown as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      );
    });
    await waitFor(() => expect(firstDay).toHaveStyle({ width: "80px" }));

    fireEvent.focus(fit);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Ajustar cronograma al ancho",
    );
  });
});
