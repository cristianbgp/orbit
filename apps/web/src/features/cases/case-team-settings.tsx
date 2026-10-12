import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MemberIdentity } from "@/features/identity/member-identity";
import {
  groupStudioMembersByPosition,
  studioMemberPositionLabel,
} from "@/features/team/studio-member-position";
import {
  getGetCaseQueryKey,
  getListCaseActivitiesQueryKey,
  getListCaseAssignmentCandidatesQueryKey,
  getListCaseAssignmentsQueryKey,
  useAddCaseAssignments,
  useEndCaseAssignment,
  useListCaseAssignmentCandidates,
  useListCaseAssignments,
} from "@/lib/api/generated/cases/cases";

export function CaseTeamSettings({
  caseId,
  disabled,
  compact = false,
  readOnly = false,
  responsibility = "member",
}: {
  caseId: string;
  disabled: boolean;
  compact?: boolean;
  readOnly?: boolean;
  responsibility?: "member" | "follower";
}) {
  const copy =
    responsibility === "member"
      ? {
          title: "Equipo del caso",
          description: "Personas que participan actualmente en el caso.",
          manage: "Gestionar equipo",
          empty: "Aún no hay personas asignadas",
          error: "equipo",
        }
      : {
          title: "Seguimiento del caso",
          description:
            "Personas que realizan seguimiento del estado y novedades del caso.",
          manage: "Gestionar seguimiento",
          empty: "Aún no hay personas en seguimiento",
          error: "seguimiento",
        };
  const client = useQueryClient();
  const params = { responsibility } as const;
  const assignments = useListCaseAssignments(caseId, params);
  const [managing, setManaging] = useState(false);
  const candidates = useListCaseAssignmentCandidates(caseId, params, {
    query: { enabled: !readOnly && !disabled && managing },
  });
  const add = useAddCaseAssignments();
  const end = useEndCaseAssignment();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [removeTarget, setRemoveTarget] = useState<
    NonNullable<typeof assignments.data>["active"][number] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => {
    void client.invalidateQueries({
      queryKey: getListCaseAssignmentsQueryKey(caseId, params),
    });
    void client.invalidateQueries({
      queryKey: getListCaseAssignmentCandidatesQueryKey(caseId, params),
    });
    void client.invalidateQueries({ queryKey: getGetCaseQueryKey(caseId) });
    void client.invalidateQueries({
      queryKey: getListCaseActivitiesQueryKey(caseId),
    });
  };
  async function addSelected() {
    setError(null);
    try {
      await add.mutateAsync({
        caseId,
        data: { userIds: selected, responsibility },
      });
      setSelected([]);
      refresh();
    } catch {
      setError(`No pudimos actualizar el ${copy.error}. Inténtalo nuevamente.`);
    }
  }
  async function confirmRemoval() {
    if (!removeTarget) return;
    setError(null);
    try {
      await end.mutateAsync({ caseId, assignmentId: removeTarget.id });
      setRemoveTarget(null);
      refresh();
    } catch {
      setError("No pudimos retirar al miembro. Inténtalo nuevamente.");
    }
  }
  const normalizedSearch = search.trim().toLocaleLowerCase("es-PE");
  const visibleCandidates = useMemo(
    () =>
      (candidates.data?.members ?? []).filter((person) => {
        if (!normalizedSearch) return true;
        return [person.alias, person.fullName, person.position ?? ""].some(
          (value) =>
            value.toLocaleLowerCase("es-PE").includes(normalizedSearch),
        );
      }),
    [candidates.data?.members, normalizedSearch],
  );
  const busy = add.isPending || end.isPending;

  if (assignments.isPending) {
    return (
      <section
        aria-label={`Cargando ${copy.title.toLocaleLowerCase("es-PE")}`}
        className="rounded-card border-border bg-muted h-52 animate-pulse border"
      />
    );
  }

  if (assignments.isError || !assignments.data) {
    return (
      <section className="rounded-card border-danger/25 bg-card border p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">{copy.title}</h2>
        <p className="text-danger mt-2 text-sm">
          No pudimos cargar el {copy.error} del caso.
        </p>
        <Button
          className="mt-4"
          variant="outline"
          size="sm"
          onClick={() => void assignments.refetch()}
        >
          Intentar de nuevo
        </Button>
      </section>
    );
  }
  const activeGroups = groupStudioMembersByPosition(
    assignments.data.active,
    (person) => person.position,
  );
  const candidateGroups = groupStudioMembersByPosition(
    visibleCandidates,
    (person) => person.position,
  );
  return (
    <section className="rounded-card border-border bg-card shadow-panel border p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{copy.title}</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            {copy.description}
          </p>
        </div>
        {!readOnly && !disabled && !managing ? (
          <Button variant="outline" size="sm" onClick={() => setManaging(true)}>
            {copy.manage}
          </Button>
        ) : null}
      </div>

      {assignments.data.active.length ? (
        <div className="mt-6 space-y-5">
          {activeGroups.map((group) => (
            <section key={group.label} role="group" aria-label={group.label}>
              <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                {group.label}
              </h3>
              <div
                className={
                  compact
                    ? "grid gap-2"
                    : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                }
              >
                {group.members.map((person) => (
                  <article
                    key={person.id}
                    className="rounded-control border-border bg-background border p-3"
                  >
                    <MemberIdentity
                      member={{
                        userId: person.userId ?? person.id,
                        alias: person.userAlias,
                        avatarColor: person.userAvatarColor,
                        fullName: person.userName,
                        activeStudioMember: person.activeStudioMember,
                      }}
                      to={
                        person.activeStudioMember && person.userId
                          ? `/team/${person.userId}`
                          : undefined
                      }
                      secondary={person.userEmail}
                      compact
                    />
                    <p className="text-muted-foreground mt-2 text-xs">
                      Desde {dateFormatter.format(new Date(person.assignedAt))}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="border-primary/40 mt-6 border-l-2 pl-4">
          <h3 className="text-sm font-semibold">{copy.empty}</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Puedes agregar miembros del estudio cuando lo necesites.
          </p>
        </div>
      )}

      {!disabled && !readOnly && managing ? (
        <div className="border-border mt-6 border-t pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold">
                {copy.manage}
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Las asignaciones son informativas y conservan historial.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setManaging(false)}
            >
              Cerrar
            </Button>
          </div>

          {assignments.data.active.length ? (
            <div className="mt-5 space-y-2">
              <h4 className="text-sm font-semibold">Asignaciones actuales</h4>
              {activeGroups.map((group) => (
                <section
                  key={group.label}
                  role="group"
                  aria-label={group.label}
                >
                  <h5 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                    {group.label}
                  </h5>
                  <div className="space-y-2">
                    {group.members.map((person) => (
                      <div
                        key={person.id}
                        className="rounded-control border-border bg-background flex items-center justify-between gap-3 border p-3"
                      >
                        <MemberIdentity
                          member={{
                            userId: person.userId ?? person.id,
                            alias: person.userAlias,
                            avatarColor: person.userAvatarColor,
                            fullName: person.userName,
                            activeStudioMember: person.activeStudioMember,
                          }}
                          secondary={person.userEmail}
                          compact
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          aria-label={`Quitar a ${person.userName} del caso`}
                          onClick={() => setRemoveTarget(person)}
                        >
                          Quitar
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          {removeTarget ? (
            <div className="rounded-control border-danger/25 bg-danger-soft mt-4 space-y-3 border p-4">
              <p className="text-sm font-semibold">
                Quitar a {removeTarget.userName} del caso
              </p>
              <p className="text-muted-foreground text-sm">
                Su participación permanecerá en el historial del caso.
              </p>
              <div className="flex gap-2">
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

          <div className="mt-5 space-y-3">
            <label
              htmlFor={`case-${responsibility}-search`}
              className="text-sm font-semibold"
            >
              Buscar miembros del estudio
            </label>
            <Input
              id={`case-${responsibility}-search`}
              value={search}
              placeholder="Nombre, alias o posición"
              onChange={(event) => setSearch(event.target.value)}
            />
            {candidates.isPending ? (
              <div
                aria-label="Cargando miembros"
                className="rounded-control bg-muted h-24 animate-pulse"
              />
            ) : candidates.isError ? (
              <div className="space-y-3">
                <p className="text-danger text-sm">
                  No pudimos cargar los miembros del estudio.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void candidates.refetch()}
                >
                  Intentar de nuevo
                </Button>
              </div>
            ) : visibleCandidates.length ? (
              <div className="space-y-4">
                {candidateGroups.map((group) => (
                  <section
                    key={group.label}
                    role="group"
                    aria-label={group.label}
                  >
                    <h5 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                      {group.label}
                    </h5>
                    <div className="space-y-2">
                      {group.members.map((person) => (
                        <label
                          key={person.userId}
                          className="rounded-control border-border bg-background flex items-center gap-3 border p-3"
                        >
                          <input
                            type="checkbox"
                            className="accent-primary size-4"
                            checked={selected.includes(person.userId)}
                            disabled={busy}
                            onChange={(event) =>
                              setSelected((current) =>
                                event.target.checked
                                  ? [...current, person.userId]
                                  : current.filter(
                                      (id) => id !== person.userId,
                                    ),
                              )
                            }
                          />
                          <MemberIdentity
                            focusable={false}
                            member={{
                              userId: person.userId,
                              alias: person.alias,
                              avatarColor: person.avatarColor,
                              fullName: person.fullName,
                            }}
                            secondary={studioMemberPositionLabel(
                              person.position,
                            )}
                            compact
                          />
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No encontramos miembros disponibles.
              </p>
            )}
            <div className="flex justify-end">
              <Button
                disabled={!selected.length || busy}
                onClick={() => void addSelected()}
              >
                Agregar seleccionados
              </Button>
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-danger mt-4 text-sm">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
