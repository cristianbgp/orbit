import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MemberIdentity } from "@/features/identity/member-identity";
import { useListProjectAssignments } from "@/lib/api/generated/project-collaboration/project-collaboration";
import type { ProjectAssignment } from "@/lib/api/generated/models";
import { ProjectTeamManager } from "./project-team-manager";

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function AssignmentPerson({
  assignment,
  compact,
}: {
  assignment: ProjectAssignment;
  compact: boolean;
}) {
  return (
    <article
      className={
        compact
          ? "rounded-control border-border bg-background flex items-start justify-between gap-3 border p-3"
          : "rounded-control border-border bg-background border p-3"
      }
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
      <p
        className={
          compact
            ? "text-muted-foreground shrink-0 text-right text-[0.69rem]"
            : "text-muted-foreground mt-2 text-xs"
        }
      >
        Desde {dateFormatter.format(new Date(assignment.assignedAt))}
      </p>
    </article>
  );
}

function AssignmentGroup({
  title,
  assignments,
  kind,
  compact,
}: {
  title: string;
  assignments: ProjectAssignment[];
  kind: "responsible" | "member";
  compact: boolean;
}) {
  if (assignments.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-foreground text-sm font-semibold">{title}</h3>
      <div
        data-testid={`project-team-active-${kind}`}
        data-layout={compact ? "compact" : "standard"}
        className={
          compact ? "grid gap-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        {assignments.map((assignment) => (
          <AssignmentPerson
            key={assignment.id}
            assignment={assignment}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

export function ProjectTeam({
  projectId,
  compact = false,
  readOnly = false,
}: {
  projectId: string;
  compact?: boolean;
  readOnly?: boolean;
}) {
  const [historyPage, setHistoryPage] = useState(1);
  const [managing, setManaging] = useState(false);
  const query = useListProjectAssignments(projectId, {
    historyPage,
    historyPageSize: 25,
  });

  if (query.isPending) {
    return (
      <section
        aria-label="Cargando equipo del proyecto"
        className="rounded-card border-border bg-muted h-52 animate-pulse border"
      />
    );
  }

  if (query.isError || !query.data) {
    return (
      <section className="rounded-card border-danger/25 bg-card border p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">
          Equipo del proyecto
        </h2>
        <p className="text-danger mt-2 text-sm">
          No pudimos cargar el equipo del proyecto.
        </p>
        <Button
          className="mt-4"
          variant="outline"
          size="sm"
          onClick={() => void query.refetch()}
        >
          Intentar de nuevo
        </Button>
      </section>
    );
  }

  const responsible = query.data.active.filter(
    ({ responsibility }) => responsibility === "responsible",
  );
  const members = query.data.active.filter(
    ({ responsibility }) => responsibility === "member",
  );
  const totalHistoryPages = query.data.historyPagination.totalPages;

  return (
    <section
      aria-labelledby="project-team-title"
      className={
        compact
          ? "rounded-card border-border bg-card shadow-panel border p-5 sm:p-6"
          : "rounded-card border-border bg-card shadow-panel border p-5 sm:p-6"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="project-team-title"
            className="font-display text-lg font-semibold"
          >
            Equipo del proyecto
          </h2>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            Personas que participan y su rol actual.
          </p>
        </div>
        {!readOnly && !managing ? (
          <Button variant="outline" size="sm" onClick={() => setManaging(true)}>
            Gestionar equipo
          </Button>
        ) : null}
      </div>

      {query.data.active.length === 0 && query.data.history.length === 0 ? (
        <div className="border-primary/40 mt-6 border-l-2 pl-4">
          <h3 className="text-sm font-semibold">
            Aún no hay personas asignadas
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Puedes agregar uno o varios miembros del estudio cuando lo
            necesites.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <AssignmentGroup
            title="Supervisores del proyecto"
            assignments={responsible}
            kind="responsible"
            compact={compact}
          />
          <AssignmentGroup
            title="Otros miembros del proyecto"
            assignments={members}
            kind="member"
            compact={compact}
          />

          {query.data.history.length > 0 ? (
            <div className="border-border space-y-3 border-t pt-5">
              <h3 className="text-muted-foreground text-sm font-semibold">
                Participación anterior
              </h3>
              <div className="space-y-2">
                {query.data.history.map((assignment) => (
                  <article
                    key={assignment.id}
                    className={
                      compact
                        ? "rounded-control bg-muted/60 flex flex-col gap-2 p-3"
                        : "rounded-control bg-muted/60 flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                    }
                  >
                    <div>
                      {assignment.activeStudioMember && assignment.userId ? (
                        <MemberIdentity
                          member={{
                            userId: assignment.userId,
                            alias: assignment.userAlias ?? undefined,
                            avatarColor: assignment.userAvatarColor,
                            fullName: assignment.userName,
                            activeStudioMember: true,
                          }}
                          to={`/team/${assignment.userId}`}
                          secondary={assignment.userEmail}
                          compact
                        />
                      ) : (
                        <>
                          <h4 className="text-muted-foreground text-sm font-semibold">
                            {assignment.userName}
                          </h4>
                          <p className="text-muted-foreground text-xs">
                            {assignment.userEmail}
                          </p>
                        </>
                      )}
                      <p className="text-muted-foreground mt-2 text-xs font-medium">
                        {assignment.responsibility === "responsible"
                          ? "Supervisor del proyecto"
                          : "Miembro del proyecto"}
                      </p>
                    </div>
                    <div className="text-muted-foreground space-y-1 text-xs font-medium sm:text-right">
                      <p>
                        Asignado:{" "}
                        {dateFormatter.format(new Date(assignment.assignedAt))}
                      </p>
                      {assignment.endedAt ? (
                        <p>
                          Finalizado:{" "}
                          {dateFormatter.format(new Date(assignment.endedAt))}
                        </p>
                      ) : null}
                      <p className="text-foreground">
                        {assignment.endReason === "organization_removed"
                          ? "Miembro retirado"
                          : "Participación finalizada"}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
              {totalHistoryPages > 1 ? (
                <nav
                  aria-label="Paginación de participación anterior"
                  className="flex items-center justify-between gap-3 pt-2"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={historyPage <= 1}
                    onClick={() =>
                      setHistoryPage((current) => Math.max(1, current - 1))
                    }
                  >
                    Anterior
                  </Button>
                  <span className="text-muted-foreground text-xs font-medium">
                    Página {historyPage} de {totalHistoryPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={historyPage >= totalHistoryPages}
                    onClick={() => setHistoryPage((current) => current + 1)}
                  >
                    Siguiente
                  </Button>
                </nav>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {!readOnly && managing ? (
        <ProjectTeamManager
          projectId={projectId}
          activeAssignments={query.data.active}
          onDone={() => setManaging(false)}
        />
      ) : null}
    </section>
  );
}
