import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectStageEditor } from "@/features/projects/project-stage-editor";
import { getListProjectActivitiesQueryKey } from "@/lib/api/generated/activity/activity";

const stages = [
  {
    id: "stage-1",
    name: "Investigación",
    description: "Reunir fundamentos.",
    position: 0,
    createdAt: "2026-08-06T10:00:00.000Z",
    updatedAt: "2026-08-06T10:00:00.000Z",
  },
  {
    id: "stage-2",
    name: "Estrategia",
    description: null,
    position: 1,
    createdAt: "2026-08-06T10:00:00.000Z",
    updatedAt: "2026-08-06T10:00:00.000Z",
  },
];

const mocks = vi.hoisted(() => ({
  create: { mutateAsync: vi.fn(), isPending: false },
  update: { mutateAsync: vi.fn(), isPending: false },
  reorder: { mutateAsync: vi.fn(), isPending: false },
  remove: { mutateAsync: vi.fn(), isPending: false },
}));

vi.mock("@/lib/api/generated/project-stages/project-stages", () => ({
  getListProjectStagesQueryKey: (projectId: string) => [
    `/api/projects/${projectId}/stages`,
  ],
  useCreateProjectStage: () => mocks.create,
  useUpdateProjectStage: () => mocks.update,
  useReorderProjectStages: () => mocks.reorder,
  useDeleteProjectStage: () => mocks.remove,
}));

function renderEditor(options: { startAdding?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const onDone = vi.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <ProjectStageEditor
        projectId="project-1"
        stages={stages}
        startAdding={options.startAdding}
        onDone={onDone}
      />
    </QueryClientProvider>,
  );

  return { invalidate, onDone };
}

