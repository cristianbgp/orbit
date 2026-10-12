import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectSettingsPage } from "@/features/projects/project-settings-page";
import { ApiClientError } from "@/lib/api/fetcher";

const project = {
  id: "project-1",
  client: { id: "client-1", name: "Constructora del Sur S.A." },
  name: "Apelación Constructora",
  type: "written_submission" as const,
  status: "draft" as const,
  startDate: "2026-08-06",
  endDate: "2026-08-14",
  internalReference: "EXP-2026-014",
  description: "Impugnación de la resolución de primera instancia.",
  archivedAt: null as string | null,
  createdAt: "2026-08-05T10:00:00.000Z",
  updatedAt: "2026-08-05T10:00:00.000Z",
};

const projectInput = {
  name: "Apelación actualizada",
  clientId: "client-1",
  type: "written_submission" as const,
  status: "active" as const,
  startDate: "2026-08-06",
  endDate: "2026-08-14",
};

const updatedProject = {
  ...project,
  name: projectInput.name,
  status: projectInput.status,
  updatedAt: "2026-08-11T15:00:00.000Z",
};

const archivedProject = {
  ...project,
  archivedAt: "2026-08-10T12:00:00.000Z",
  updatedAt: "2026-08-10T12:00:00.000Z",
};

const mocks = vi.hoisted(() => ({
  requestedId: "",
  query: {
    data: undefined as undefined | { project: typeof project },
    error: null as unknown,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  update: vi.fn(),
  archive: vi.fn(),
  restore: vi.fn(),
  archivePending: false,
  restorePending: false,
  teamReadOnly: false,
  stagesReadOnly: false,
}));

vi.mock("@/lib/api/generated/projects/projects", () => ({
  getGetProjectQueryKey: (projectId: string) => [`/api/projects/${projectId}`],
  getListProjectsQueryKey: () => ["/api/projects"],
  useGetProject: (projectId: string) => {
    mocks.requestedId = projectId;
    return mocks.query;
  },
  useUpdateProject: () => ({ mutateAsync: mocks.update, isPending: false }),
  useArchiveProject: () => ({
    mutateAsync: mocks.archive,
    isPending: mocks.archivePending,
  }),
  useRestoreProject: () => ({
    mutateAsync: mocks.restore,
    isPending: mocks.restorePending,
  }),
}));

vi.mock("@/lib/api/generated/activity/activity", () => ({
  getListProjectActivitiesQueryKey: (projectId: string) => [
    `/api/projects/${projectId}/activities`,
  ],
}));

vi.mock("@/features/projects/project-form", () => ({
  ProjectForm: ({
    initialProject,
    onSubmit,
    onCancel,
  }: {
    initialProject: typeof project;
    onSubmit(input: typeof projectInput): Promise<void> | void;
    onCancel?: () => void;
  }) => (
    <div>
      <p>{`Formulario ${initialProject.id}`}</p>
      <label htmlFor="mock-project-name">Nombre del proyecto simulado</label>
      <input id="mock-project-name" defaultValue={initialProject.name} />
      <button type="button" onClick={() => void onSubmit(projectInput)}>
        Guardar proyecto
      </button>
      {onCancel ? (
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("@/features/projects/project-team", () => ({
  ProjectTeam: ({ readOnly }: { readOnly?: boolean }) => {
    mocks.teamReadOnly = Boolean(readOnly);
    return <p>Configuración de equipo</p>;
  },
}));

vi.mock("@/features/projects/project-stages", () => ({
  ProjectStages: ({ readOnly }: { readOnly?: boolean }) => {
    mocks.stagesReadOnly = Boolean(readOnly);
    return <p>Configuración de etapas</p>;
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/projects/project-1/settings"]}>
        <Routes>
          <Route
            path="/projects/:projectId/settings"
            element={<ProjectSettingsPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { invalidate, ...view };
}

describe("ProjectSettingsPage", () => {
  beforeEach(() => {
    mocks.query.data = { project };
    mocks.query.error = null;
    mocks.query.isPending = false;
    mocks.query.isError = false;
    mocks.query.refetch.mockReset();
    mocks.update.mockReset().mockResolvedValue({ project: updatedProject });
    mocks.archive.mockReset().mockResolvedValue({ project: archivedProject });
    mocks.restore.mockReset().mockResolvedValue({ project });
    mocks.archivePending = false;
    mocks.restorePending = false;
    mocks.teamReadOnly = false;
    mocks.stagesReadOnly = false;
  });

  test("loads General first and keeps team and stage navigation", () => {
    renderPage();

    expect(mocks.requestedId).toBe("project-1");
    const heading = screen.getByRole("heading", {
      name: "Configuración del proyecto",
    });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("font-display", "text-3xl", "sm:text-4xl");
    expect(heading.closest('[data-slot="app-page"]')).toHaveClass("max-w-384");
    expect(
      heading
        .closest('[data-slot="app-page-header"]')
        ?.querySelector("svg.lucide-folder-kanban"),
    ).toHaveAttribute("aria-hidden", "true");
    expect(
      heading.closest('[data-slot="app-page-header"]')?.nextElementSibling,
    ).toHaveAttribute("data-slot", "app-page-content");
    expect(
      screen.getByRole("link", { name: "Volver al proyecto" }),
    ).toHaveAttribute("href", "/projects/project-1");
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Formulario project-1")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Equipo" }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getByText("Configuración de equipo")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Etapas" }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getByText("Configuración de etapas")).toBeInTheDocument();
  });

  test("updates project data and refreshes all dependent caches without a redundant cancel action", async () => {
    const { invalidate } = renderPage();
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Guardar proyecto" }));

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        projectId: "project-1",
        data: projectInput,
      }),
    );
    expect(screen.getByLabelText("Nombre del proyecto simulado")).toHaveValue(
      updatedProject.name,
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/projects/project-1"],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["/api/projects"] });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/projects/project-1/activities"],
    });
  });

  test("requires inline confirmation before archiving and keeps restoration available", async () => {
    const { invalidate } = renderPage();

    const archive = screen.getByRole("button", { name: "Archivar proyecto" });
    archive.focus();
    fireEvent.click(archive);
    expect(mocks.archive).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Confirmar archivo" }),
    ).toBeInTheDocument();
    const cancelArchive = screen.getByRole("button", {
      name: "Cancelar archivo",
    });
    expect(cancelArchive).toHaveFocus();
    fireEvent.click(cancelArchive);
    expect(
      screen.queryByRole("button", { name: "Confirmar archivo" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Archivar proyecto" }),
    ).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Archivar proyecto" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar archivo" }));

    await waitFor(() =>
      expect(mocks.archive).toHaveBeenCalledWith({ projectId: "project-1" }),
    );
    expect(screen.queryByText("Formulario project-1")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Restaurar proyecto" }),
      ).toHaveFocus(),
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/projects/project-1"],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["/api/projects"] });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/projects/project-1/activities"],
    });
  });

  test("keeps the active project editable after an archive failure", async () => {
    mocks.archive.mockRejectedValueOnce(new Error("offline"));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Archivar proyecto" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar archivo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos archivar el proyecto. Inténtalo nuevamente.",
    );
    expect(screen.getByText("Formulario project-1")).toBeInTheDocument();
  });

  test("keeps archived settings readable and restores from General", async () => {
    mocks.query.data = { project: archivedProject };
    const { invalidate } = renderPage();

    expect(screen.getByText(/archivado.*solo lectura/i)).toBeInTheDocument();
    expect(screen.queryByText("Formulario project-1")).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Equipo" }), {
      button: 0,
      ctrlKey: false,
    });
    expect(mocks.teamReadOnly).toBe(true);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Etapas" }), {
      button: 0,
      ctrlKey: false,
    });
    expect(mocks.stagesReadOnly).toBe(true);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "General" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole("button", { name: "Restaurar proyecto" }));

    await waitFor(() =>
      expect(mocks.restore).toHaveBeenCalledWith({ projectId: "project-1" }),
    );
    expect(screen.getByText("Formulario project-1")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/projects/project-1"],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["/api/projects"] });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/projects/project-1/activities"],
    });

    mocks.teamReadOnly = true;
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Equipo" }), {
      button: 0,
      ctrlKey: false,
    });
    expect(mocks.teamReadOnly).toBe(false);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Etapas" }), {
      button: 0,
      ctrlKey: false,
    });
    expect(mocks.stagesReadOnly).toBe(false);
  });

  test("disables restoration while its request is pending", () => {
    mocks.query.data = { project: archivedProject };
    mocks.restorePending = true;
    renderPage();

    expect(screen.getByRole("button", { name: "Restaurando…" })).toBeDisabled();
  });

  test("blocks every lifecycle action while either mutation is pending", () => {
    mocks.archivePending = true;
    const activeView = renderPage();
    expect(
      screen.getByRole("button", { name: "Archivar proyecto" }),
    ).toBeDisabled();
    activeView.unmount();

    mocks.archivePending = false;
    mocks.restorePending = true;
    const restoreBlockedView = renderPage();
    expect(
      screen.getByRole("button", { name: "Archivar proyecto" }),
    ).toBeDisabled();
    restoreBlockedView.unmount();

    mocks.query.data = { project: archivedProject };
    mocks.restorePending = false;
    mocks.archivePending = true;
    renderPage();
    expect(
      screen.getByRole("button", { name: "Restaurar proyecto" }),
    ).toBeDisabled();
  });

  test("keeps an archived project authoritative after a restore failure", async () => {
    mocks.query.data = { project: archivedProject };
    mocks.restore.mockRejectedValueOnce(new Error("offline"));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Restaurar proyecto" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos restaurar el proyecto. Inténtalo nuevamente.",
    );
    expect(screen.queryByText("Formulario project-1")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Restaurar proyecto" }),
    ).toBeInTheDocument();
  });

  test("renders loading and tenant-safe not-found states", () => {
    mocks.query.data = undefined;
    mocks.query.isPending = true;
    const view = renderPage();
    expect(
      screen.getByLabelText("Cargando configuración del proyecto"),
    ).toBeInTheDocument();
    expect(
      screen
        .getByLabelText("Cargando configuración del proyecto")
        .closest('[data-slot="app-page"]'),
    ).toHaveClass("max-w-384");
    view.unmount();

    mocks.query.isPending = false;
    mocks.query.isError = true;
    mocks.query.error = new ApiClientError("no encontrado", {
      kind: "http",
      status: 404,
      retryable: false,
    });
    renderPage();
    expect(
      screen.getByRole("heading", { name: "Proyecto no encontrado" }),
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole("heading", { name: "Proyecto no encontrado" })
        .closest('[data-slot="app-page"]'),
    ).toHaveClass("max-w-384");
    expect(
      screen.queryByRole("button", { name: "Intentar de nuevo" }),
    ).not.toBeInTheDocument();
  });

  test("retries a transient project failure", () => {
    mocks.query.data = undefined;
    mocks.query.isError = true;
    mocks.query.error = new Error("network");
    renderPage();

    expect(
      screen
        .getByText("No pudimos cargar la configuración")
        .closest('[data-slot="app-page"]'),
    ).toHaveClass("max-w-384");
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(mocks.query.refetch).toHaveBeenCalledOnce();
  });
});
