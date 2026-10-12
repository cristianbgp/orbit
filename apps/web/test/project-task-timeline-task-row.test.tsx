import { createRef } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ProjectTaskTimelineTaskRow } from "@/features/projects/project-task-timeline-task-row";
import type { ProjectTaskScheduleTask } from "@/lib/api/generated/models";

const interactMocks = vi.hoisted(() => ({
  target: undefined as HTMLElement | undefined,
  options: undefined as
    | undefined
    | {
        edges?: { left?: string; right?: string };
        autoScroll?: { container?: HTMLElement | null };
        listeners: {
          start(event: {
            edges: { left?: boolean; right?: boolean };
            clientX: number;
          }): void;
          move(event: { clientX: number }): void;
          end(): void;
        };
      },
  unset: vi.fn(),
}));

vi.mock("interactjs", () => ({
  default: vi.fn((target: HTMLElement) => {
    interactMocks.target = target;
    return {
      resizable: vi.fn((options) => {
        interactMocks.options = options;
      }),
      unset: interactMocks.unset,
    };
  }),
}));

vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const days = [
  { date: "2026-08-06", isWeekend: false },
  { date: "2026-08-07", isWeekend: false },
  { date: "2026-08-08", isWeekend: true },
  { date: "2026-08-09", isWeekend: true },
  { date: "2026-08-10", isWeekend: false },
  { date: "2026-08-11", isWeekend: false },
  { date: "2026-08-12", isWeekend: false },
];

const task: ProjectTaskScheduleTask = {
  id: "task-1",
  title: "Revisar antecedentes",
  status: "pending",
  plannedStartDate: "2026-08-08",
  internalDueDate: "2026-08-12",
  position: 0,
};

type RowProps = {
  updating?: boolean;
  readOnly?: boolean;
  highlighted?: boolean;
  dateResize?: boolean;
  dayWidth?: number;
};

function renderRow(
  overrides: Partial<ProjectTaskScheduleTask> = {},
  props: RowProps = {},
) {
  const taskOpenerRef = createRef<HTMLElement>();
  const onOpenTask = vi.fn();
  const onStatusChange = vi.fn();
  const onResizeSessionChange = vi.fn();
  const onRequestResizeHorizon = vi.fn();
  const onDateRangeChange = vi.fn().mockResolvedValue(true);
  const visibleTask = { ...task, ...overrides };
  const scrollRegion = document.createElement("div");
  scrollRegion.scrollLeft = 100;

  const content = (currentProps: RowProps) => (
    <TooltipProvider>
      <ProjectTaskTimelineTaskRow
        task={visibleTask}
        stageName="Investigación"
        days={days}
        startDay={Date.parse("2026-08-06T00:00:00Z") / 86_400_000}
        dayWidth={currentProps.dayWidth ?? 56}
        trackWidth={days.length * (currentProps.dayWidth ?? 56)}
        today="2026-08-10"
        endDatePosition={360}
        eventMarkers={[{ id: "event-1", position: 440 }]}
        updating={currentProps.updating}
        readOnly={currentProps.readOnly}
        highlighted={currentProps.highlighted}
        taskOpenerRef={taskOpenerRef}
        onOpenTask={onOpenTask}
        onStatusChange={onStatusChange}
        dateResize={
          currentProps.dateResize
            ? {
                projectStartDate: "2026-08-06",
                scrollRegionRef: { current: scrollRegion },
                onSessionChange: onResizeSessionChange,
                onRequestHorizon: onRequestResizeHorizon,
                onDateRangeChange,
              }
            : undefined
        }
      />
    </TooltipProvider>
  );
  let currentProps = props;
  const view = render(content(currentProps));

  return {
    ...view,
    taskOpenerRef,
    onOpenTask,
    onStatusChange,
    onResizeSessionChange,
    onRequestResizeHorizon,
    onDateRangeChange,
    scrollRegion,
    visibleTask,
    rerenderRow(nextProps: Partial<RowProps>) {
      currentProps = { ...currentProps, ...nextProps };
      view.rerender(content(currentProps));
    },
  };
}

