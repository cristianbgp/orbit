import { createRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ProjectActivityMessage } from "@/features/projects/project-activity-message";
import { ProjectTasks } from "@/features/projects/project-tasks";
import type { ProjectActivity, ProjectTask } from "@/lib/api/generated/models";

const selectedTask: ProjectTask = {
  id: "task-9",
  stage: { id: "stage-1", name: "Investigación", position: 0 },
  title: "Task nine",
  description: "Detalle cargado desde la consulta individual.",
  status: "in_progress",
  plannedStartDate: "2026-08-07",
  internalDueDate: "2026-08-14",
  position: 8,
  archivedAt: null,
  responsibles: [],
  createdAt: "2026-08-06T20:00:00.000Z",
  updatedAt: "2026-08-07T20:00:00.000Z",
};

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">{`${location.pathname}${location.search}`}</output>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProjectTasks with the shared task sheet", () => {
  test("loads a direct task through the real sheet and closes without discarding other query state", async () => {
    const listResponse = deferredResponse();
    const detailResponse = deferredResponse();
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));

      if (
        url.pathname === "/api/projects/project-1/tasks" &&
        url.searchParams.has("view")
      ) {
        return listResponse.promise;
      }
      if (url.pathname === "/api/projects/project-1/tasks/task-9") {
        return detailResponse.promise;
      }
      if (url.pathname === "/api/projects/project-1/stages") {
        return Response.json({
          stages: [
            {
              id: "stage-1",
              name: "Investigación",
              description: null,
              position: 0,
              createdAt: "2026-08-06T10:00:00.000Z",
              updatedAt: "2026-08-06T10:00:00.000Z",
            },
          ],
        });
      }
      if (url.pathname === "/api/projects/project-1/assignments") {
        return Response.json({
          active: [],
          history: [],
          historyPagination: {
            page: 1,
            pageSize: 1,
            total: 0,
            totalPages: 0,
          },
        });
      }
      if (url.pathname === "/api/projects/project-1/task-schedule") {
        return Response.json({
          project: {
            startDate: "2026-08-06",
            endDate: "2026-08-14",
            timeZone: "America/Lima",
          },
          events: [],
          stages: [],
        });
      }

      throw new Error(`Unexpected request: ${url.pathname}${url.search}`);
    });
    vi.stubGlobal("fetch", fetcher);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const taskOpenerRef = createRef<HTMLElement>();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            "/projects/project-1?view=active&task=task-9&filter=mine",
          ]}
        >
          <ProjectTasks
            projectStatus="active"
            projectId="project-1"
            projectStartDate="2026-08-06"
            taskOpenerRef={taskOpenerRef}
          />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByLabelText("Cargando tareas")).toBeInTheDocument();
    expect(
      await screen.findByRole("dialog", { name: "Cargando tarea" }),
    ).toBeVisible();
    expect(taskOpenerRef.current).toBeNull();

    await act(async () => {
      detailResponse.resolve(Response.json({ task: selectedTask }));
    });

    expect(
      await screen.findByRole("dialog", { name: "Task nine" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
    fireEvent.click(screen.getByLabelText("Fechas planificadas"));
    expect(
      screen.getByRole("button", {
        name: /^miércoles, 5 de agosto de 2026$/i,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: /^jueves, 6 de agosto de 2026$/i,
      }),
    ).toBeEnabled();
    fireEvent.click(screen.getByLabelText("Fechas planificadas"));

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/projects/project-1?view=active&filter=mine",
    );
    expect(taskOpenerRef.current).toBeNull();

    await act(async () => {
      listResponse.resolve(
        Response.json({
          tasks: [],
          pagination: {
            page: 1,
            pageSize: 25,
            total: 0,
            totalPages: 0,
          },
        }),
      );
    });
    queryClient.clear();
  });

  test("keeps create and activity-opened Sheet form labels bound to their own fields", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));

      if (
        url.pathname === "/api/projects/project-1/tasks" &&
        url.searchParams.has("view")
      ) {
        return Response.json({
          tasks: [],
          pagination: {
            page: 1,
            pageSize: 25,
            total: 0,
            totalPages: 0,
          },
        });
      }
      if (url.pathname === "/api/projects/project-1/tasks/task-9") {
        return Response.json({ task: selectedTask });
      }
      if (url.pathname === "/api/projects/project-1/stages") {
        return Response.json({
          stages: [
            {
              id: "stage-1",
              name: "Investigación",
              description: null,
              position: 0,
              createdAt: "2026-08-06T10:00:00.000Z",
              updatedAt: "2026-08-06T10:00:00.000Z",
            },
          ],
        });
      }
      if (url.pathname === "/api/projects/project-1/assignments") {
        return Response.json({
          active: [],
          history: [],
          historyPagination: {
            page: 1,
            pageSize: 1,
            total: 0,
            totalPages: 0,
          },
        });
      }
      if (url.pathname === "/api/projects/project-1/task-schedule") {
        return Response.json({
          project: {
            startDate: "2026-08-06",
            endDate: "2026-08-14",
            timeZone: "America/Lima",
          },
          events: [],
          stages: [],
        });
      }

      throw new Error(`Unexpected request: ${url.pathname}${url.search}`);
    });
    vi.stubGlobal("fetch", fetcher);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const taskOpenerRef = createRef<HTMLElement>();
    const activity: ProjectActivity = {
      id: "activity-1",
      type: "task.created",
      actor: {
        userId: "user-1",
        alias: "AT",
        avatarColor: "#11182b",
        nameSnapshot: "Ana Torres",
        activeStudioMember: true,
        linkable: true,
      },
      subject: null,
      details: { taskId: "task-9", taskTitle: "Task nine" },
      createdAt: "2026-08-07T20:00:00.000Z",
    };

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/projects/project-1"]}>
          <p>
            <ProjectActivityMessage
              activity={activity}
              projectId="project-1"
              taskOpenerRef={taskOpenerRef}
            />
          </p>
          <ProjectTasks
            projectStatus="active"
            projectId="project-1"
            projectStartDate="2026-08-06"
            taskOpenerRef={taskOpenerRef}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Nueva tarea" }));
    const createForm = screen
      .getByRole("button", { name: "Crear tarea" })
      .closest("form");
    expect(createForm).not.toBeNull();

    fireEvent.click(screen.getByRole("link", { name: "Task nine" }));
    const dialog = await screen.findByRole("dialog", { name: "Task nine" });
    const sheetForm = dialog
      .querySelector<HTMLButtonElement>('button[type="submit"]')
      ?.closest("form");
    expect(sheetForm).not.toBeNull();

    const controls = [
      ...createForm!.querySelectorAll<HTMLElement>("[id]"),
      ...sheetForm!.querySelectorAll<HTMLElement>("[id]"),
    ];
    expect(new Set(controls.map(({ id }) => id)).size).toBe(controls.length);

    for (const form of [createForm!, sheetForm!]) {
      for (const label of form.querySelectorAll<HTMLLabelElement>(
        "label[for]",
      )) {
        expect(label.control).not.toBeNull();
        expect(form.contains(label.control)).toBe(true);
      }
    }

    queryClient.clear();
  });
});
