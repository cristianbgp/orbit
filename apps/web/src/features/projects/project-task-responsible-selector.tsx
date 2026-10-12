import { MemberIdentity } from "@/features/identity/member-identity";
import type { ProjectAssignment } from "@/lib/api/generated/models";

type ProjectTaskResponsibleSelectorProps = {
  assignments: ProjectAssignment[];
  selectedUserIds: string[];
  disabled?: boolean;
  onChange(userIds: string[]): void;
};

export function ProjectTaskResponsibleSelector({
  assignments,
  selectedUserIds,
  disabled = false,
  onChange,
}: ProjectTaskResponsibleSelectorProps) {
  const active = assignments.filter(
    (assignment) => assignment.endedAt === null && assignment.userId !== null,
  );

  function toggle(userId: string) {
    onChange(
      selectedUserIds.includes(userId)
        ? selectedUserIds.filter((current) => current !== userId)
        : [...selectedUserIds, userId],
    );
  }

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-foreground text-sm font-semibold">
        Encargados
      </legend>
      {active.length === 0 ? (
        <p className="text-muted-foreground text-sm leading-6">
          Agrega personas al equipo del proyecto para asignarlas a tareas.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {active.map((assignment) => {
            const userId = assignment.userId!;
            const primary = assignment.userAlias || assignment.userName;
            return (
              <label
                key={assignment.id}
                className="rounded-control border-border bg-background hover:bg-muted/50 has-checked:border-primary/50 has-checked:bg-primary/5 flex cursor-pointer items-start gap-3 border p-3 transition-colors"
              >
                <input
                  type="checkbox"
                  aria-label={`${primary}, ${assignment.userName}, ${assignment.userEmail}`}
                  className="border-border accent-primary focus-visible:ring-ring mt-0.5 size-4 rounded focus-visible:ring-2"
                  checked={selectedUserIds.includes(userId)}
                  onChange={() => toggle(userId)}
                />
                <MemberIdentity
                  member={{
                    userId,
                    alias: assignment.userAlias ?? undefined,
                    avatarColor: assignment.userAvatarColor,
                    fullName: assignment.userName,
                    activeStudioMember: assignment.activeStudioMember,
                  }}
                  secondary={assignment.userEmail}
                  compact
                  focusable={false}
                />
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