describe("ProjectTaskTimelineTaskRow", () => {
  test("renders an inclusive dated bar and opens the task from title or bar", () => {
    const { taskOpenerRef, onOpenTask, visibleTask } = renderRow();

    const title = screen.getByRole("button", {
      name: "Abrir tarea Revisar antecedentes",
    });
    fireEvent.click(title);
    expect(taskOpenerRef.current).toBe(title);
    expect(onOpenTask).toHaveBeenCalledWith(visibleTask);

    const bar = screen.getByRole("button", {
      name: "Abrir tarea Revisar antecedentes desde el cronograma",
    });
    expect(bar.closest("[data-task-resize-target]")).toHaveStyle({
      left: "112px",
      width: "280px",
    });

    fireEvent.focus(bar);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveAttribute("data-slot", "tooltip-content");
    expect(tooltip).toHaveTextContent("Revisar antecedentes");
    expect(tooltip).toHaveTextContent("Investigación");
    expect(tooltip).toHaveTextContent("Pendiente");
    expect(tooltip).toHaveTextContent("Del 8 ago 2026 al 12 ago 2026");

    fireEvent.click(bar);
    expect(taskOpenerRef.current).toBe(bar);
    expect(onOpenTask).toHaveBeenCalledTimes(2);
  });

  test("shows independent resize handles only for editable dated desktop rows", () => {
    const view = renderRow({}, { dateResize: true });

    expect(
      screen.getByRole("button", {
        name: "Cambiar inicio de Revisar antecedentes",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Cambiar fecha límite de Revisar antecedentes",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Abrir tarea Revisar antecedentes desde el cronograma",
      }),
    ).toBeVisible();

    view.unmount();
    renderRow({}, { dateResize: true, readOnly: true });
    expect(
      screen.queryByRole("button", {
        name: "Cambiar inicio de Revisar antecedentes",
      }),
    ).not.toBeInTheDocument();
  });

  test("keeps pointer resize handles inside the Interact.js target", async () => {
    renderRow({}, { dateResize: true });

    const startHandle = screen.getByRole("button", {
      name: "Cambiar inicio de Revisar antecedentes",
    });
    const endHandle = screen.getByRole("button", {
      name: "Cambiar fecha límite de Revisar antecedentes",
    });

    await waitFor(() => expect(interactMocks.target).toBeDefined());
    expect(interactMocks.target).toContainElement(startHandle);
    expect(interactMocks.target).toContainElement(endHandle);
  });

  test("lets Interact.js resolve the resize edge from children inside each handle", async () => {
    renderRow({}, { dateResize: true });

    await waitFor(() => expect(interactMocks.options).toBeDefined());
    expect(interactMocks.options?.edges).toEqual({
      left: '[data-task-resize-edge="start"]',
      right: '[data-task-resize-edge="end"]',
    });
  });

  test("lets the document-level interaction listener receive handle pointerdown", () => {
    renderRow({}, { dateResize: true });
    const startHandle = screen.getByRole("button", {
      name: "Cambiar inicio de Revisar antecedentes",
    });
    const onDocumentPointerDown = vi.fn();
    document.addEventListener("pointerdown", onDocumentPointerDown);

    try {
      fireEvent.pointerDown(startHandle, {
        pointerId: 1,
        pointerType: "mouse",
        buttons: 1,
      });
    } finally {
      document.removeEventListener("pointerdown", onDocumentPointerDown);
    }

    expect(onDocumentPointerDown).toHaveBeenCalledOnce();
  });

  test("prevents native touch gestures and text selection on resize handles", () => {
    renderRow({}, { dateResize: true });
    const startHandle = screen.getByRole("button", {
      name: "Cambiar inicio de Revisar antecedentes",
    });
    const endHandle = screen.getByRole("button", {
      name: "Cambiar fecha límite de Revisar antecedentes",
    });

    for (const handle of [startHandle, endHandle]) {
      expect(handle).toHaveStyle({
        touchAction: "none",
        userSelect: "none",
      });
      expect(handle.style.webkitUserSelect).toBe("none");
    }
  });

  test("keeps the task title clear of the resize handles", () => {
    renderRow({}, { dateResize: true });

    expect(
      screen.getByRole("button", {
        name: "Abrir tarea Revisar antecedentes desde el cronograma",
      }),
    ).toHaveClass("px-3");
  });

  test("renders wider visible grips without shrinking their hit targets", () => {
    renderRow({}, { dateResize: true });

    for (const name of [
      "Cambiar inicio de Revisar antecedentes",
      "Cambiar fecha límite de Revisar antecedentes",
    ]) {
      const handle = screen.getByRole("button", { name });
      expect(handle).toHaveClass("w-6");
      expect(handle.querySelector("span")).toHaveClass("w-1");
    }
  });

  test("keeps reliable resize targets around a minimum-width task bar", () => {
    const { onOpenTask } = renderRow(
      {
        plannedStartDate: "2026-08-10",
        internalDueDate: "2026-08-10",
      },
      { dateResize: true, dayWidth: 40 },
    );

    const bar = screen.getByRole("button", {
      name: "Abrir tarea Revisar antecedentes desde el cronograma",
    });
    expect(bar.closest("[data-task-resize-target]")).toHaveStyle({
      width: "40px",
    });

    const startHandle = screen.getByRole("button", {
      name: "Cambiar inicio de Revisar antecedentes",
    });
    const endHandle = screen.getByRole("button", {
      name: "Cambiar fecha límite de Revisar antecedentes",
    });
    expect(startHandle).toHaveClass("h-11", "w-6", "-translate-x-3/4");
    expect(endHandle).toHaveClass("h-11", "w-6", "-translate-x-1/4");
    expect(startHandle).toHaveStyle({ left: "0px" });
    expect(endHandle).toHaveStyle({ left: "100%" });
    expect(startHandle.querySelector("span")).toHaveStyle({ left: "75%" });
    expect(endHandle.querySelector("span")).toHaveStyle({ left: "25%" });

    fireEvent.click(startHandle);
    fireEvent.click(endHandle);
    expect(onOpenTask).not.toHaveBeenCalled();

    fireEvent.click(bar);
    expect(onOpenTask).toHaveBeenCalledOnce();
  });

  test("gives resize handles exclusive tooltip ownership", () => {
    renderRow({}, { dateResize: true });

    const bar = screen.getByRole("button", {
      name: "Abrir tarea Revisar antecedentes desde el cronograma",
    });
    const startHandle = screen.getByRole("button", {
      name: "Cambiar inicio de Revisar antecedentes",
    });
    const endHandle = screen.getByRole("button", {
      name: "Cambiar fecha límite de Revisar antecedentes",
    });

    fireEvent.focus(bar);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Revisar antecedentes",
    );

    fireEvent.pointerEnter(startHandle);
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Cambiar inicio de Revisar antecedentes",
    );
    expect(screen.getByRole("tooltip")).not.toHaveTextContent(
      "Etapa: Investigación",
    );

    fireEvent.pointerLeave(startHandle);
    fireEvent.focus(endHandle);
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Cambiar fecha límite de Revisar antecedentes",
    );
  });

  test("does not add resize handles to an undated task", () => {
    renderRow(
      { plannedStartDate: null, internalDueDate: null },
      { dateResize: true },
    );

    expect(
      screen.queryByRole("button", { name: /Cambiar inicio/ }),
    ).not.toBeInTheDocument();
  });

  test("previews and commits keyboard date changes while Escape cancels", async () => {
    const { onDateRangeChange, onResizeSessionChange } = renderRow(
      {},
      { dateResize: true },
    );
    const startHandle = screen.getByRole("button", {
      name: "Cambiar inicio de Revisar antecedentes",
    });

    fireEvent.keyDown(startHandle, { key: "ArrowLeft", shiftKey: true });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Inicio: 6 ago 2026");
    expect(onResizeSessionChange).toHaveBeenCalledWith(true);

    fireEvent.keyDown(startHandle, { key: "Escape" });
    expect(onDateRangeChange).not.toHaveBeenCalled();
    expect(onResizeSessionChange).toHaveBeenLastCalledWith(false);

    const endHandle = screen.getByRole("button", {
      name: "Cambiar fecha límite de Revisar antecedentes",
    });
    fireEvent.keyDown(endHandle, { key: "ArrowRight" });
    fireEvent.keyDown(endHandle, { key: "Enter" });

    await waitFor(() =>
      expect(onDateRangeChange).toHaveBeenCalledWith(task, {
        plannedStartDate: "2026-08-08",
        internalDueDate: "2026-08-13",
      }),
    );
  });

  test("keeps only the manipulated edge visually active through keyboard save", async () => {
    let resolveSave!: (saved: boolean) => void;
    const pendingSave = new Promise<boolean>((resolve) => {
      resolveSave = resolve;
    });
    const { onDateRangeChange, rerenderRow } = renderRow(
      {},
      { dateResize: true },
    );
    onDateRangeChange.mockImplementation(() => pendingSave);
    const startHandle = screen.getByRole("button", {
      name: "Cambiar inicio de Revisar antecedentes",
    });
    const endHandle = screen.getByRole("button", {
      name: "Cambiar fecha límite de Revisar antecedentes",
    });
    const resizeTarget = startHandle.closest("[data-task-resize-target]");

    fireEvent.keyDown(startHandle, { key: "ArrowRight" });
    expect(startHandle).toHaveAttribute("data-active", "true");
    expect(startHandle).toHaveClass("ring-2", "ring-primary");
    expect(endHandle).not.toHaveAttribute("data-active");
    expect(resizeTarget).toHaveAttribute("data-resize-active", "true");

    fireEvent.keyDown(startHandle, { key: "Enter" });
    rerenderRow({ updating: true });
    expect(
      screen.getByRole("button", {
        name: "Cambiar inicio de Revisar antecedentes",
      }),
    ).toHaveAttribute("data-active", "true");
    expect(resizeTarget).toHaveAttribute("data-resize-active", "true");

    resolveSave(true);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", {
          name: "Cambiar inicio de Revisar antecedentes",
        }),
      ).not.toBeInTheDocument(),
    );
    expect(resizeTarget).not.toHaveAttribute("data-resize-active");
  });

  test("uses frozen fractional width plus scroll movement for pointer resize", async () => {
    const {
      onDateRangeChange,
      onRequestResizeHorizon,
      onResizeSessionChange,
      scrollRegion,
    } = renderRow({}, { dateResize: true, dayWidth: 67.5 });
    await waitFor(() =>
      expect(interactMocks.options?.autoScroll?.container).toBe(scrollRegion),
    );

    act(() => {
      interactMocks.options?.listeners.start({
        edges: { right: true },
        clientX: 200,
      });
      interactMocks.options?.listeners.move({ clientX: 267.5 });
    });

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Fecha límite: 13 ago 2026",
    );
    expect(
      screen.getByRole("button", {
        name: "Cambiar fecha límite de Revisar antecedentes",
      }),
    ).toHaveAttribute("data-active", "true");

    act(() => {
      scrollRegion.scrollLeft = 167.5;
      fireEvent.scroll(scrollRegion);
    });

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Fecha límite: 14 ago 2026",
    );
    expect(onRequestResizeHorizon).toHaveBeenCalledWith("2026-08-14");

    await act(async () => interactMocks.options?.listeners.end());
    expect(onDateRangeChange).toHaveBeenCalledWith(task, {
      plannedStartDate: "2026-08-08",
      internalDueDate: "2026-08-14",
    });
    expect(onResizeSessionChange).toHaveBeenLastCalledWith(false);
  });

  test("keeps the task label fixed while the unified mobile row scrolls", () => {
    renderRow();

    expect(
      screen
        .getByRole("button", { name: "Abrir tarea Revisar antecedentes" })
        .closest("[data-timeline-label-row]"),
    ).toHaveClass("sticky", "left-0", "z-30");
  });

  test("renders either known date as a one-day bar", () => {
    const view = renderRow({
      plannedStartDate: "2026-08-10",
      internalDueDate: null,
    });
    expect(
      screen
        .getByRole("button", {
          name: "Abrir tarea Revisar antecedentes desde el cronograma",
        })
        .closest("[data-task-resize-target]"),
    ).toHaveStyle({ left: "224px", width: "56px" });
    view.onOpenTask.mockClear();

    view.unmount();
    renderRow({ plannedStartDate: null, internalDueDate: "2026-08-10" });
    fireEvent.focus(
      screen.getByRole("button", {
        name: "Abrir tarea Revisar antecedentes desde el cronograma",
      }),
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Fecha límite: 10 ago 2026",
    );
  });

  test("keeps undated tasks actionable without inventing a bar", () => {
    renderRow({ plannedStartDate: null, internalDueDate: null });

    expect(
      screen.getByRole("button", { name: "Abrir tarea Revisar antecedentes" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Abrir tarea Revisar antecedentes desde el cronograma",
      }),
    ).not.toBeInTheDocument();
  });

  test("reuses the compact status control and disables it while updating", () => {
    const { onStatusChange } = renderRow({}, { updating: true });
    const trigger = screen.getByRole("combobox", {
      name: "Cambiar estado de Revisar antecedentes. Estado actual: Pendiente",
    });
    expect(trigger).toBeDisabled();
    expect(trigger).not.toHaveTextContent("Pendiente");
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  test("uses the task status as a compact row accent", () => {
    const { container } = renderRow({ status: "blocked" });

    expect(
      container.querySelector('[data-timeline-label-row="task-task-1"]'),
    ).toHaveClass("h-14");
    expect(
      container.querySelector('[data-timeline-track-row="task-task-1"]'),
    ).toHaveClass("h-14");
    expect(
      container.querySelector('[data-task-status-stripe="blocked"]'),
    ).toHaveClass("bg-task-status-blocked");
    expect(
      container.querySelector('[data-timeline-label-row="task-task-1"]'),
    ).toHaveAttribute("data-task-status", "blocked");
  });

  test("renders stronger continuous weekend bands behind task rows", () => {
    const { container } = renderRow();

    const weekendCells = container.querySelectorAll('[data-weekend="true"]');
    expect(weekendCells).toHaveLength(2);
    weekendCells.forEach((cell) => expect(cell).toHaveClass("bg-muted/70"));
  });

  test("coordinates the highlighted treatment across the task label and track", () => {
    const { container } = renderRow({}, { highlighted: true });
    const label = container.querySelector(
      '[data-timeline-label-row="task-task-1"]',
    );

    expect(label).toHaveAttribute("data-highlighted", "true");
    expect(label).toHaveClass("bg-card");
    expect(label).toHaveClass("before:bg-primary/5");
    expect(
      container.querySelector('[data-timeline-track-row="task-task-1"]'),
    ).toHaveAttribute("data-highlighted", "true");
  });

  test("reports a selected task status", () => {
    const { onStatusChange, visibleTask } = renderRow();
    const trigger = screen.getByRole("combobox", {
      name: "Cambiar estado de Revisar antecedentes. Estado actual: Pendiente",
    });

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "En trabajo" }));

    expect(onStatusChange).toHaveBeenCalledWith(visibleTask, "in_progress");
  });
});
