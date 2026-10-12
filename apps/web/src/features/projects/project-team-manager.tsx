import { useState } from "react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MemberIdentity } from "@/features/identity/member-identity";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getListProjectActivitiesQueryKey } from "@/lib/api/generated/activity/activity";
import {
  getListProjectAssignmentCandidatesQueryKey,
  getListProjectAssignmentsQueryKey,
  useAddProjectAssignments,
  useListProjectAssignmentCandidates,
  useRemoveProjectAssignment,
  useUpdateProjectAssignment,
} from "@/lib/api/generated/project-collaboration/project-collaboration";
import type {
  ProjectAssignment,
  ProjectResponsibility,
} from "@/lib/api/generated/models";

type ProjectTeamManagerProps = {
  projectId: string;
  activeAssignments: ProjectAssignment[];
  onDone(): void;
};

function statusOf(error: unknown) {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }
  return (error as { status?: number }).status;
}

function ResponsibilitySelect({
  name,
  value,
  disabled,
  onChange,
}: {
  name: string;
  value: ProjectResponsibility;
  disabled?: boolean;
  onChange(value: ProjectResponsibility): void;
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(nextValue) =>
        onChange(nextValue as ProjectResponsibility)
      }
    >
      <SelectTrigger
        aria-label={`Supervisión de ${name}`}
        className="w-full sm:w-auto"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="member">Miembro del proyecto</SelectItem>
        <SelectItem value="responsible">Supervisor del proyecto</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function ProjectTeamManager({
  projectId,
  activeAssignments,
  onDone,
}: ProjectTeamManagerProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<
    Record<string, ProjectResponsibility>
  >({});
  const [removeTarget, setRemoveTarget] = useState<ProjectAssignment | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search).trim();
  const params = {
    search: debouncedSearch || undefined,
    page,
    pageSize: 25,
  };
  const candidatesQuery = useListProjectAssignmentCandidates(
    projectId,
    params,
    { query: { placeholderData: keepPreviousData } },
  );
  const addMutation = useAddProjectAssignments();
  const updateMutation = useUpdateProjectAssignment();
  const removeMutation = useRemoveProjectAssignment();
  const busy =
    addMutation.isPending ||
    updateMutation.isPending ||
    removeMutation.isPending;

  async function refreshCollaboration() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getListProjectAssignmentsQueryKey(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: getListProjectAssignmentCandidatesQueryKey(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: getListProjectActivitiesQueryKey(projectId),
      }),
    ]);
  }

  function showMutationError(mutationError: unknown) {
    setError(
      statusOf(mutationError) === 409
        ? "El equipo cambió mientras editabas. Actualizamos la información; revisa tu selección e inténtalo nuevamente."
        : "No pudimos guardar el equipo. Inténtalo nuevamente.",
    );
  }

  async function addSelected() {
    const assignments = Object.entries(selected).map(
      ([userId, responsibility]) => ({ userId, responsibility }),
    );
    if (assignments.length === 0) return;
    setError(null);
    try {
      await addMutation.mutateAsync({
        projectId,
        data: { assignments },
      });
      setSelected({});
      await refreshCollaboration();
    } catch (mutationError) {
      showMutationError(mutationError);
      if (statusOf(mutationError) === 409) await refreshCollaboration();
    }
  }

  async function changeResponsibility(
    assignment: ProjectAssignment,
    responsibility: ProjectResponsibility,
  ) {
    if (assignment.responsibility === responsibility) return;
    setError(null);
    try {
      await updateMutation.mutateAsync({
        projectId,
        assignmentId: assignment.id,
        data: { responsibility },
      });
      await refreshCollaboration();
    } catch (mutationError) {
      showMutationError(mutationError);
      if (statusOf(mutationError) === 409) await refreshCollaboration();
    }
  }

  async function confirmRemoval() {
    if (!removeTarget) return;
    setError(null);
    try {
      await removeMutation.mutateAsync({
        projectId,
        assignmentId: removeTarget.id,
      });
      setRemoveTarget(null);
      await refreshCollaboration();
    } catch (mutationError) {
      showMutationError(mutationError);
      if (statusOf(mutationError) === 409) await refreshCollaboration();
    }
  }

  const candidates = candidatesQuery.data?.candidates ?? [];
  const totalPages = candidatesQuery.data?.pagination.totalPages ?? 0;

  return (
    <div className="border-border mt-6 space-y-6 border-t pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">
            Gestionar equipo
          </h3>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            La supervisión es informativa y no cambia los permisos.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onDone} disabled={busy}>
          Cerrar
        </Button>
      </div>

      {activeAssignments.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Asignaciones actuales</h4>
          {activeAssignments.map((assignment) => (
            <div
              key={assignment.id}
              className="rounded-control border-border bg-background flex flex-col gap-3 border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <MemberIdentity
                member={{
                  userId: assignment.userId ?? assignment.id,
                  alias: assignment.userAlias ?? undefined,
                  avatarColor: assignment.userAvatarColor,
                  fullName: assignment.userName,
                  activeStudioMember: assignment.activeStudioMember,
                }}
                to={
                  assignment.activeStudioMember && assignment.userId
                    ? `/team/${assignment.userId}`
                    : undefined
                }
                secondary={assignment.userEmail}
                compact
              />
              <div className="flex flex-wrap items-center gap-2">
                <ResponsibilitySelect
                  name={assignment.userName}
                  value={assignment.responsibility}
                  disabled={busy}
                  onChange={(value) =>
                    void changeResponsibility(assignment, value)
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  aria-label={`Quitar a ${assignment.userName} del proyecto`}
                  onClick={() => setRemoveTarget(assignment)}
                >
                  Quitar
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {removeTarget ? (
        <div className="rounded-control border-danger/25 bg-danger-soft space-y-3 border p-4">
          <p className="text-sm font-semibold">
            Quitar a {removeTarget.userName} del proyecto
          </p>
          <p className="text-muted-foreground text-sm">
            Su participación anterior permanecerá en el historial del proyecto.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setRemoveTarget(null)}
            >
              Volver
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => void confirmRemoval()}
            >
              Confirmar retiro
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        <div>
          <label
            htmlFor="project-team-search"
            className="text-foreground text-sm font-semibold"
          >
            Buscar miembros del estudio
          </label>
          <Input
            id="project-team-search"
            className="mt-2"
            value={search}
            placeholder="Nombre, alias o correo"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>

        {candidatesQuery.isPending ? (
          <div
            aria-label="Cargando miembros"
            className="rounded-control bg-muted h-24 animate-pulse"
          />
        ) : candidatesQuery.isError ? (
          <div className="space-y-3">
            <p className="text-danger text-sm">
              No pudimos cargar los miembros del estudio.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void candidatesQuery.refetch()}
            >
              Intentar de nuevo
            </Button>
          </div>
        ) : candidates.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No encontramos miembros disponibles.
          </p>
        ) : (
          <div
            className="space-y-2"
            aria-busy={candidatesQuery.isPlaceholderData}
          >
            {candidates.map((candidate) => {
              const checked = candidate.userId in selected;
              return (
                <div
                  key={candidate.memberId}
                  className="rounded-control border-border bg-background grid gap-3 border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <label className="flex min-w-0 items-start gap-3">
                    <input
                      type="checkbox"
                      className="accent-primary mt-1 size-4"
                      aria-label={`${candidate.userAlias || candidate.name}, ${candidate.email}`}
                      checked={checked}
                      disabled={candidate.assigned || busy}
                      onChange={(event) =>
                        setSelected((current) => {
                          if (!event.target.checked) {
                            const next = { ...current };
                            delete next[candidate.userId];
                            return next;
                          }
                          return { ...current, [candidate.userId]: "member" };
                        })
                      }
                    />
                    <span className="min-w-0">
                      <MemberIdentity
                        member={{
                          userId: candidate.userId,
                          alias: candidate.userAlias ?? undefined,
                          avatarColor: candidate.userAvatarColor,
                          fullName: candidate.name,
                          activeStudioMember: candidate.activeStudioMember,
                        }}
                        secondary={candidate.email}
                        compact
                      />
                      {candidate.assigned ? (
                        <span className="text-success mt-1 block text-xs font-medium">
                          Ya participa en el proyecto
                        </span>
                      ) : null}
                    </span>
                  </label>
                  {checked ? (
                    <ResponsibilitySelect
                      name={candidate.name}
                      value={selected[candidate.userId]!}
                      disabled={busy}
                      onChange={(responsibility) =>
                        setSelected((current) => ({
                          ...current,
                          [candidate.userId]: responsibility,
                        }))
                      }
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 ? (
          <nav
            aria-label="Paginación de miembros"
            className="flex items-center justify-between gap-3"
          >
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || candidatesQuery.isPlaceholderData}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </Button>
            <span className="text-muted-foreground text-xs font-medium">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || candidatesQuery.isPlaceholderData}
              onClick={() => setPage((current) => current + 1)}
            >
              Siguiente
            </Button>
          </nav>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          disabled={busy || Object.keys(selected).length === 0}
          onClick={() => void addSelected()}
        >
          Agregar seleccionados
        </Button>
      </div>
    </div>
  );
}
