import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getListProjectActivitiesQueryKey } from "@/lib/api/generated/activity/activity";
import {
  getListProjectStagesQueryKey,
  useCreateProjectStage,
  useDeleteProjectStage,
  useReorderProjectStages,
  useUpdateProjectStage,
} from "@/lib/api/generated/project-stages/project-stages";
import type { ProjectStage } from "@/lib/api/generated/models";
import { getGetProjectTaskScheduleQueryKey } from "@/lib/api/generated/project-tasks/project-tasks";

type StageFormProps = {
  initialStage?: ProjectStage;
  isPending: boolean;
  onCancel(): void;
  onSubmit(values: { name: string; description: string }): Promise<void>;
};

function StageForm({
  initialStage,
  isPending,
  onCancel,
  onSubmit,
}: StageFormProps) {
  const [name, setName] = useState(initialStage?.name ?? "");
  const [description, setDescription] = useState(
    initialStage?.description ?? "",
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) {
      setValidationError("Ingresa el nombre de la etapa.");
      return;
    }
    setValidationError(null);
    setSaveError(null);
    try {
      await onSubmit({
        name: normalizedName,
        description: description.trim(),
      });
    } catch {
      setSaveError("No pudimos guardar la etapa.");
    }
  }

  return (
    <form
      className="rounded-control border-primary/20 bg-info-soft/35 border p-4"
      aria-busy={isPending}
      onSubmit={(event) => void submit(event)}
    >
      <div className="grid gap-4">
        <div className="space-y-2">
          <label htmlFor="stage-name" className="text-sm font-semibold">
            Nombre de la etapa
          </label>
          <Input
            id="stage-name"
            value={name}
            maxLength={160}
            disabled={isPending}
            aria-invalid={Boolean(validationError)}
            aria-describedby={validationError ? "stage-name-error" : undefined}
            onChange={(event) => setName(event.target.value)}
          />
          {validationError ? (
            <p
              id="stage-name-error"
              role="alert"
              className="text-danger text-sm"
            >
              {validationError}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="stage-description" className="text-sm font-semibold">
            Descripción de la etapa
          </label>
          <Textarea
            id="stage-description"
            value={description}
            maxLength={2_000}
            disabled={isPending}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        {saveError ? (
          <p role="alert" className="text-danger text-sm">
            {saveError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar etapa"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={onCancel}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </form>
  );
}

type ProjectStageEditorProps = {
  projectId: string;
  stages: ProjectStage[];
  startAdding?: boolean;
  onDone(): void;
};

export function ProjectStageEditor({
  projectId,
  stages,
  startAdding = false,
  onDone,
}: ProjectStageEditorProps) {
  const queryClient = useQueryClient();
  const createMutation = useCreateProjectStage();
  const updateMutation = useUpdateProjectStage();
  const reorderMutation = useReorderProjectStages();
  const deleteMutation = useDeleteProjectStage();
  const [isAdding, setIsAdding] = useState(startAdding);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [stagePendingDeletion, setStagePendingDeletion] =
    useState<ProjectStage | null>(null);
  const [reorderRetry, setReorderRetry] = useState<string[] | null>(null);
  const [reorderSaved, setReorderSaved] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const hasOpenForm =
    isAdding || Boolean(editingStageId) || Boolean(stagePendingDeletion);
  const structuralMutationPending =
    reorderMutation.isPending || deleteMutation.isPending;

  async function refreshStages() {
    await queryClient.invalidateQueries({
      queryKey: getListProjectStagesQueryKey(projectId),
    });
    await queryClient.invalidateQueries({
      queryKey: getGetProjectTaskScheduleQueryKey(projectId),
    });
    await queryClient.invalidateQueries({
      queryKey: getListProjectActivitiesQueryKey(projectId),
    });
  }

  async function createStage(values: { name: string; description: string }) {
    await createMutation.mutateAsync({
      projectId,
      data: {
        name: values.name,
        ...(values.description ? { description: values.description } : {}),
      },
    });
    await refreshStages();
    setIsAdding(false);
  }

  async function updateStage(
    stageId: string,
    values: { name: string; description: string },
  ) {
    await updateMutation.mutateAsync({
      projectId,
      stageId,
      data: values,
    });
    await refreshStages();
    setEditingStageId(null);
  }

  async function reorderStages(stageIds: string[]) {
    setReorderRetry(null);
    setReorderSaved(false);
    try {
      await reorderMutation.mutateAsync({
        projectId,
        data: { stageIds },
      });
      await refreshStages();
      setReorderSaved(true);
    } catch {
      setReorderRetry(stageIds);
    }
  }

  function moveStage(index: number, direction: -1 | 1) {
    const destination = index + direction;
    const stageIds = stages.map(({ id }) => id);
    [stageIds[index], stageIds[destination]] = [
      stageIds[destination],
      stageIds[index],
    ];
    void reorderStages(stageIds);
  }

  async function deleteStage() {
    if (!stagePendingDeletion) return;
    setDeleteError(false);
    try {
      await deleteMutation.mutateAsync({
        projectId,
        stageId: stagePendingDeletion.id,
      });
      await refreshStages();
      setStagePendingDeletion(null);
    } catch {
      console.error("Failed to delete stage", stagePendingDeletion.id);
      setDeleteError(true);
    }
  }

  return (
    <section
      aria-labelledby="project-stage-editor-title"
      className="rounded-card border-primary/25 bg-card shadow-panel border p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="project-stage-editor-title"
            className="font-display text-lg font-semibold"
          >
            Editar estructura
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Ajusta las etapas únicamente para este proyecto.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={hasOpenForm || structuralMutationPending}
          onClick={onDone}
        >
          Listo
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        {stages.map((stage, index) =>
          editingStageId === stage.id ? (
            <StageForm
              key={stage.id}
              initialStage={stage}
              isPending={updateMutation.isPending}
              onCancel={() => setEditingStageId(null)}
              onSubmit={(values) => updateStage(stage.id, values)}
            />
          ) : (
            <div
              key={stage.id}
              className="rounded-control border-border border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">{stage.name}</h3>
                  {stage.description ? (
                    <p className="text-muted-foreground mt-1 text-sm leading-6">
                      {stage.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Mover ${stage.name} hacia arriba`}
                    disabled={
                      index === 0 || hasOpenForm || structuralMutationPending
                    }
                    onClick={() => moveStage(index, -1)}
                  >
                    Subir
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Mover ${stage.name} hacia abajo`}
                    disabled={
                      index === stages.length - 1 ||
                      hasOpenForm ||
                      structuralMutationPending
                    }
                    onClick={() => moveStage(index, 1)}
                  >
                    Bajar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={hasOpenForm || structuralMutationPending}
                    onClick={() => setEditingStageId(stage.id)}
                  >
                    {`Editar ${stage.name}`}
                  </Button>
                  <Button
                    className="text-danger hover:bg-danger-soft"
                    variant="ghost"
                    size="sm"
                    disabled={hasOpenForm || structuralMutationPending}
                    onClick={() => {
                      setDeleteError(false);
                      setStagePendingDeletion(stage);
                    }}
                  >
                    {`Eliminar ${stage.name}`}
                  </Button>
                </div>
              </div>

              {stagePendingDeletion?.id === stage.id ? (
                <div className="border-danger mt-4 border-l-2 pl-4">
                  <p className="text-foreground text-sm font-semibold">
                    {`Eliminar ${stage.name} de forma permanente`}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Esta acción no se puede deshacer.
                  </p>
                  {deleteError ? (
                    <p role="alert" className="text-danger mt-2 text-sm">
                      No pudimos eliminar la etapa.
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      className="bg-danger hover:bg-danger/90 text-white"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={() => void deleteStage()}
                    >
                      Eliminar etapa
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        setDeleteError(false);
                        setStagePendingDeletion(null);
                      }}
                    >
                      Cancelar eliminación
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ),
        )}

        {reorderRetry ? (
          <div className="border-danger border-l-2 pl-4">
            <p role="alert" className="text-danger text-sm">
              No pudimos cambiar el orden.
            </p>
            <Button
              className="mt-2"
              variant="outline"
              size="sm"
              disabled={reorderMutation.isPending}
              onClick={() => void reorderStages(reorderRetry)}
            >
              Intentar de nuevo
            </Button>
          </div>
        ) : null}

        {reorderSaved ? (
          <p role="status" className="text-success text-sm">
            Orden actualizado.
          </p>
        ) : null}

        {isAdding ? (
          <StageForm
            isPending={createMutation.isPending}
            onCancel={() => setIsAdding(false)}
            onSubmit={createStage}
          />
        ) : (
          <Button
            className="mt-2"
            variant="outline"
            size="sm"
            disabled={hasOpenForm}
            onClick={() => setIsAdding(true)}
          >
            Agregar etapa
          </Button>
        )}
      </div>
    </section>
  );
}