describe("ProjectStageEditor", () => {
  beforeEach(() => {
    mocks.create.isPending = false;
    mocks.update.isPending = false;
    mocks.reorder.isPending = false;
    mocks.remove.isPending = false;
    mocks.create.mutateAsync.mockReset().mockResolvedValue({});
    mocks.update.mutateAsync.mockReset().mockResolvedValue({});
    mocks.reorder.mutateAsync.mockReset().mockResolvedValue({ stages });
    mocks.remove.mutateAsync.mockReset().mockResolvedValue(undefined);
  });

  test("manually creates a normalized stage", async () => {
    const { invalidate } = renderEditor({ startAdding: true });

    fireEvent.change(screen.getByLabelText("Nombre de la etapa"), {
      target: { value: "  Audiencia  " },
    });
    fireEvent.change(screen.getByLabelText("Descripción de la etapa"), {
      target: { value: "  Preparar expediente  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar etapa" }));

    await waitFor(() =>
      expect(mocks.create.mutateAsync).toHaveBeenCalledWith({
        projectId: "project-1",
        data: { name: "Audiencia", description: "Preparar expediente" },
      }),
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/projects/project-1/stages"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: getListProjectActivitiesQueryKey("project-1"),
    });
  });

  test("requires a stage name and enforces field bounds", () => {
    renderEditor({ startAdding: true });

    fireEvent.change(screen.getByLabelText("Nombre de la etapa"), {
      target: { value: " " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar etapa" }));
    expect(
      screen.getByText("Ingresa el nombre de la etapa."),
    ).toBeInTheDocument();
    expect(mocks.create.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nombre de la etapa")).toHaveAttribute(
      "maxlength",
      "160",
    );
    expect(screen.getByLabelText("Descripción de la etapa")).toHaveAttribute(
      "maxlength",
      "2000",
    );
  });

  test("omits a blank optional description", async () => {
    renderEditor({ startAdding: true });
    fireEvent.change(screen.getByLabelText("Nombre de la etapa"), {
      target: { value: "Audiencia" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar etapa" }));

    await waitFor(() =>
      expect(mocks.create.mutateAsync).toHaveBeenCalledWith({
        projectId: "project-1",
        data: { name: "Audiencia" },
      }),
    );
  });

  test("preserves manual stage values after a failed save", async () => {
    mocks.create.mutateAsync.mockRejectedValue(new Error("network"));
    renderEditor({ startAdding: true });
    fireEvent.change(screen.getByLabelText("Nombre de la etapa"), {
      target: { value: "Audiencia" },
    });
    fireEvent.change(screen.getByLabelText("Descripción de la etapa"), {
      target: { value: "Preparar expediente" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar etapa" }));

    expect(
      await screen.findByText("No pudimos guardar la etapa."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre de la etapa")).toHaveValue(
      "Audiencia",
    );
    expect(screen.getByLabelText("Descripción de la etapa")).toHaveValue(
      "Preparar expediente",
    );
  });

  test("cancels manual creation without a request", () => {
    renderEditor({ startAdding: true });
    fireEvent.change(screen.getByLabelText("Nombre de la etapa"), {
      target: { value: "Audiencia" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(mocks.create.mutateAsync).not.toHaveBeenCalled();
    expect(
      screen.queryByLabelText("Nombre de la etapa"),
    ).not.toBeInTheDocument();
  });

  test("edits an existing stage inline", async () => {
    const { invalidate } = renderEditor();
    fireEvent.click(
      screen.getByRole("button", { name: "Editar Investigación" }),
    );

    expect(screen.getByLabelText("Nombre de la etapa")).toHaveValue(
      "Investigación",
    );
    expect(screen.getByLabelText("Descripción de la etapa")).toHaveValue(
      "Reunir fundamentos.",
    );
    fireEvent.change(screen.getByLabelText("Nombre de la etapa"), {
      target: { value: "Investigación jurídica" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar etapa" }));

    await waitFor(() =>
      expect(mocks.update.mutateAsync).toHaveBeenCalledWith({
        projectId: "project-1",
        stageId: "stage-1",
        data: {
          name: "Investigación jurídica",
          description: "Reunir fundamentos.",
        },
      }),
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/projects/project-1/stages"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: getListProjectActivitiesQueryKey("project-1"),
    });
  });

  test("exits structure editing when no inline form is open", () => {
    const { onDone } = renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  test("reorders with accessible boundary controls and a complete ID set", async () => {
    const { invalidate } = renderEditor();

    expect(
      screen.getByRole("button", {
        name: "Mover Investigación hacia arriba",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Mover Estrategia hacia abajo" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Mover Estrategia hacia arriba" }),
    );

    await waitFor(() =>
      expect(mocks.reorder.mutateAsync).toHaveBeenCalledWith({
        projectId: "project-1",
        data: { stageIds: ["stage-2", "stage-1"] },
      }),
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/projects/project-1/stages"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: getListProjectActivitiesQueryKey("project-1"),
    });
    expect(screen.getByRole("status")).toHaveTextContent("Orden actualizado.");
  });

  test("keeps server order and offers retry after reorder failure", async () => {
    mocks.reorder.mutateAsync
      .mockRejectedValueOnce(new Error("stale"))
      .mockResolvedValueOnce({ stages });
    renderEditor();

    fireEvent.click(
      screen.getByRole("button", { name: "Mover Estrategia hacia arriba" }),
    );
    expect(
      await screen.findByText("No pudimos cambiar el orden."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })[0]).toHaveTextContent(
      "Investigación",
    );
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    await waitFor(() =>
      expect(mocks.reorder.mutateAsync).toHaveBeenCalledTimes(2),
    );
  });

  test("cancels stage deletion from a named permanent confirmation", () => {
    renderEditor();

    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Investigación" }),
    );
    expect(
      screen.getByText(/Eliminar Investigación de forma permanente/),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Cancelar eliminación" }),
    );

    expect(mocks.remove.mutateAsync).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/Eliminar Investigación de forma permanente/),
    ).not.toBeInTheDocument();
  });

  test("deletes a confirmed stage and refreshes the ordered list", async () => {
    const { invalidate } = renderEditor();
    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Investigación" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar etapa" }));

    await waitFor(() =>
      expect(mocks.remove.mutateAsync).toHaveBeenCalledWith({
        projectId: "project-1",
        stageId: "stage-1",
      }),
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/projects/project-1/stages"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: getListProjectActivitiesQueryKey("project-1"),
    });
  });

  test("keeps deletion confirmation open after a failed request", async () => {
    mocks.remove.mutateAsync.mockRejectedValue(new Error("network"));
    renderEditor();
    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Investigación" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar etapa" }));

    expect(
      await screen.findByText("No pudimos eliminar la etapa."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Eliminar etapa" }),
    ).toBeInTheDocument();
  });
});
