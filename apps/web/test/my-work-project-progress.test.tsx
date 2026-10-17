import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, test, vi } from "vitest";

import { MyWorkProjectProgress } from "@/features/my-work/my-work-project-progress";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

describe("MyWorkProjectProgress", () => {
  test("fits the supervision header at the iPad landscape breakpoint", () => {
    render(
      <MyWorkProjectProgress
        projectName="Apelación responsive"
        counts={{
          pending: 3,
          inProgress: 2,
          blocked: 1,
          completed: 4,
          unassigned: 1,
          total: 10,
        }}
      />,
    );

    expect(
      screen.getByRole("group", {
        name: "Progreso de tareas en Apelación responsive",
      }),
    ).toHaveClass(
      "sm:col-span-2",
      "lg:col-span-1",
      "lg:self-center",
      "lg:space-y-2",
      "xl:space-y-2.5",
    );
  });

  test("shows proportional status segments with keyboard tooltips", async () => {
    render(
      <MyWorkProjectProgress
        projectName="Apelación Andina"
        counts={{
          pending: 3,
          inProgress: 2,
          blocked: 1,
          completed: 4,
          unassigned: 2,
          total: 10,
        }}
      />,
    );

    const progress = screen.getByRole("group", {
      name: "Progreso de tareas en Apelación Andina",
    });
    expect(
      within(progress).getByRole("img", {
        name: /10 tareas: pendientes 3, en trabajo 2, suspendidas 1, completadas 4/,
      }),
    ).toBeVisible();
    expect(screen.getByLabelText("Pendientes: 3, 30%")).toHaveStyle({
      width: "30%",
    });
    expect(screen.getByLabelText("Completadas: 4, 40%")).toHaveStyle({
      width: "40%",
    });
    expect(within(progress).getByText(/Sin encargado/)).toHaveTextContent("2");

    fireEvent.focus(screen.getByLabelText("Suspendidas: 1, 10%"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Suspendidas: 1 (10%)",
    );
  });

  test.each([
    ["Pendientes", "bg-task-status-pending"],
    ["En trabajo", "bg-task-status-in-progress"],
    ["Suspendidas", "bg-task-status-blocked"],
    ["Completadas", "bg-task-status-completed"],
  ])("maps %s to its status color in the legend", (label, colorClass) => {
    render(
      <MyWorkProjectProgress
        projectName="Consulta de estado"
        counts={{
          pending: 1,
          inProgress: 1,
          blocked: 1,
          completed: 1,
          unassigned: 0,
          total: 4,
        }}
      />,
    );

    expect(
      screen.getByText(label).querySelector('[aria-hidden="true"]'),
    ).toHaveClass("size-2", "shrink-0", "rounded-full", colorClass);
  });

  test("uses a neutral state and no focusable segments without tasks", () => {
    render(
      <MyWorkProjectProgress
        projectName="Consulta vacía"
        counts={{
          pending: 0,
          inProgress: 0,
          blocked: 0,
          completed: 0,
          unassigned: 0,
          total: 0,
        }}
      />,
    );

    expect(screen.getByText("Sin tareas")).toBeVisible();
    expect(screen.queryByLabelText(/Pendientes:/)).not.toBeInTheDocument();
    expect(screen.getByText("Pendientes")).toHaveTextContent("0");
  });

  test("uses the singular task label for a one-task project", () => {
    render(
      <MyWorkProjectProgress
        projectName="Consulta individual"
        counts={{
          pending: 1,
          inProgress: 0,
          blocked: 0,
          completed: 0,
          unassigned: 0,
          total: 1,
        }}
      />,
    );

    expect(
      screen.getByRole("img", {
        name: /1 tarea: pendientes 1/,
      }),
    ).toBeVisible();
  });
});
